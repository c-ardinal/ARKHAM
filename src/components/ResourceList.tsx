import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { Plus, Trash2, GripVertical, Package, Edit2, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
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
            <div className="md:hidden absolute inset-y-0 right-0 w-[70px] bg-destructive flex items-center justify-center z-0 rounded-r-lg swipe-delete-button">
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
                    {/* Mobile swipe hint */}
                    {mode === 'edit' && !isSwiped && (
                        <ChevronLeft
                            size={14}
                            aria-hidden="true"
                            className="md:hidden text-muted-foreground/50 shrink-0"
                        />
                    )}

                    {/* Mobile Edit Button */}
                    {mode === 'edit' && (
                        <button
                            onTouchStart={(e) => e.stopPropagation()}
                            onClick={(e) => { onSelect(e, res.id); onEdit && onEdit(); }}
                            onTouchEnd={(e) => { e.preventDefault(); onSelect(e, res.id); onEdit && onEdit(); }}
                            className="md:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] hover:bg-accent rounded-md text-muted-foreground shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            style={{ touchAction: 'manipulation' }}
                            aria-label={t('common.edit' as any) || 'Edit'}
                        >
                            <Edit2 size={18} aria-hidden="true" />
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

const RESOURCE_CATEGORIES: { key: 'all' | ResourceType; defaultName: string }[] = [
  { key: 'all', defaultName: '新規要素' },
  { key: 'Item', defaultName: '新しい道具' },
  { key: 'Knowledge', defaultName: '新しい情報' },
  { key: 'Equipment', defaultName: '新しい装備' },
  { key: 'Skill', defaultName: '新しいスキル' },
  { key: 'Status', defaultName: '新しいステータス' },
];

export const ResourceList = React.memo(({ onMobileDragStart, onEdit }: ResourceListProps) => {
  const { t } = useTranslation();
  // Optimize selectors
  const resources = useScenarioStore((state) => state.resources);
  const addResource = useScenarioStore((state) => state.addResource);
  const deleteResource = useScenarioStore((state) => state.deleteResource);
  const setSelectedNode = useScenarioStore((state) => state.setSelectedNode);
  const selectedNodeId = useScenarioStore((state) => state.selectedNodeId);
  const mode = useScenarioStore((state) => state.mode);

  const [selectedCategory, setSelectedCategory] = useState<'all' | ResourceType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [swipedId, setSwipedId] = useState<string | null>(null);

  // Category horizontal scroll & drag state
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const activeCatButtonRef = useRef<HTMLButtonElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const isMouseDownRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const [isDraggingCategory, setIsDraggingCategory] = useState(false);

  // Category item counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: resources.length };
    for (const r of resources) {
      c[r.type] = (c[r.type] || 0) + 1;
    }
    return c;
  }, [resources]);

  // Check category scroll boundary to toggle chevron buttons
  const checkScrollBoundary = useCallback(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  // Update boundary on scroll, resize, or counts change
  useEffect(() => {
    const el = categoryScrollRef.current;
    if (!el) return;

    checkScrollBoundary();
    el.addEventListener('scroll', checkScrollBoundary, { passive: true });
    window.addEventListener('resize', checkScrollBoundary);

    return () => {
      el.removeEventListener('scroll', checkScrollBoundary);
      window.removeEventListener('resize', checkScrollBoundary);
    };
  }, [checkScrollBoundary, counts]);

  // Mouse wheel horizontal scroll (passive: false to prevent default page jump)
  useEffect(() => {
    const el = categoryScrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
        checkScrollBoundary();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [checkScrollBoundary]);

  // Scroll active tab into view when selection changes
  useEffect(() => {
    if (activeCatButtonRef.current) {
      activeCatButtonRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [selectedCategory]);

  // Drag-to-scroll handlers
  const handleCatMouseDown = (e: React.MouseEvent) => {
    const el = categoryScrollRef.current;
    if (!el) return;
    isMouseDownRef.current = true;
    hasDraggedRef.current = false;
    dragStartXRef.current = e.pageX - el.offsetLeft;
    dragScrollLeftRef.current = el.scrollLeft;
    setIsDraggingCategory(true);
  };

  const handleCatMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !categoryScrollRef.current) return;
    const el = categoryScrollRef.current;
    const x = e.pageX - el.offsetLeft;
    const walk = x - dragStartXRef.current;
    if (Math.abs(walk) > 3) {
      hasDraggedRef.current = true;
    }
    el.scrollLeft = dragScrollLeftRef.current - walk;
    checkScrollBoundary();
  };

  const handleCatMouseUpOrLeave = () => {
    isMouseDownRef.current = false;
    setIsDraggingCategory(false);
  };

  const scrollByAmount = (delta: number) => {
    const el = categoryScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  // Filtered resources based on category and search query
  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      if (selectedCategory !== 'all' && res.type !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (res.name || '').toLowerCase().includes(q);
        const matchReading = (res.reading || '').toLowerCase().includes(q);
        const matchDesc = (res.description || '').toLowerCase().includes(q);
        const matchEffect = (res.effect || '').toLowerCase().includes(q);
        if (!matchName && !matchReading && !matchDesc && !matchEffect) {
          return false;
        }
      }
      return true;
    });
  }, [resources, selectedCategory, searchQuery]);

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
    const targetType: ResourceType = selectedCategory === 'all' ? 'Item' : selectedCategory;
    const catDef = RESOURCE_CATEGORIES.find((c) => c.key === targetType);
    const newRes = {
      id: `res-${Date.now()}`,
      type: targetType,
      name: catDef?.defaultName || 'New Element',
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

  const activeCategoryLabel = selectedCategory === 'all'
    ? t('common.all')
    : (t(`resources.types.${selectedCategory}` as any) || selectedCategory);

  return (
    <div 
        className="flex flex-col h-full bg-card"
        onClick={(e) => { e.stopPropagation(); setSelectedNode(null); setSwipedId(null); }} 
        onContextMenu={(e) => e.preventDefault()}
    >
        {/* Header */}
        <div className="flex justify-between items-center px-2 pt-2 pb-1">
            <h3 className="text-sm font-semibold flex items-center gap-2">
                <Package size={16} />
                {t('resources.title')}
            </h3>
            {mode === 'edit' && (
            <button 
                onClick={(e) => { e.stopPropagation(); handleAdd(); }} 
                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleAdd(); }}
                className="p-1 hover:bg-muted active:bg-muted rounded text-primary hover:text-primary/80 transition-colors" 
                style={{ touchAction: 'manipulation' }}
                title={selectedCategory === 'all' ? '要素を追加' : `「${activeCategoryLabel}」を追加`}
            >
                <Plus size={16} />
            </button>
            )}
        </div>

        {/* Sub-tabs / Category Filter Chips with Drag, Wheel & Chevrons */}
        <div className="relative border-b border-border/50 py-1.5 px-1 group" onClick={(e) => e.stopPropagation()}>
          {/* Scroll Left Button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); scrollByAmount(-90); }}
              className="absolute left-0 top-0 bottom-0 z-10 w-6 flex items-center justify-center bg-gradient-to-r from-card via-card/90 to-transparent text-muted-foreground hover:text-foreground transition-opacity"
              aria-label="前へスクロール"
              title="前へスクロール"
            >
              <ChevronLeft size={14} />
            </button>
          )}

          {/* Scrollable Container */}
          <div 
            ref={categoryScrollRef}
            className={`flex items-center gap-1 overflow-x-auto px-2 select-none ${
              isDraggingCategory ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onMouseDown={handleCatMouseDown}
            onMouseMove={handleCatMouseMove}
            onMouseUp={handleCatMouseUpOrLeave}
            onMouseLeave={handleCatMouseUpOrLeave}
          >
            {RESOURCE_CATEGORIES.map((cat) => {
              const count = counts[cat.key] || 0;
              const isSelected = selectedCategory === cat.key;
              const label = cat.key === 'all'
                ? t('common.all')
                : (t(`resources.types.${cat.key}` as any) || cat.key);

              return (
                <button
                  key={cat.key}
                  ref={isSelected ? activeCatButtonRef : null}
                  type="button"
                  onClick={(e) => {
                    if (hasDraggedRef.current) {
                      e.preventDefault();
                      return;
                    }
                    e.stopPropagation();
                    setSelectedCategory(cat.key);
                  }}
                  className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {cat.key !== 'all' && (
                    <span className="shrink-0">{getIconForResourceType(cat.key, 12)}</span>
                  )}
                  <span>{label}</span>
                  <span className={`text-[10px] px-1 rounded-full ${
                    isSelected ? 'bg-primary-foreground/25 text-primary-foreground' : 'bg-background/80 text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          {canScrollRight && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); scrollByAmount(90); }}
              className="absolute right-0 top-0 bottom-0 z-10 w-6 flex items-center justify-center bg-gradient-to-l from-card via-card/90 to-transparent text-muted-foreground hover:text-foreground transition-opacity"
              aria-label="次へスクロール"
              title="次へスクロール"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="px-2 pt-2 pb-1" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-7 py-1 text-xs bg-muted/40 hover:bg-muted/60 focus:bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSearchQuery(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Resource List */}
        <div className="flex-1 overflow-y-auto space-y-1 px-2 pb-2">
            {filteredResources.map(res => (
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
            {filteredResources.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded m-2 px-3">
                  {searchQuery ? (
                    <div>「{searchQuery}」に一致する要素はありません</div>
                  ) : selectedCategory !== 'all' ? (
                    <div className="space-y-1.5">
                      <div>「{activeCategoryLabel}」は登録されていません</div>
                      {mode === 'edit' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleAdd(); }}
                          className="text-primary hover:underline text-[11px] block mx-auto cursor-pointer"
                        >
                          + 「{activeCategoryLabel}」を新規追加
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>要素がありません。「+」から追加してください</div>
                  )}
                </div>
            )}
        </div>
    </div>
  );
});
