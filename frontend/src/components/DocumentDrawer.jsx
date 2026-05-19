import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download, FileText, Loader2, RefreshCw, X } from 'lucide-react';

function WordCode({ inline, className, children, ...props }) {
  if (inline) {
    return (
      <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-rose-700">
        {children}
      </code>
    );
  }

  return (
    <pre className="my-3 overflow-x-auto rounded border border-slate-200 bg-slate-50 p-3 font-mono text-[12.5px] leading-snug text-slate-800">
      <code {...props}>{children}</code>
    </pre>
  );
}

function WordPreview({ title, content }) {
  return (
    <div className="word-page mx-auto bg-white shadow-[0_2px_18px_rgba(15,23,42,0.08)]">
      <div className="word-page-inner">
        {title && <h1 className="word-title">{title}</h1>}
        <div className="word-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: WordCode,
              a: ({ node, ...props }) => (
                <a {...props} target="_blank" rel="noreferrer" />
              ),
            }}
          >
            {content || ''}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export default function DocumentDrawer({
  open,
  document,
  loading,
  error,
  onClose,
  onRefresh,
  apiBase = '',
}) {
  if (!open) return null;

  const downloadHref = document
    ? `${apiBase}${document.downloadUrl || `/api/documents/${document.id}/download`}`
    : null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px] lg:hidden"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-slate-100 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <FileText size={16} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800">
                {document?.title || document?.fileName || 'Tài liệu'}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">
                Microsoft Word · {document?.fileName?.split('.').pop()?.toUpperCase() || 'DOCX'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {downloadHref && (
              <a
                href={downloadHref}
                download={document?.fileName || 'document.docx'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
              >
                <Download size={13} /> Tải .docx
              </a>
            )}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200"
                title="Tạo lại"
              >
                <RefreshCw size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200"
              title="Đóng"
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto bg-slate-200/60 px-6 py-8">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              <Loader2 size={16} className="mr-2 animate-spin" />
              Đang dựng tài liệu...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : document?.content ? (
            <WordPreview title={document.title} content={document.content} />
          ) : (
            <div className="text-sm text-slate-500">Không có nội dung để hiển thị.</div>
          )}
        </div>
      </aside>
    </>
  );
}
