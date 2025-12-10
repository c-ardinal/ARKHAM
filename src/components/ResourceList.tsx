import React, { useState, useRef, useEffect } from 'react';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { Plus, Trash2, GripVertical, Package, Edit2 } from 'lucide-react';
import { getIconForResourceType } from '../utils/iconUtils';
import type { ResourceType } from '../types';

interface ResourceListProps {
    onMobileDragStart?: (e: React.TouchEvent, id: string) => void;
    onEdit?: () => void;
}

const ResourceListItem = React.memo(({ 
    res, 
    selectedNodeId, 
    mode, 
    t, 
    onSelect, 
    onDelete, 
    onEdit,
    onMobileDragStart,
    onDragStart,
    isSwiped,
    setSwipedId,
    activeSwipedId,
    onDoubleClick
}: any) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const touchStart = useRef<{x: number, y: number} | null>(null);
    const isScrolling = useRef(false);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync transform for open/close state
    useEffect(() => {
        if (itemRef.current) {
            itemRef.current.style.transform = isSwiped ? 'translateX(-70px)' : 'translateX(0)';
        }
    }, [isSwiped]);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (activeSwipedId && activeSwipedId !== res.id) {
            setSwipedId(null);
        }

        if (mode === 'play') return;
        
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        isScrolling.current = false;
        
        if (itemRef.current) itemRef.current.style.transition = 'none';

        if (!isSwiped && onMobileDragStart && mode === 'edit') {
            longPressTimer.current = setTimeout(() => {
                onMobileDragStart(e, res.id);
                longPressTimer.current = null;
                touchStart.current = null; 
            }, 300);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStart.current || mode === 'play') return;
        
        const dx = e.touches[0].clientX - touchStart.current.x;
        const dy = e.touches[0].clientY - touchStart.current.y;

        if(!isScrolling.current) {
            if(Math.abs(dy) > Math.abs(dx)) {
                isScrolling.current = true;
                if(longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                }
                return;
            }
        }
        
        if(isScrolling.current) return;

        if(Math.abs(dx) > 5) {
             if(e.cancelable) e.preventDefault();
             if(longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
             }
        }

        let newTranslate = dx;
        if (isSwiped) newTranslate -= 70;

        if (newTranslate > 0) newTranslate = 0;
        if (newTranslate < -70) newTranslate = -70;

        if (itemRef.current) {
            itemRef.current.style.transform = `translateX(${newTranslate}px)`;
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if(longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if(!touchStart.current || isScrolling.current) {
            touchStart.current = null;
            return;
        }

        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStart.current.x;
        touchStart.current = null;
        
        if (itemRef.current) {
            itemRef.current.style.transition = 'transform 0.2s ease-out';
            
            const startX = isSwiped ? -70 : 0;
            const finalX = startX + dx;

            if (finalX <= -35) {
                 setSwipedId(res.id); 
            } else {
                 setSwipedId(null);
                 itemRef.current.style.transform = 'translateX(0)';
            }
        }
    };

    return (
        <div className="relative overflow-hidden mb-2 rounded-lg shadow-sm w-full select-none group">
            {/* Delete Action Background */}
            <div className="absolute inset-y-0 right-0 w-[70px] bg-destructive flex items-center justify-center z-0 rounded-r-lg swipe-delete-button">
                <button 
                    className="w-full h-full flex items-center justify-center text-destructive-foreground active:bg-destructive/80"
                    onClick={(e) => {
                        e.stopPropagation();
                        setSwipedId(null);
                        onDelete(e, res.id);
                    }}
                    onTouchEnd={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setSwipedId(null);
                        onDelete(e, res.id);
                    }}
                >
                    <Trash2 size={20} />
                </button>
            </div>

            {/* Content Foreground */}
            <div
                ref={itemRef}
                className={`relative z-10 bg-card text-card-foreground w-full flex flex-col border-2 rounded-lg transition-colors duration-200 ${selectedNodeId === res.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => {
                    if(isSwiped) {
                        e.stopPropagation();
                        setSwipedId(null);
                        return;
                    }
                    onSelect(e, res.id);
                }}
                onDoubleClick={onDoubleClick}
                draggable={mode === 'edit'}
                onDragStart={(e) => onDragStart(e, res.id)}
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
                    {/* Mobile Edit Button */}
                    {mode === 'edit' && (
                        <button 
                            onTouchStart={(e) => e.stopPropagation()}
                            onClick={(e) => { onSelect(e, res.id); onEdit && onEdit(); }}
                            onTouchEnd={(e) => { e.preventDefault(); onSelect(e, res.id); onEdit && onEdit(); }}
                            className="md:hidden p-2 hover:bg-accent rounded text-muted-foreground shrink-0"
                            style={{ touchAction: 'manipulation' }}
                        >
                            <Edit2 size={18} />
                        </button>
                    )}
                     {/* Desktop Actions (Always Visible) */}
                    {mode === 'edit' && (
                    <div className="hidden md:flex items-center gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(e, res.id); }}
                            className="p-1.5 hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20 rounded transition-all shrink-0 text-muted-foreground"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
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
        </div>
    );
});

export const ResourceList = React.memo(({ onMobileDragStart, onEdit }: ResourceListProps) => {
  const { t } = useTranslation();
  const { resources, addResource, deleteResource, setSelectedNode, selectedNodeId, mode } = useScenarioStore();
  const [swipedId, setSwipedId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
        if (!swipedId) return;
        const target = e.target as HTMLElement;
        if (!target.closest('.swipe-delete-button')) {
            setSwipedId(null);
        }
    };

    document.addEventListener('touchstart', handleGlobalClick, { capture: true });
    document.addEventListener('mousedown', handleGlobalClick, { capture: true });
    
    return () => {
        document.removeEventListener('touchstart', handleGlobalClick, { capture: true });
        document.removeEventListener('mousedown', handleGlobalClick, { capture: true });
    };
  }, [swipedId]);

  const handleDelete = (e: React.MouseEvent | React.TouchEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      setTimeout(() => {
        deleteResource(id);
      }, 100);
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

  // Separate handleInteraction since onSelect needs to pass the id
  const handleInteraction = (id: string, e: React.MouseEvent | React.TouchEvent) => {
       e.stopPropagation();
      setSwipedId(null);
      // Single tap only selects.
      setSelectedNode(id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSwipedId(null);
      // Disable double click on mobile (edit button provided)
      if (window.matchMedia('(max-width: 767px)').matches) return;
      if (onEdit) onEdit();
  };

  return (
    <div 
        className="flex flex-col h-full bg-card"
        onClick={(e) => { e.stopPropagation(); setSelectedNode(null); setSwipedId(null); }} 
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
                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleAdd(); }}
                className="p-1 hover:bg-muted active:bg-muted rounded text-primary hover:text-primary/80" 
                style={{ touchAction: 'manipulation' }}
            >
                <Plus size={16} />
            </button>
            )}
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 px-2 pb-2">
            {resources.map(res => (
                <ResourceListItem
                    key={res.id}
                    res={res}
                    selectedNodeId={selectedNodeId}
                    mode={mode}
                    t={t}
                    onSelect={(e: any, id: string) => handleInteraction(id, e)}
                    onDelete={handleDelete}
                    onEdit={onEdit}
                    onMobileDragStart={onMobileDragStart}
                    onDragStart={onDragStart}
                    isSwiped={swipedId === res.id}
                    setSwipedId={setSwipedId}
                    activeSwipedId={swipedId}
                    onDoubleClick={handleDoubleClick}
                />
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
