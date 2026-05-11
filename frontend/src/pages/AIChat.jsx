import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Trash2,
  User,
  Wand2,
} from 'lucide-react';

const STORAGE_KEY = 'seo_pro_gpt_chat_messages';

const modePrompts = {
  balanced: `You are a helpful GPT assistant. Answer in the user's language, be clear, practical, and concise unless the task needs depth.`,
  seo: `You are a senior SEO strategist and content consultant. Give specific, prioritized SEO advice with examples, keyword intent, content structure, and implementation steps.`,
  code: `You are a senior software engineering assistant. Help with architecture, debugging, implementation details, and code explanations. Be precise and practical.`,
  creative: `You are a creative writing and ideation partner. Offer fresh angles, polished wording, and useful variations while staying grounded in the user's goal.`,
};

const quickPrompts = [
  'Lập kế hoạch SEO 30 ngày cho website mới',
  'Viết outline bài blog chuẩn SEO về AI marketing',
  'Phân tích search intent cho từ khóa "dịch vụ SEO"',
  'Tạo checklist technical SEO trước khi publish',
];

function createMessage(role, content) {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function loadStoredMessages() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export default function AIChat() {
  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('balanced');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const scrollRef = useRef(null);
  const abortRef = useRef(null);

  const hasMessages = messages.length > 0;
  const canSend = input.trim() && !streaming;

  const requestMessages = useMemo(
    () => messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map(({ role, content }) => ({ role, content })),
    [messages]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const updateAssistantMessage = (id, content) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, content } : message))
    );
  };

  const handleSend = async (text = input, history = requestMessages) => {
    const cleanText = text.trim();
    if (!cleanText || streaming) return;

    const userMessage = createMessage('user', cleanText);
    const assistantMessage = createMessage('assistant', '');
    const nextMessages = [...history, { role: 'user', content: cleanText }];

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput('');
    setStreaming(true);
    setError('');

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantContent = '';

    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBase}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          systemPrompt: modePrompts[mode],
          temperature: mode === 'creative' ? 0.85 : 0.7,
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Không gửi được tin nhắn');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          const eventName = event
            .split('\n')
            .find((line) => line.startsWith('event: '))
            ?.slice(7);
          const data = event
            .split('\n')
            .filter((line) => line.startsWith('data: '))
            .map((line) => line.slice(6))
            .join('\n');

          if (!data) continue;
          if (data === '[DONE]') {
            setStreaming(false);
            return;
          }

          const parsed = JSON.parse(data);
          if (eventName === 'error') {
            throw new Error(parsed.error || 'GPT chat stream error');
          }

          if (parsed.content) {
            assistantContent += parsed.content;
            updateAssistantMessage(assistantMessage.id, assistantContent);
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        if (!assistantContent) {
          setMessages((current) => current.filter((message) => message.id !== assistantMessage.id));
        }
      } else {
        setError(err.message || 'Có lỗi khi chat với GPT');
        updateAssistantMessage(
          assistantMessage.id,
          'Mình chưa tạo được phản hồi vì API trả về lỗi. Vui lòng kiểm tra lại cấu hình hoặc thử gửi lại.'
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError('');
    setStreaming(false);
  };

  const copyMessage = async (message) => {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(''), 1800);
  };

  const retryLast = () => {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastUserMessage || streaming) return;

    const lastUserIndex = messages.map((message) => message.id).lastIndexOf(lastUserMessage.id);
    const history = messages
      .slice(0, lastUserIndex)
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map(({ role, content }) => ({ role, content }));

    setMessages(messages.slice(0, lastUserIndex));
    handleSend(lastUserMessage.content, history);
  };

  return (
    <div className="animate-fadeIn space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare size={24} className="text-indigo-500" />
            Chat GPT
          </h1>
          <p className="text-slate-500 text-sm mt-1">Trò chuyện trực tiếp với cx/gpt-5.5</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={retryLast}
            disabled={!hasMessages || streaming}
            className="btn-outline text-sm"
          >
            <RefreshCw size={15} />
            Tạo lại
          </button>
          <button
            type="button"
            onClick={clearChat}
            disabled={!hasMessages && !streaming}
            className="btn-secondary text-sm"
          >
            <Trash2 size={15} />
            Chat mới
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Lỗi:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
        <section className="card flex h-[calc(100vh-13rem)] min-h-[560px] flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {!hasMessages ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center shadow-sm mb-4">
                  <Sparkles size={24} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Bắt đầu một cuộc trò chuyện</h2>
                <p className="text-sm text-slate-500 mt-2 max-w-md">
                  Hỏi về SEO, content, code, chiến lược hoặc bất kỳ việc nào cần GPT hỗ trợ.
                </p>
                <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:border-primary-200 hover:bg-primary-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((message) => {
                  const isUser = message.role === 'user';
                  const isCopied = copiedId === message.id;

                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="mt-1 h-8 w-8 flex-shrink-0 rounded-lg bg-indigo-50 flex items-center justify-center">
                          <Bot size={17} className="text-indigo-600" />
                        </div>
                      )}
                      <div className={`max-w-[86%] ${isUser ? 'order-first' : ''}`}>
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            isUser
                              ? 'bg-primary-600 text-white rounded-br-md'
                              : 'bg-slate-100 text-slate-700 rounded-bl-md'
                          }`}
                        >
                          {message.content || (
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <span className="typing-dot" />
                              <span className="typing-dot" />
                              <span className="typing-dot" />
                            </span>
                          )}
                        </div>
                        {!isUser && message.content && (
                          <button
                            type="button"
                            onClick={() => copyMessage(message)}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600"
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            {isCopied ? 'Đã copy' : 'Copy'}
                          </button>
                        )}
                      </div>
                      {isUser && (
                        <div className="mt-1 h-8 w-8 flex-shrink-0 rounded-lg bg-primary-600 flex items-center justify-center">
                          <User size={16} className="text-white" />
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={scrollRef} />
              </div>
            )}
          </div>

          <form onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }} className="border-t border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-100">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="Nhập tin nhắn..."
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white transition-colors hover:bg-slate-700"
                  title="Dừng tạo"
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSend}
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Gửi"
                >
                  <Send size={17} />
                </button>
              )}
            </div>
          </form>
        </section>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 size={16} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-800">Chế độ</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {[
                ['balanced', 'Cân bằng'],
                ['seo', 'SEO'],
                ['code', 'Code'],
                ['creative', 'Sáng tạo'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                    mode === key
                      ? 'border-primary-200 bg-primary-50 text-primary-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bot size={16} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-800">Model</h2>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <div className="text-sm font-semibold text-slate-800">cx/gpt-5.5</div>
              <div className="text-xs text-slate-500 mt-0.5">9router API</div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Loader2 size={16} className={streaming ? 'animate-spin text-indigo-500' : 'text-slate-400'} />
              <h2 className="text-sm font-semibold text-slate-800">Trạng thái</h2>
            </div>
            <div className="text-sm text-slate-600">
              {streaming ? 'Đang tạo phản hồi...' : `${messages.filter((message) => message.role === 'user').length} lượt hỏi`}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
