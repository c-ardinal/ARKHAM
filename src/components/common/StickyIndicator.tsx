import { memo } from 'react';
import { StickyNote } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export const StickyIndicator = memo(() => {
  const { t } = useTranslation();
  const label = t('common.hasStickyNotes') || 'Has Sticky Notes';
  return (
    <div
      className="absolute -top-5 -right-5 w-7 h-7 bg-yellow-400 text-yellow-900 rounded-sm flex items-center justify-center shadow-md border border-yellow-600 rotate-6"
      role="img"
      aria-label={label}
      title={label}
    >
      <StickyNote size={14} aria-hidden="true" />
    </div>
  );
});

StickyIndicator.displayName = 'StickyIndicator';
