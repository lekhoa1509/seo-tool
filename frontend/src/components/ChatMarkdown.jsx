import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';

function CodeBlock({ inline, className, children, ...props }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match?.[1] || 'text';
  const value = String(children).replace(/\n$/, '');

  if (inline) {
    return (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.85em] font-mono text-rose-600">
        {children}
      </code>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/70 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-white hover:text-slate-800"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Đã copy' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneLight}
        customStyle={{
          margin: 0,
          padding: '14px 16px',
          background: 'transparent',
          fontSize: 13,
          lineHeight: 1.55,
        }}
        wrapLongLines
        {...props}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}

export default function ChatMarkdown({ children }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          a: ({ node, ...props }) => (
            <a
              {...props}
              className="text-primary-600 underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            />
          ),
          table: ({ node, ...props }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border-t border-slate-100 px-3 py-2 text-slate-700" {...props} />
          ),
        }}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}
