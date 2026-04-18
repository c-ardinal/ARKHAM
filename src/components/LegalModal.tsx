import { useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useLocalizedMarkdown } from '../hooks/useLocalizedMarkdown';
import { X, FileText, Shield } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export type LegalDocumentType = 'terms' | 'privacy';

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentType: LegalDocumentType;
}

const DOCUMENT_CONFIG: Record<LegalDocumentType, { file: string; titleKey: 'terms' | 'privacy'; icon: typeof FileText }> = {
    terms: { file: 'Terms.md', titleKey: 'terms', icon: FileText },
    privacy: { file: 'Privacy.md', titleKey: 'privacy', icon: Shield },
};

export const LegalModal = ({ isOpen, onClose, documentType }: LegalModalProps) => {
    const { t } = useTranslation();
    const config = DOCUMENT_CONFIG[documentType];
    const markdown = useLocalizedMarkdown(config.file);
    const Icon = config.icon;

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-modal-title"
            onClick={onClose}
        >
            <div
                className="bg-card text-card-foreground w-full max-w-3xl max-h-[85vh] rounded-lg shadow-xl flex flex-col border border-border"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 id="legal-modal-title" className="text-xl font-bold flex items-center gap-2">
                        <Icon size={24} aria-hidden="true" />
                        {t(`menu.${config.titleKey}` as const)}
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label={t('common.close')}
                        className="p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                    <ReactMarkdown
                        components={{
                            h1: (props) => <h1 className="text-2xl font-bold mb-2 text-foreground" {...props} />,
                            h2: (props) => <h2 className="text-lg font-bold mt-6 mb-2 pb-1 border-b border-border text-primary" {...props} />,
                            h3: (props) => <h3 className="text-base font-bold mt-4 mb-1 text-foreground/90" {...props} />,
                            ul: (props) => <ul className="list-disc list-outside ml-5 mb-4 space-y-1 text-sm text-muted-foreground" {...props} />,
                            ol: (props) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-1 text-sm text-muted-foreground" {...props} />,
                            li: (props) => <li className="pl-1" {...props} />,
                            p: (props) => <p className="mb-3 text-sm text-muted-foreground leading-relaxed" {...props} />,
                            a: (props) => <a className="text-primary underline hover:opacity-80" target="_blank" rel="noopener noreferrer" {...props} />,
                            code: (props) => <code className="px-1 py-0.5 rounded bg-muted text-foreground font-mono text-xs" {...props} />,
                            strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
                        }}
                    >
                        {markdown}
                    </ReactMarkdown>
                </div>

                <div className="p-4 border-t border-border flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};
