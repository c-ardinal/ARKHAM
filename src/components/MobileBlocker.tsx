import { Monitor, Smartphone } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export const MobileBlocker = () => {
  const { t, tf } = useTranslation();

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background p-6 md:hidden text-center">
      <div className="mb-8 relative flex items-center justify-center">
        <div className="relative">
          <Smartphone className="w-24 h-24 text-muted-foreground/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-1 bg-destructive rotate-45 rounded-full" />
          </div>
        </div>
      </div>
      
      <h2 className="text-2xl font-bold mb-4 text-foreground">
        {t('mobileBlocker.title')}
      </h2>
      
      <p className="text-muted-foreground max-w-xs mx-auto leading-relaxed mb-8">
        {tf('mobileBlocker.message')}
      </p>
      
      <div className="flex items-center gap-3 px-6 py-3 bg-secondary/50 rounded-full text-secondary-foreground">
        <Monitor className="w-5 h-5" />
        <span className="font-medium">{t('mobileBlocker.recommendation')}</span>
      </div>
    </div>
  );
};
