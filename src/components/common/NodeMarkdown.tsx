import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { substituteVariables } from '../../utils/textUtils';
import { useAllVariables } from '../../store/scenarioStore';

interface NodeMarkdownProps {
  content?: string;
  className?: string;
  inline?: boolean;
}

export const NodeMarkdown: React.FC<NodeMarkdownProps> = memo(({
  content = '',
  className = '',
  inline = false,
}) => {
  const variables = useAllVariables();
  if (!content) return null;

  const resolvedText = substituteVariables(content, variables);

  return (
    <div className={`node-markdown prose dark:prose-invert max-w-none text-inherit leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, ...props }) => (
            inline ? (
              <span className="inline" {...props} />
            ) : (
              <p className="mb-1 last:mb-0 leading-snug break-words" {...props} />
            )
          ),
          h1: ({ node, ...props }) => <h1 className="text-base font-bold my-1 text-inherit" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-sm font-bold my-1 text-inherit" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-xs font-bold my-0.5 text-inherit" {...props} />,
          h4: ({ node, ...props }) => <h4 className="text-xs font-semibold my-0.5 text-inherit" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-0.5 my-1 pl-1 text-inherit text-xs" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-0.5 my-1 pl-1 text-inherit text-xs" {...props} />,
          li: ({ node, ...props }) => <li className="break-words leading-tight" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-bold text-inherit" {...props} />,
          em: ({ node, ...props }) => <em className="italic text-inherit" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-2 border-primary/60 pl-2 my-1 italic opacity-85 text-xs" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-1 max-w-full">
              <table className="min-w-full border-collapse border border-border/80 text-[11px] leading-tight" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-muted/70 font-semibold" {...props} />,
          tbody: ({ node, ...props }) => <tbody className="divide-y divide-border/50" {...props} />,
          tr: ({ node, ...props }) => <tr className="border-b border-border/60 hover:bg-muted/30 transition-colors" {...props} />,
          th: ({ node, ...props }) => <th className="border border-border/70 px-2 py-1 text-left font-bold text-inherit" {...props} />,
          td: ({ node, ...props }) => <td className="border border-border/60 px-2 py-0.5 text-inherit" {...props} />,
          code: ({ node, inline: isInline, ...props }: any) => (
            isInline ? (
              <code className="bg-muted/80 px-1 py-0.5 rounded text-[0.85em] font-mono text-inherit border border-border/50" {...props} />
            ) : (
              <pre className="bg-muted/90 p-1.5 rounded text-[11px] font-mono overflow-x-auto my-1 border border-border/60 text-inherit">
                <code {...props} />
              </pre>
            )
          ),
          a: ({ node, ...props }) => (
            <a
              className="text-primary underline hover:opacity-80"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              {...props}
            />
          ),
          hr: () => <hr className="my-1.5 border-border/60" />,
        }}
      >
        {resolvedText}
      </ReactMarkdown>
    </div>
  );
});

NodeMarkdown.displayName = 'NodeMarkdown';
