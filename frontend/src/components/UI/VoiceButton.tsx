'use client';

import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { useSpaceStore } from '@/store/spaceStore';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

interface SpeechRecognitionType {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionType;
    webkitSpeechRecognition: new () => SpeechRecognitionType;
  }
}

export default memo(function VoiceButton() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  
  const addChatMessage = useSpaceStore((state) => state.addChatMessage);
  const setProcessing = useSpaceStore((state) => state.setProcessing);
  const setCameraTarget = useSpaceStore((state) => state.setCameraTarget);
  
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const getSynthesis = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return (window as any).speechSynthesis || (window as any).webkitSpeechSynthesis;
  }, []);
  
  const getRecognition = useCallback((): (new () => SpeechRecognitionType) | null => {
    if (typeof window === 'undefined') return null;
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  }, []);
  
  const speakResponse = useCallback((text: string) => {
    const synthesis = getSynthesis();
    if (!synthesis) return;
    
    synthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    
    const voices = synthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Microsoft')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    synthesis.speak(utterance);
  }, [getSynthesis]);
  
  const stopSpeaking = useCallback(() => {
    const synthesis = getSynthesis();
    if (synthesis) {
      synthesis.cancel();
      setIsSpeaking(false);
    }
  }, [getSynthesis]);
  
  const startListening = useCallback(() => {
    const SpeechRecognition = getRecognition();
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported');
      return;
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      setIsListening(true);
    };
    
    recognition.onresult = (event: any) => {
      const result = event.results[event.resultIndex];
      const transcript = result[0].transcript;
      
      if (result.isFinal) {
        setIsListening(false);
        
        if (transcript.trim()) {
          handleVoiceSubmit(transcript.trim());
        }
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  }, [getRecognition]);
  
  const handleVoiceSubmit = async (userMessage: string) => {
    addChatMessage('user', userMessage);
    setProcessing(true);
    
    stopSpeaking();
    
    try {
      const sessionId = useSpaceStore.getState().chatHistory[0]?.id?.replace('msg_', '') || 'default';
      
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage, 
          user_level: 'beginner',
          session_id: sessionId
        }),
      });
      
      const data = await res.json();
      
      addChatMessage('assistant', data.chat_response);
      setCameraTarget(data.camera_action.target, data.camera_action.action);
      
      speakResponse(data.chat_response);
    } catch (error) {
      addChatMessage('assistant', 'Failed to connect to the cosmic network. Please try again.');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleClick = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
    } else if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      startListening();
    }
  }, [isSpeaking, isListening, startListening, stopSpeaking]);
  
  const Recognition = isClient ? getRecognition() : null;
  
  if (!isClient || !Recognition) {
    return null;
  }
  
  return (
    <button
      onClick={handleClick}
      className={`p-2 rounded-lg transition-all ${
        isListening 
          ? 'bg-red-600 animate-pulse' 
          : isSpeaking 
            ? 'bg-blue-600' 
            : 'bg-gray-700 hover:bg-gray-600'
      }`}
      title={isSpeaking ? 'Stop speaking' : isListening ? 'Listening...' : 'Voice input'}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-5 w-5 text-white"
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
      >
        {isListening ? (
          <>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </>
        ) : isSpeaking ? (
          <>
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <line x1="9" y1="9" x2="15" y2="15" />
            <line x1="15" y1="9" x2="9" y2="15" />
          </>
        ) : (
          <>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </>
        )}
      </svg>
    </button>
  );
});
