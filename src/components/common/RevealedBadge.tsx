import { memo } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export const RevealedBadge = memo(() => {
  const { t } = useTranslation();
  const label = t('common.revealed') || 'Revealed';
  return (
    <div
      className="absolute -top-2 -left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm z-10 border-2 border-background"
      role="img"
      aria-label={label}
      title={label}
    >
      <Check size={14} strokeWidth={3} className="text-white" aria-hidden="true" />
    </div>
  );
});

RevealedBadge.displayName = 'RevealedBadge';
