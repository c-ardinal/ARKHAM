import { useTranslation } from '../hooks/useTranslation';
import { useLocalizedMarkdown } from '../hooks/useLocalizedMarkdown';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualModal = ({ isOpen, onClose }: ManualModalProps) => {
  const { t } = useTranslation();
  const markdown = useLocalizedMarkdown('/Manual.md');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" className="rounded-lg shadow-xl w-full max-w-[800px] max-h-[85vh] flex flex-col bg-card border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold text-card-foreground">{t('manual.title')}</h2>
          <button onClick={onClose} className="hover:text-muted-foreground text-muted-foreground/80">
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
             <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4 pb-2 border-b border-border text-foreground" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-8 mb-3 text-primary" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-6 mb-2 text-foreground" {...props} />,
                    p: ({node, ...props}) => <p className="mb-4 leading-relaxed text-muted-foreground" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc list-outside ml-5 mb-4 space-y-1 text-muted-foreground" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-1 text-muted-foreground" {...props} />,
                    li: ({node, ...props}) => <li className="pl-1" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                    table: ({node, ...props}) => <table className="w-full border-collapse border border-border mb-6 text-sm" {...props} />,
                    thead: ({node, ...props}) => <thead className="bg-muted" {...props} />,
                    th: ({node, ...props}) => <th className="border border-border p-3 font-bold text-left text-foreground" {...props} />,
                    td: ({node, ...props}) => <td className="border border-border p-3 text-muted-foreground" {...props} />,
                    code: ({node, ...props}) => <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-sm text-foreground" {...props} />,
                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary/30 pl-4 py-1 my-4 italic text-muted-foreground" {...props} />,
                }}
             >
                {markdown}
             </ReactMarkdown>
        </div>

        <div className="p-4 border-t flex justify-end border-border bg-card rounded-b-lg">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded transition-colors bg-secondary hover:bg-secondary/80 text-secondary-foreground"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
