"use client";

import ReactMarkdown from "react-markdown";
import { isKnowledgePath, knowledgeHref } from "@/lib/app-links";

export function MarkdownView({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  if (!content.trim()) {
    return (
      <p className={`text-xs text-matos-muted2 ${className}`}>No content.</p>
    );
  }

  return (
    <div
      className={`matos-md text-xs leading-relaxed text-matos-muted ${className}`}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mb-2 text-sm font-semibold tracking-tight text-matos-text">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-1.5 mt-3 text-[13px] font-semibold text-matos-text">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-2 text-xs font-semibold text-matos-text">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-2 list-disc space-y-1 pl-4">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-decimal space-y-1 pl-4">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          a: ({ href, children }) => {
            const resolved =
              href && isKnowledgePath(href) ? knowledgeHref(href) : href;
            return (
              <a
                href={resolved}
                className="text-matos-citron underline-offset-2 hover:underline"
                target={resolved?.startsWith("http") ? "_blank" : undefined}
                rel={resolved?.startsWith("http") ? "noreferrer" : undefined}
              >
                {children}
              </a>
            );
          },
          code: ({ children }) => (
            <code className="rounded bg-matos-bg px-1 py-0.5 font-mono text-[11px] text-matos-citron">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="mb-2 overflow-auto rounded-lg border border-matos-soft bg-matos-bg p-2 font-mono text-[11px]">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="mb-2 overflow-auto">
              <table className="w-full border-collapse text-left text-[11px]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-matos-soft px-2 py-1 font-medium text-matos-muted2">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-matos-soft/60 px-2 py-1">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-2 border-matos-citron/40 pl-2 text-matos-muted">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-matos-soft" />,
          strong: ({ children }) => (
            <strong className="font-semibold text-matos-text">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
