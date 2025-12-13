import { useTranslation } from '../hooks/useTranslation';
import { useLocalizedMarkdown } from '../hooks/useLocalizedMarkdown';
import { X, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface UpdateHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UpdateHistoryModal = ({ isOpen, onClose }: UpdateHistoryModalProps) => {
    const { t } = useTranslation();
    const markdown = useLocalizedMarkdown('/ChangeLog.md');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div 
                className="bg-card text-card-foreground w-full max-w-2xl max-h-[80vh] rounded-lg shadow-xl flex flex-col border border-border"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Clock size={24} />
                        {t('menu.updateHistory')}
                    </h2>
                    <button 
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                     <ReactMarkdown 
                        components={{
                            h1: ({node, ...props}) => <h1 className="hidden" {...props} />, // Hide the standard "# ChangeLog" title as we have the modal header
                            h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-6 mb-2 pb-1 border-b border-border text-primary" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-sm font-bold mt-3 mb-1 text-foreground/80 uppercase tracking-wider" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 mb-4 space-y-1 text-sm text-muted-foreground" {...props} />,
                            li: ({node, ...props}) => <li className="pl-1" {...props} />,
                            p: ({node, ...props}) => <p className="mb-2 text-sm text-muted-foreground" {...props} />,
                        }}
                    >
                        {markdown}
                    </ReactMarkdown>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};
