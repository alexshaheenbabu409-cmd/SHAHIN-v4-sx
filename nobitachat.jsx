import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, MoreHorizontal, Paperclip, ArrowUp, Sun, Moon, X } from 'lucide-react';

const STORAGE_KEY = 'nobita_chat_sessions';
const THEME_KEY = 'nobita_theme';
const MAX_MEMORY_MESSAGES = 10;
const HISTORY_RETENTION_DAYS = 30;

// Cloudflare Pages-এ এই মানগুলো env variable হিসেবে সেট করুন
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:8787/api/chat';
const DEFAULT_MODEL = import.meta.env.VITE_DEFAULT_MODEL || 'deepseek/deepseek-v4-flash';
const SYSTEM_PROMPT = import.meta.env.VITE_SYSTEM_PROMPT || 'তুমি একজন সহায়ক বাংলা AI সহকারী।';

const NobitaChat = () => {
  const [theme, setTheme] = useState('dark');
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const isDark = theme === 'dark';

  // ---- থিম লোড করা (in-memory, artifact-এ localStorage নেই তাই state-ই সত্য উৎস) ----
  useEffect(() => {
    const seed = [
      { id: 's1', title: 'বাংলাদেশের ইতিহাস', createdAt: Date.now() - 86400000 },
      { id: 's2', title: 'গণিতের সমস্যা সমাধান', createdAt: Date.now() - 3 * 86400000 },
    ];
    setSessions(seed);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startNewChat = useCallback(() => {
    const newId = `s_${Date.now()}`;
    setSessions(prev => [{ id: newId, title: 'নতুন চ্যাট', createdAt: Date.now() }, ...prev]);
    setActiveSessionId(newId);
    setMessages([]);
    setSidebarOpen(false);
  }, []);

  const recentSessions = sessions.filter(
    s => Date.now() - s.createdAt < HISTORY_RETENTION_DAYS * 86400000
  );

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!inputValue.trim() && !attachedFile) || isLoading) return;

    const userMessage = {
      role: 'user',
      content: inputValue,
      file: attachedFile?.name || null,
    };

    const updated = [...messages, userMessage];
    setMessages(updated);
    setInputValue('');
    setAttachedFile(null);
    setIsLoading(true);

    // শুধু শেষ ১০টা মেসেজ মেমোরিতে রাখা হয় — প্রম্পট পাঠানোর সময় এটাই কনটেক্সট
    const contextWindow = updated.slice(-MAX_MEMORY_MESSAGES);

    try {
      const apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...contextWindow.map(m => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: apiMessages,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `সার্ভার এরর: ${response.status}`);
      }

      const data = await response.json();
      const aiContent =
        data?.choices?.[0]?.message?.content || 'দুঃখিত, উত্তর পাওয়া যায়নি।';

      setMessages(prev => [...prev, { role: 'assistant', content: aiContent }]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `❌ সংযোগে সমস্যা: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const colors = isDark
    ? {
        bg: '#000000',
        bgGradient: 'radial-gradient(ellipse at 20% 0%, #0a0a0a 0%, #000000 60%)',
        text: '#E8E8E6',
        textMuted: '#7a7a78',
        surface: '#0f0f0f',
        surfaceHover: '#1a1a1a',
        border: '#1f1f1f',
        bubbleUser: '#1c1c1c',
        accent: '#E8E8E6',
      }
    : {
        bg: '#F4F1EA',
        bgGradient: 'radial-gradient(ellipse at 20% 0%, #FAF8F2 0%, #F4F1EA 60%)',
        text: '#2b2825',
        textMuted: '#8a8378',
        surface: '#FFFFFF',
        surfaceHover: '#ECE8DF',
        border: '#E2DDD0',
        bubbleUser: '#EDE8DC',
        accent: '#2b2825',
      };

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        background: colors.bgGradient,
        color: colors.text,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        overflow: 'hidden',
        transition: 'background 0.4s ease, color 0.4s ease',
      }}
    >
      {/* ---- Sidebar ---- */}
      <div
        style={{
          position: sidebarOpen ? 'fixed' : 'relative',
          zIndex: 30,
          width: sidebarOpen ? '78vw' : 0,
          maxWidth: 280,
          height: '100%',
          background: colors.surface,
          borderRight: sidebarOpen ? `1px solid ${colors.border}` : 'none',
          overflow: 'hidden',
          transition: 'width 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: colors.textMuted, letterSpacing: 0.5 }}>
            গত ৩০ দিন
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {recentSessions.map(s => (
            <button
              key={s.id}
              onClick={() => { setActiveSessionId(s.id); setMessages([]); setSidebarOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                marginBottom: 2,
                borderRadius: 8,
                border: 'none',
                background: activeSessionId === s.id ? colors.surfaceHover : 'transparent',
                color: colors.text,
                fontSize: 14,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 20 }}
        />
      )}

      {/* ---- Main ---- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label="থিম পরিবর্তন করুন"
            style={{
              background: 'none',
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: 7,
              color: colors.text,
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={startNewChat}
              aria-label="নতুন চ্যাট"
              style={{
                background: 'none',
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: 7,
                color: colors.text,
                cursor: 'pointer',
                display: 'flex',
              }}
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="ইতিহাস দেখুন"
              style={{
                background: 'none',
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: 7,
                color: colors.text,
                cursor: 'pointer',
                display: 'flex',
              }}
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          {messages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: colors.textMuted, fontSize: 14 }}>কিছু জিজ্ঞেস করুন...</p>
            </div>
          ) : (
            <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 12 }}>
              {messages.map((msg, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '82%',
                      padding: '11px 15px',
                      borderRadius: 16,
                      background: msg.role === 'user' ? colors.bubbleUser : 'transparent',
                      fontSize: 14.5,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.file && (
                      <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
                        📎 {msg.file}
                      </div>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '11px 15px', color: colors.textMuted, fontSize: 14 }}>
                    <span style={{ animation: 'pulse 1.4s ease-in-out infinite' }}>লিখছে...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px 22px' }}>
          <form onSubmit={handleSubmit} style={{ maxWidth: 720, margin: '0 auto' }}>
            {attachedFile && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  color: colors.textMuted,
                  marginBottom: 8,
                  padding: '6px 10px',
                  background: colors.surface,
                  borderRadius: 8,
                  width: 'fit-content',
                }}
              >
                📎 {attachedFile.name}
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', display: 'flex' }}
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 20,
                padding: '8px 8px 8px 18px',
              }}
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="কিছু লিখুন..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: colors.text,
                  fontSize: 15,
                  padding: '8px 0',
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="ফাইল আপলোড করুন"
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  padding: 8,
                  display: 'flex',
                }}
              >
                <Paperclip size={18} />
              </button>
              <button
                type="submit"
                disabled={isLoading || (!inputValue.trim() && !attachedFile)}
                style={{
                  background: colors.accent,
                  border: 'none',
                  borderRadius: '50%',
                  width: 34,
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.bg,
                  cursor: 'pointer',
                  opacity: (isLoading || (!inputValue.trim() && !attachedFile)) ? 0.3 : 1,
                  flexShrink: 0,
                }}
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        ::selection { background: ${colors.textMuted}; color: ${colors.bg}; }
      `}</style>
    </div>
  );
};

export default NobitaChat;
        
