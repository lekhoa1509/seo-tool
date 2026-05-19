import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Download,
  FileDown,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Trash2,
  User,
  Wand2,
  X,
} from 'lucide-react';
import ChatMarkdown from '../components/ChatMarkdown.jsx';
import DocumentDrawer from '../components/DocumentDrawer.jsx';

const STORAGE_KEY = 'seo_pro_gpt_chat_messages_v2';
const MODEL_KEY = 'seo_pro_gpt_chat_model';
const MODE_KEY = 'seo_pro_gpt_chat_mode';

const MODELS = [
  {
    id: 'cx/gpt-5.5',
    label: 'GPT-5.5',
    sub: 'cx/gpt-5.5',
    description: 'Tốc độ nhanh, đa năng',
  },
  {
    id: 'kr/claude-opus-4.7',
    label: 'Claude Opus 4.7',
    sub: 'kr/claude-opus-4.7',
    description: 'Lý luận sâu, viết dài',
  },
];

const MODES = [
  { id: 'balanced', label: 'Cân bằng' },
  { id: 'seo', label: 'SEO' },
  { id: 'code', label: 'Code' },
  { id: 'creative', label: 'Sáng tạo' },
];

const MODE_PROMPTS = {
  balanced: `You are a helpful AI assistant. Answer in the user's language. Be clear, practical, and concise unless the task requires depth. Use markdown (headings, bullet lists, tables, code fences) to organize answers. When the user attaches files or images, read them carefully and reference their content.`,
  seo: `You are a senior SEO strategist and content consultant. Give specific, prioritized SEO advice with examples, keyword intent, content structure, and implementation steps. Use markdown for structure (headings, lists, tables). Read any attached files or images carefully.`,
  code: `You are a senior software engineering assistant. Help with architecture, debugging, implementation details, and code explanations. Be precise and practical. Always wrap code in fenced markdown blocks with language tags. Read attached source files thoroughly before answering.`,
  creative: `You are a creative writing and ideation partner. Offer fresh angles, polished wording, and useful variations while staying grounded in the user's goal. Use markdown for clarity.`,
};

const QUICK_PROMPTS = [
  'Lập kế hoạch SEO 30 ngày cho website mới',
  'Viết outline bài blog chuẩn SEO về AI marketing',
  'Phân tích search intent cho từ khóa "dịch vụ SEO"',
  'Tạo checklist technical SEO trước khi publish',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function loadStoredMessages() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function fileSizeText(size) {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function buildOutgoingContent(text, attachments) {
  const trimmed = text.trim();
  const hasAttachments = attachments?.length > 0;

  if (!hasAttachments) {
    return trimmed;
  }

  const parts = [];
  const textBlocks = [];
  if (trimmed) textBlocks.push(trimmed);

  attachments.forEach((file) => {
    if (file.kind === 'text') {
      textBlocks.push(
        `\n\n--- File: ${file.name} (${file.mimeType}) ---\n${file.content}${file.truncated ? '\n... [truncated]' : ''}`
      );
    }
  });

  if (textBlocks.length) {
    parts.push({ type: 'text', text: textBlocks.join('') });
  }

  attachments
    .filter((file) => file.kind === 'image')
    .forEach((file) => {
      parts.push({
        type: 'image_url',
        image_url: { url: file.dataUrl },
      });
    });

  if (parts.length === 1 && parts[0].type === 'text') {
    return parts[0].text;
  }

  return parts;
}

function toRequestMessage(message) {
  const display = message.displayContent;
  if (typeof display === 'string') {
    return { role: message.role, content: display };
  }

  if (Array.isArray(display)) {
    return { role: message.role, content: display };
  }

  return { role: message.role, content: message.content || '' };
}

function buildRequestHistory(messages) {
  return messages
    .filter((message) => (message.role === 'user' || message.role === 'assistant') && (message.content || message.displayContent))
    .map(toRequestMessage);
}

export default function AIChat() {
  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState(() => loadStored(MODE_KEY, 'balanced'));
  const [model, setModel] = useState(() => loadStored(MODEL_KEY, MODELS[0].id));
  const [attachments, setAttachments] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [activeDocument, setActiveDocument] = useState(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState('');
  const [documentBusyId, setDocumentBusyId] = useState('');

  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const fileInputRef = useRef(null);

  const hasMessages = messages.length > 0;
  const canSend = (input.trim() || attachments.length) && !streaming && !generatingImage;
  const activeModel = MODELS.find((entry) => entry.id === model) || MODELS[0];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(MODEL_KEY, JSON.stringify(model));
  }, [model]);

  useEffect(() => {
    localStorage.setItem(MODE_KEY, JSON.stringify(mode));
  }, [mode]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming, generatingImage]);

  const apiBase = import.meta.env.VITE_API_URL || '';

  const updateMessage = (id, updater) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...updater(message) } : message))
    );
  };

  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File quá lớn: ${file.name} (tối đa 10MB)`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`${apiBase}/api/chat/upload`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Không upload được file');
        }

        setAttachments((current) => [...current, { ...data, id: uid() }]);
        setError('');
      } catch (err) {
        setError(err.message || 'Upload thất bại');
      }
    }
  };

  const removeAttachment = (id) => {
    setAttachments((current) => current.filter((item) => item.id !== id));
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setAttachments([]);
    setError('');
    setStreaming(false);
  };

  const copyMessage = async (message) => {
    const text = typeof message.content === 'string' ? message.content : message.text || '';
    await navigator.clipboard.writeText(text);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(''), 1500);
  };

  const exportToDocx = async (message) => {
    if (!message?.content) return;
    setDocumentBusyId(message.id);
    setDocumentLoading(true);
    setDocumentError('');
    try {
      const firstLine = message.content.split('\n').find((line) => line.trim());
      const title = firstLine
        ? firstLine.replace(/^#+\s*/, '').slice(0, 80)
        : 'AI Document';

      const response = await fetch(`${apiBase}/api/documents/docx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: message.content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không tạo được .docx');

      setActiveDocument({
        ...data,
        content: message.content,
        title,
      });
    } catch (err) {
      setDocumentError(err.message);
      setActiveDocument({ title: 'Lỗi', content: '', fileName: '' });
    } finally {
      setDocumentLoading(false);
      setDocumentBusyId('');
    }
  };

  const closeDocument = () => {
    setActiveDocument(null);
    setDocumentError('');
  };

  const sendChat = async (overrideText, overrideAttachments) => {
    const text = (overrideText ?? input).trim();
    const filesToSend = overrideAttachments ?? attachments;

    if (!text && !filesToSend.length) return;
    if (streaming || generatingImage) return;

    const outgoingContent = buildOutgoingContent(text, filesToSend);

    const userMessage = {
      id: uid(),
      role: 'user',
      content: outgoingContent,
      displayContent: outgoingContent,
      text,
      attachments: filesToSend,
      createdAt: new Date().toISOString(),
    };

    const assistantId = uid();
    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      model,
      createdAt: new Date().toISOString(),
    };

    const history = buildRequestHistory(messages);
    const requestMessages = [...history, { role: 'user', content: outgoingContent }];

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput('');
    setAttachments([]);
    setStreaming(true);
    setError('');

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantContent = '';

    try {
      const response = await fetch(`${apiBase}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: requestMessages,
          systemPrompt: MODE_PROMPTS[mode],
          temperature: mode === 'creative' ? 0.85 : 0.7,
          max_tokens: 4000,
          model,
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

          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }

          if (eventName === 'error') {
            throw new Error(parsed.error || 'GPT chat stream error');
          }

          if (eventName === 'meta' && parsed.model) {
            updateMessage(assistantId, () => ({ model: parsed.model }));
            continue;
          }

          if (parsed.content) {
            assistantContent += parsed.content;
            updateMessage(assistantId, () => ({ content: assistantContent }));
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        updateMessage(assistantId, (current) => ({
          content: current.content || '_Đã dừng tạo phản hồi._',
        }));
      } else {
        setError(err.message || 'Đã xảy ra lỗi.');
        updateMessage(assistantId, (current) => ({
          content:
            current.content ||
            `> ⚠️ ${err.message || 'Mình chưa tạo được phản hồi vì API trả về lỗi.'}`,
        }));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendChat();
  };

  const retryLast = () => {
    const lastUserIndex = [...messages].map((m) => m.role).lastIndexOf('user');
    if (lastUserIndex < 0 || streaming) return;
    const lastUser = messages[lastUserIndex];

    const trimmed = messages.slice(0, lastUserIndex);
    setMessages(trimmed);
    sendChat(lastUser.text || '', lastUser.attachments || []);
  };

  const generateImage = async () => {
    const prompt = input.trim();
    if (!prompt || generatingImage || streaming) return;

    const userMessage = {
      id: uid(),
      role: 'user',
      content: prompt,
      displayContent: prompt,
      text: prompt,
      kind: 'image-request',
      createdAt: new Date().toISOString(),
    };

    const assistantId = uid();
    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      kind: 'image',
      content: '',
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput('');
    setGeneratingImage(true);
    setError('');

    try {
      const response = await fetch(`${apiBase}/api/chat/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Không tạo được ảnh');
      }

      updateMessage(assistantId, () => ({
        image: data.image,
        metadata: data.metadata,
        modelUsed: data.model,
        content: data.metadata?.caption || `Đã tạo ảnh cho: ${prompt}`,
      }));
    } catch (err) {
      setError(err.message);
      updateMessage(assistantId, () => ({
        content: `> ⚠️ ${err.message}`,
      }));
    } finally {
      setGeneratingImage(false);
    }
  };

  const renderUserContent = (message) => {
    const parts = [];
    if (message.text) {
      parts.push(<ChatMarkdown key="text">{message.text}</ChatMarkdown>);
    }
    if (message.attachments?.length) {
      parts.push(
        <div key="files" className="mt-2 flex flex-wrap gap-2">
          {message.attachments.map((file) => (
            <AttachmentChip key={file.id} file={file} compact />
          ))}
        </div>
      );
    }
    return parts;
  };

  return (
    <div className="animate-fadeIn space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <MessageSquare size={24} className="text-indigo-500" />
            Chat AI
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Trò chuyện, đọc file/ảnh và tạo ảnh ngay trong cửa sổ chat.
          </p>
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="card flex h-[calc(100vh-13rem)] min-h-[600px] flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {!hasMessages ? (
              <EmptyState
                onPrompt={(prompt) => sendChat(prompt, [])}
                modelLabel={activeModel.label}
              />
            ) : (
              <div className="space-y-5">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isCopied={copiedId === message.id}
                    onCopy={() => copyMessage(message)}
                    renderUserContent={renderUserContent}
                    onExportDocx={() => exportToDocx(message)}
                    exportingDocx={documentBusyId === message.id}
                    onOpenDocument={() => setActiveDocument({ ...activeDocument, ...message.document })}
                  />
                ))}
                <div ref={scrollRef} />
              </div>
            )}
          </div>

          <Composer
            input={input}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            attachments={attachments}
            onRemoveAttachment={removeAttachment}
            onAttachClick={handleAttachClick}
            onGenerateImage={generateImage}
            generatingImage={generatingImage}
            streaming={streaming}
            canSend={canSend}
            onStop={handleStop}
            modelLabel={activeModel.label}
          />

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFiles}
            accept="image/*,.txt,.md,.json,.csv,.html,.htm,.xml,.yml,.yaml,.js,.jsx,.ts,.tsx,.py,.go,.java,.rb,.rs,.php,.css,.scss,.vue,.svelte,.sql,.sh,.toml,.ini,.env,.log"
          />
        </section>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Bot size={16} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-800">Model</h2>
            </div>
            <div className="space-y-2">
              {MODELS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setModel(entry.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    model === entry.id
                      ? 'border-primary-200 bg-primary-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-semibold ${
                        model === entry.id ? 'text-primary-700' : 'text-slate-800'
                      }`}
                    >
                      {entry.label}
                    </span>
                    {model === entry.id && <Check size={14} className="text-primary-600" />}
                  </div>
                  <div className="text-xs text-slate-500">{entry.sub}</div>
                  <div className="mt-1 text-[11px] text-slate-400">{entry.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Wand2 size={16} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-800">Chế độ</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setMode(entry.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                    mode === entry.id
                      ? 'border-primary-200 bg-primary-50 text-primary-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Loader2
                size={16}
                className={
                  streaming || generatingImage ? 'animate-spin text-indigo-500' : 'text-slate-400'
                }
              />
              <h2 className="text-sm font-semibold text-slate-800">Trạng thái</h2>
            </div>
            <div className="text-sm text-slate-600">
              {streaming
                ? 'Đang tạo phản hồi...'
                : generatingImage
                ? 'Đang tạo ảnh...'
                : `${messages.filter((message) => message.role === 'user').length} lượt hỏi`}
            </div>
          </div>
        </aside>
      </div>
      <DocumentDrawer
        open={Boolean(activeDocument) || documentLoading}
        document={activeDocument}
        loading={documentLoading}
        error={documentError}
        onClose={closeDocument}
        apiBase={apiBase}
      />
    </div>
  );
}

function EmptyState({ onPrompt, modelLabel }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-indigo-700 shadow-sm">
        <Sparkles size={24} className="text-white" />
      </div>
      <h2 className="text-xl font-bold text-slate-800">Bắt đầu một cuộc trò chuyện</h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Đang dùng {modelLabel}. Đính kèm file/ảnh để AI phân tích, hoặc bấm nút ảnh để tạo hình minh họa.
      </p>
      <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPrompt(prompt)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:border-primary-200 hover:bg-primary-50"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message, isCopied, onCopy, renderUserContent, onExportDocx, exportingDocx }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex gap-3 justify-end">
        <div className="chat-bubble-user max-w-[86%]">
          <div className="rounded-2xl rounded-br-md bg-primary-600 px-4 py-3 text-sm leading-relaxed text-white">
            {renderUserContent(message)}
          </div>
        </div>
        <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-600">
          <User size={16} className="text-white" />
        </div>
      </div>
    );
  }

  const isImageMessage = message.kind === 'image';
  const isThinking = !message.content && !message.image;

  return (
    <div className="flex gap-3 justify-start">
      <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50">
        <Bot size={17} className="text-indigo-600" />
      </div>
      <div className="max-w-[86%] flex-1">
        <div className="rounded-2xl rounded-bl-md bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          {isThinking ? (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          ) : isImageMessage && message.image ? (
            <div className="space-y-2">
              {message.content && <ChatMarkdown>{message.content}</ChatMarkdown>}
              <img
                src={message.image}
                alt={message.metadata?.altText || 'Generated'}
                className="max-h-[420px] w-auto rounded-xl border border-slate-200"
              />
              <div className="flex flex-wrap gap-2 text-xs">
                <a
                  href={message.image}
                  download={message.metadata?.fileName || 'image.png'}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-50"
                >
                  <Download size={12} /> Tải ảnh
                </a>
                {message.modelUsed && (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-500">
                    {message.modelUsed}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <ChatMarkdown>{message.content}</ChatMarkdown>
          )}
        </div>
        {(message.content || message.image) && !isThinking && (
          <div className="mt-2 flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 font-medium text-slate-400 hover:text-slate-600"
            >
              {isCopied ? <Check size={12} /> : <Copy size={12} />}
              {isCopied ? 'Đã copy' : 'Copy'}
            </button>
            {!isImageMessage && message.content && onExportDocx && (
              <button
                type="button"
                onClick={onExportDocx}
                disabled={exportingDocx}
                className="inline-flex items-center gap-1.5 font-medium text-slate-400 hover:text-slate-600 disabled:opacity-50"
                title="Xuất tài liệu .docx"
              >
                {exportingDocx ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FileDown size={12} />
                )}
                Xuất .docx
              </button>
            )}
            {message.model && (
              <span className="text-slate-400">via {message.model}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentChip({ file, onRemove, compact }) {
  const isImage = file.kind === 'image';
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${
        compact
          ? 'border-white/30 bg-white/10 text-white'
          : 'border-slate-200 bg-white text-slate-700'
      }`}
    >
      {isImage ? (
        <img
          src={file.dataUrl}
          alt={file.name}
          className="h-8 w-8 rounded-md object-cover"
        />
      ) : (
        <FileText size={14} className={compact ? 'text-white' : 'text-slate-500'} />
      )}
      <div className="max-w-[160px] truncate font-medium">{file.name}</div>
      <span className={compact ? 'text-white/70' : 'text-slate-400'}>{fileSizeText(file.size)}</span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(file.id)}
          className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Bỏ file"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function Composer({
  input,
  onInputChange,
  onSubmit,
  attachments,
  onRemoveAttachment,
  onAttachClick,
  onGenerateImage,
  generatingImage,
  streaming,
  canSend,
  onStop,
  modelLabel,
}) {
  return (
    <form onSubmit={onSubmit} className="border-t border-slate-200 bg-white p-3 sm:p-4">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((file) => (
            <AttachmentChip key={file.id} file={file} onRemove={onRemoveAttachment} />
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-100">
        <button
          type="button"
          onClick={onAttachClick}
          disabled={streaming || generatingImage}
          className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
          title="Đính kèm file/ảnh"
        >
          <Paperclip size={16} />
        </button>
        <button
          type="button"
          onClick={onGenerateImage}
          disabled={!input.trim() || streaming || generatingImage}
          className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-pink-600 disabled:opacity-50"
          title="Tạo ảnh từ prompt"
        >
          {generatingImage ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
        </button>
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSubmit(event);
            }
          }}
          rows={1}
          className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
          placeholder={`Nhắn ${modelLabel} hoặc thả file vào đây...`}
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white transition-colors hover:bg-slate-700"
            title="Dừng tạo"
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Gửi"
          >
            <Send size={16} />
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-slate-400">
        <span>Enter để gửi · Shift+Enter xuống dòng · Đính kèm tối đa 10MB</span>
        <span>{modelLabel}</span>
      </div>
    </form>
  );
}
