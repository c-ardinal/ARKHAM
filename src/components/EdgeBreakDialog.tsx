import { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface EdgeBreakDialogProps {
  isOpen: boolean;
  edgeCount: number;
  onConfirm: (strategy: 'delete' | 'replace-jump') => void;
  onCancel: () => void;
}

export function EdgeBreakDialog({ isOpen, edgeCount, onConfirm, onCancel }: EdgeBreakDialogProps) {
  const { t } = useTranslation();
  const [strategy, setStrategy] = useState<'delete' | 'replace-jump'>('delete');

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm(strategy);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel, onConfirm, strategy]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" role="dialog" aria-modal="true" aria-labelledby="edge-break-title">
      <div className="bg-card border border-border rounded-lg shadow-xl p-6 w-[480px] max-w-full">
        <h2 id="edge-break-title" className="text-lg font-bold mb-2 text-card-foreground">
          {t('moveNodesToTab.edgeBreakTitle' as any)}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t('moveNodesToTab.edgeBreakBody' as any).replace('{n}', String(edgeCount))}
        </p>
        <div className="space-y-2 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="strategy"
              checked={strategy === 'delete'}
              onChange={() => setStrategy('delete')}
            />
            <span>{t('moveNodesToTab.choiceDelete' as any)}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="strategy"
              checked={strategy === 'replace-jump'}
              onChange={() => setStrategy('replace-jump')}
            />
            <span>{t('moveNodesToTab.choiceReplaceJump' as any)}</span>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
          >
            {t('common.cancel' as any)}
          </button>
          <button
            onClick={() => onConfirm(strategy)}
            className="min-h-[44px] px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
          >
            {t('common.confirm' as any)}
          </button>
        </div>
      </div>
    </div>
  );
}
