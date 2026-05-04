import { useTranslation } from '../hooks/useTranslation';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export const LoadingOverlay = ({ isLoading, message }: LoadingOverlayProps) => {
  const { t } = useTranslation();
  // Fall back to the i18n key so the default is always localised (H-A3).
  const displayMessage = message ?? t('common.loading');

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[2000]">
      <div className="bg-card border border-border rounded-lg shadow-xl p-8 flex flex-col items-center gap-4">
        {/* スピナー */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>

        {/* メッセージ */}
        <p className="text-lg font-medium text-foreground">{displayMessage}</p>
      </div>
    </div>
  );
};
