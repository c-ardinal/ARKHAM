
import React from 'react';
import { Plus, Minus, Maximize } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface ZoomControlsProps {
    currentZoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onSetZoom: (zoom: number) => void;
    onFitView: () => void;
    className?: string;
    showFitView?: boolean; // Sometimes FitView is separate
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
    currentZoom,
    onZoomIn,
    onZoomOut,
    onSetZoom,
    onFitView,
    className = "",
    showFitView = false
}) => {
    const { t } = useTranslation();

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <div className="flex items-center gap-2">
                <button 
                    onClick={(e) => { e.stopPropagation(); onZoomOut(); }}
                    className="p-1.5 md:p-2 hover:bg-accent rounded flex items-center justify-center transition-colors touch-manipulation"
                    title={t('menu.zoomOut')}
                >
                    <Minus size={16}/>
                </button>
                <input
                    type="number"
                    value={currentZoom}
                    onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        const clampedValue = Math.max(1, Math.min(200, value));
                        onSetZoom(clampedValue);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 text-center text-sm font-mono min-w-[60px] bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
                    min="1"
                    max="200"
                />
                <button 
                    onClick={(e) => { e.stopPropagation(); onZoomIn(); }}
                    className="p-1.5 md:p-2 hover:bg-accent rounded flex items-center justify-center transition-colors touch-manipulation"
                    title={t('menu.zoomIn')}
                >
                    <Plus size={16}/>
                </button>
            </div>
            {showFitView && (
                 <>
                    <div className="h-px bg-border my-1" />
                    <button 
                        onClick={(e) => { e.stopPropagation(); onFitView(); }}
                        className="w-full text-left p-2 hover:bg-accent rounded flex items-center gap-2 text-sm touch-manipulation"
                    >
                        <Maximize size={16}/> {t('menu.fitView')}
                    </button>
                </>
            )}
        </div>
    );
};
