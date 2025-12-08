import React from 'react';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { Plus, Trash2, GripVertical, Package } from 'lucide-react';
import { getIconForResourceType } from '../utils/iconUtils';
import type { ResourceType } from '../types';

interface ResourceListProps {
    onMobileDragStart?: (e: React.TouchEvent, id: string) => void;
    onEdit?: () => void;
}

export const ResourceList = React.memo(({ onMobileDragStart, onEdit }: ResourceListProps) => {
  const { t } = useTranslation();
  const { resources, addResource, deleteResource, setSelectedNode, selectedNodeId, mode } = useScenarioStore();
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = (e: React.TouchEvent, id: string) => {
      if (mode === 'play' || !onMobileDragStart) return;
      longPressTimer.current = setTimeout(() => {
          onMobileDragStart(e, id);
          longPressTimer.current = null;
      }, 300);
  };

  const handleTouchEnd = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  const handleTouchMove = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  const handleAdd = () => {
    const newRes = {
      id: `res-${Date.now()}`,
      type: 'Item' as ResourceType,
      name: 'New Element',
      description: '',
      cost: '',
      effect: '',
      reading: '',
      note: ''
    };
    addResource(newRes);
    setSelectedNode(newRes.id);
  };

  const onDragStart = (event: React.DragEvent, id: string) => {
    if (mode === 'play') {
        event.preventDefault();
        return;
    }
    event.dataTransfer.setData('application/reactflow', 'resource');
    event.dataTransfer.setData('application/reactflow/referenceId', id);
    event.dataTransfer.effectAllowed = 'move';
  };



  // Double tap handling
  const lastTapRef = React.useRef(0);
  const handleInteraction = (id: string, _e: React.MouseEvent | React.TouchEvent) => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY && selectedNodeId === id) {
          if (onEdit) onEdit();
      } else {
          setSelectedNode(id);
      }
      lastTapRef.current = now;
  };

  return (
    <div 
        className="flex flex-col h-full bg-card"
        onClick={() => setSelectedNode(null)} // Deselect on background click
        onContextMenu={(e) => e.preventDefault()}
    >
        <div className="flex justify-between items-center mb-2 px-2 pt-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
                <Package size={16} />
                {t('resources.title')}
            </h3>
            {mode === 'edit' && (
            <button 
                onClick={(e) => { e.stopPropagation(); handleAdd(); }} 
                className="p-1 hover:bg-muted rounded text-primary hover:text-primary/80" 
                title="Add Element"
            >
                <Plus size={16} />
            </button>
            )}
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 px-2 pb-2">
            {resources.map(res => (
                <div 
                    key={res.id}
                    className={`
                        group relative flex flex-col w-full bg-card text-card-foreground rounded-lg border-2 shadow-sm
                        transition-colors duration-200 mb-2 cursor-pointer
                        ${selectedNodeId === res.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}
                    `}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleInteraction(res.id, e);
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (onEdit) onEdit();
                    }}
                    draggable={mode === 'edit'}
                    onDragStart={(e) => onDragStart(e, res.id)}
                    onTouchStart={(e) => handleTouchStart(e, res.id)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'pan-y', WebkitTouchCallout: 'none', userSelect: 'none' }}
                >
                    {/* Header */}
                    <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
                        <GripVertical size={14} className="text-muted-foreground opacity-50 cursor-grab shrink-0" />
                        <div className="p-1.5 rounded-full bg-primary/10 text-primary shrink-0">
                            {getIconForResourceType(res.type, 16)}
                        </div>
                        <div className="flex-1 min-w-0">
                             <div className="text-sm text-muted-foreground font-medium truncate mb-1">{t(`resources.types.${res.type}`) || res.type}</div>
                             {res.reading && (
                                <div className="text-xs text-muted-foreground leading-none mb-0.5 truncate">{res.reading}</div>
                             )}
                             <div className="font-bold truncate text-base">{res.name || 'New Element'}</div>
                        </div>
                        {mode === 'edit' && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); deleteResource(res.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 hover:text-destructive rounded transition-all shrink-0"
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                        )}
                    </div>

                    {/* Content Preview */}
                    <div className="p-2 text-sm space-y-1">
                        {res.cost && (
                            <div className="text-muted-foreground truncate">
                                <span className="font-semibold text-foreground">{t('resources.cost')}:</span> {res.cost}
                            </div>
                        )}
                        {res.effect && (
                            <div className="text-muted-foreground truncate">
                                <span className="font-semibold text-foreground">{t('resources.effect')}:</span> {res.effect}
                            </div>
                        )}
                        {res.description && (
                            <div className={`line-clamp-2 text-muted-foreground break-words ${res.cost || res.effect ? 'border-t border-border pt-1 mt-1' : ''}`}>
                                {res.description}
                            </div>
                        )}
                    </div>
                </div>
            ))}
            {resources.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded m-2">
                    Start by adding an element
                </div>
            )}
        </div>
    </div>
  );
});
