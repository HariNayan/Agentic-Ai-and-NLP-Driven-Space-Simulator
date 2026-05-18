'use client';

import { useEffect, useState } from 'react';

interface Article {
  id: number;
  title: string;
  news_site: string;
  published_at: string;
  url: string;
  summary: string;
}

export default function NewsPanel() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchNews = async () => {
      try {
        const r = await fetch('https://api.spaceflightnewsapi.net/v4/articles/?limit=10');
        if (!r.ok) throw new Error('API limit');
        const data = await r.json();
        if (isMounted) {
          setArticles(data?.results ?? []);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) { setLoading(false); setError(true); }
      }
    };

    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    return h < 1 ? 'Just now' : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div
      style={{
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0c14',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {loading && (
          <div
            style={{
              padding: '8px',
              fontFamily: "'Courier New', monospace",
              fontSize: '9px',
              color: '#4a5070',
            }}
          >
            Loading...
          </div>
        )}
          {error && !loading && (
            <div style={{ padding: '8px', fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#c0473a' }}>
              ⚠ NEWS FEED UNAVAILABLE
            </div>
          )}
          {!error && articles.map((a) => (
          <div
            key={a.id}
            onClick={() => window.open(a.url, '_blank')}
            style={{
              padding: '5px 8px',
              borderBottom: '1px solid #161a26',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = '#0d1018')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'transparent')
            }
          >
            <div
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: '8px',
                color: '#6a9fd8',
                textTransform: 'uppercase',
                marginBottom: '2px',
              }}
            >
              {a.news_site} · {timeAgo(a.published_at)}
            </div>
            <div
              style={{
                fontSize: '10px',
                color: '#c8ccd8',
                lineHeight: '1.35',
                fontFamily: "'Courier New', monospace",
              }}
            >
              {a.title}
            </div>
          </div>
        ))}
        {!loading && !error && articles.length === 0 && (
          <div style={{ padding: '8px', fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#4a5070' }}>
            NO ARTICLES
          </div>
        )}
      </div>
    </div>
  );
}