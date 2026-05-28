'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useSpaceStore, useChatSelector, useProcessingSelector } from '@/store/spaceStore';
import PanelFooter from './PanelFooter';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

interface ChatMessageWithStreaming {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  quiz?: {
    question: string;
    options: string[];
    correct: string;
    explanation: string;
    planet?: string;
  };
  answered?: boolean;
  selectedAnswer?: string;
}

function renderQuizMessage(
  msg: ChatMessageWithStreaming,
  i: number,
  onAnswer: (selected: string, quiz: ChatMessageWithStreaming['quiz'], messageId: string) => void
) {
  if (msg.content !== '__QUIZ__' || !msg.quiz) return null;
  const quiz = msg.quiz;

  return (
    <div key={msg.id || i} className="quiz-card">
      <p className="quiz-question">{quiz.question}</p>
      <div className="quiz-options">
        {quiz.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => onAnswer(option, quiz, msg.id)}
            disabled={msg.answered}
            className={
              msg.answered
                ? option === quiz.correct
                  ? 'correct'
                  : option === msg.selectedAnswer
                  ? 'wrong'
                  : 'disabled'
                : 'unanswered'
            }
          >
            {option}
          </button>
        ))}
      </div>
      {msg.answered && <p className="quiz-explanation">{quiz.explanation}</p>}
    </div>
  );
}

export default memo(function ChatPanel() {
  const selectedPlanet = useSpaceStore((state) => state.currentCameraTarget);
  const setCameraTarget = useSpaceStore((state) => state.setCameraTarget);
  const onNavigate = (target: string) => setCameraTarget(target, 'zoom');
  const [input, setInput] = useState('');
  const chatHistory = useChatSelector();
  const isProcessing = useProcessingSelector();
  const addChatMessage = useSpaceStore((state) => state.addChatMessage);
  const setProcessing = useSpaceStore((state) => state.setProcessing);
  const updateMessage = useSpaceStore((state) => state.updateMessage);
  // Stable session ID — generated once per component mount so conversation
  // history is preserved across all messages in this browser tab.
  const sessionId = useRef(`session_${Date.now()}`);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAssistantMessage = [...chatHistory].reverse().find((msg) => msg.role === 'assistant');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleQuizAnswer = useCallback(async (
    selected: string,
    quiz: ChatMessageWithStreaming['quiz'],
    messageId: string
  ) => {
    if (!quiz) return;

    updateMessage(messageId, {
      answered: true,
      selectedAnswer: selected,
    });

    const planet = quiz.planet ?? selectedPlanet;
    const correct = selected === quiz.correct;
    if (!correct) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/curriculum/quiz-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId.current,
          planet,
          correct: true,
        }),
      });

      if (!res.ok) return;
      const data = await res.json();
      if (!data.lesson_completed) return;

      const completedTitle = data.completed_lesson?.title;
      const level = String(data.level ?? '').toUpperCase();
      const nextLessonTitle = data.next_lesson?.title;

      if (completedTitle) {
        addChatMessage(
          'assistant',
          nextLessonTitle
            ? `Curriculum updated: completed "${completedTitle}". Current level: ${level}. Next lesson: "${nextLessonTitle}".`
            : `Curriculum updated: completed "${completedTitle}". Current level: ${level}.`
        );
      }
    } catch {
      // Keep quiz UX local even if progress sync fails.
    }
  }, [addChatMessage, selectedPlanet, updateMessage]);

  const doChatRequest = useCallback(async (
    retryCount = 0,
    messageOverride?: string,
    shouldAddUserMessage = true
  ) => {
    const userMessage = (messageOverride ?? input).trim();
    if (!userMessage || isProcessing) return;

    const requestHistory = chatHistory
      .filter((msg) => msg.content && msg.content !== '__QUIZ__')
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));

    if (shouldAddUserMessage) {
      addChatMessage('user', userMessage);
      setInput('');
    }
    setProcessing(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          selected_planet: selectedPlanet,
          user_level: 'beginner',
          session_id: sessionId.current,
          history: requestHistory,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if ((res.status === 429 || errorText.includes('rate') || errorText.includes('limit')) && retryCount < 1) {
          addChatMessage('assistant', 'Rate limited. Retrying in 5 seconds...');
          await new Promise(r => setTimeout(r, 5000));
          useSpaceStore.setState(state => ({
            chatHistory: state.chatHistory.slice(0, -1)
          }));
          setProcessing(false);
          return doChatRequest(retryCount + 1, userMessage, false);
        }
        addChatMessage(
          'assistant',
          `AI service returned ${res.status}. Please try again in a moment.`
        );
        return;
      }

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No reader');

        const decoder = new TextDecoder();
        let aiText = '';
        let pending = '';

        const tempId = `msg_${Date.now()}`;

        const handleSseLine = async (line: string) => {
          const normalized = line.trimEnd();
          if (!normalized.startsWith('data: ')) return false;

          const payload = normalized.slice(6).trim();
          if (payload === '[DONE]') return true;

          try {
            const data = JSON.parse(payload);

            if (data.token && data.token.includes('rate') && data.token.includes('limit')) {
              if (retryCount < 1) {
                await new Promise(r => setTimeout(r, 5000));
                useSpaceStore.setState(state => ({
                  chatHistory: state.chatHistory.filter(m => m.id !== tempId)
                }));
                setProcessing(false);
                await doChatRequest(retryCount + 1, userMessage, false);
                return true;
              }
            }

            if (data.token) {
              aiText += data.token;
              useSpaceStore.setState((state) => ({
                chatHistory: state.chatHistory.map((m) =>
                  m.id === tempId ? { ...m, content: aiText } : m
                ),
              }));
            }
          } catch {
            // Ignore malformed SSE payloads; the stream may continue with valid chunks.
          }

          return false;
        };

        useSpaceStore.setState((state) => ({
          chatHistory: [
            ...state.chatHistory,
            {
              id: tempId,
              role: 'assistant',
              content: '',
              timestamp: Date.now(),
              isStreaming: true,
            },
          ],
        }));

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            pending += decoder.decode();
            break;
          }

          pending += decoder.decode(value, { stream: true });
          const lines = pending.split('\n');
          pending = lines.pop() ?? '';
          for (const line of lines) {
            if (await handleSseLine(line)) return;
          }
        }

        if (pending.trim() && await handleSseLine(pending)) return;

        useSpaceStore.setState((state) => ({
          chatHistory: state.chatHistory.map((m) =>
            m.id === tempId ? { ...m, content: aiText, isStreaming: false } : m
          ),
        }));
      } else {
        const data = await res.json();

        if (data.intent === 'navigate' && data.target) {
          onNavigate(data.target);
          useSpaceStore.setState((state) => ({
            chatHistory: [
              ...state.chatHistory,
              {
                id: `msg_${Date.now()}`,
                role: 'assistant',
                content: `🚀 Camera locked on ${data.target}. Info panel opened — ask me anything about it!`,
                timestamp: Date.now(),
              },
            ],
          }));
        } else if (data.intent === 'quiz' && data.quiz) {
          useSpaceStore.setState((state) => ({
            chatHistory: [
              ...state.chatHistory,
              {
                id: `msg_${Date.now()}`,
                role: 'assistant',
                content: '__QUIZ__',
                timestamp: Date.now(),
                quiz: { ...data.quiz, planet: data.target ?? selectedPlanet },
              },
            ],
          }));
        } else if (data.message) {
          addChatMessage('assistant', data.message);
        }
      }
    } catch (error) {
      addChatMessage(
        'assistant',
        'Failed to connect to the cosmic network. Please try again.'
      );
    } finally {
      setProcessing(false);
    }
  }, [input, isProcessing, addChatMessage, setProcessing, selectedPlanet, chatHistory]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isProcessing) return;
      doChatRequest();
    },
    [input, isProcessing, doChatRequest]
  );

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0c14',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
        }}
      >
        {chatHistory.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: '#4a5070',
              fontSize: '9px',
              marginTop: '20px',
              fontFamily: "'Courier New', monospace",
            }}
          >
            <p>Ask me about space...</p>
            <p style={{ fontSize: '8px', marginTop: '6px' }}>
              Try "Take me to Mars" or "Tell me about Jupiter"
            </p>
          </div>
        )}

        {chatHistory.map((msg, i) => {
          const quizComponent = renderQuizMessage(
            msg as ChatMessageWithStreaming,
            i,
            handleQuizAnswer
          );
          if (quizComponent) return quizComponent;

          return (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'user' ? '#0f1520' : '#0a0d14',
                border:
                  msg.role === 'user'
                    ? '1px solid #1e2840'
                    : '1px solid #161a26',
                padding: '5px 8px',
                maxWidth: '88%',
              }}
            >
              <div
                style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: '7px',
                  color: '#2a2f42',
                  textTransform: 'uppercase',
                  marginBottom: '2px',
                }}
              >
                {msg.role === 'user' ? 'YOU' : 'GEMMA'}
              </div>
              <div
                style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: '10px',
                  color: '#c8ccd8',
                }}
              >
                {msg.content}
                {msg.isStreaming && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '4px',
                      height: '10px',
                      background: '#4a5070',
                      marginLeft: '2px',
                      animation: 'blink 0.5s infinite',
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}

        {isProcessing &&
          chatHistory.length > 0 &&
          !chatHistory.some((m) => m.id?.startsWith('msg_') && m.content === '') && (
            <div
              style={{
                alignSelf: 'flex-start',
                background: '#0a0d14',
                border: '1px solid #161a26',
                padding: '5px 8px',
              }}
            >
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: '#4a5070',
                      animation: `pulse 1s ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          height: '36px',
          padding: '0 8px',
          borderTop: '1px solid #161a26',
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          background: '#060810',
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter your message..."
          disabled={isProcessing}
          style={{
            flex: 1,
            background: '#0a0c14',
            border: '1px solid #1e2335',
            fontFamily: "'Courier New', monospace",
            fontSize: '10px',
            color: '#c8ccd8',
            padding: '4px 8px',
            outline: 'none',
            borderRadius: 0,
          }}
        />
        <button
          type="submit"
          disabled={isProcessing || !input.trim()}
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: '8px',
            color: '#4a5070',
            background: 'transparent',
            border: '1px solid #1e2335',
            padding: '4px 8px',
            cursor: 'pointer',
            borderRadius: 0,
          }}
        >
          SEND
        </button>
      </form>
      <PanelFooter
        source="FastAPI / NVIDIA-hosted models"
        lastUpdated={lastAssistantMessage ? new Date(lastAssistantMessage.timestamp) : null}
      />
    </div>
  );
});
