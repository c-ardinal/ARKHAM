import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { Plus, Trash2, GripVertical, Landmark, Edit2, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { getIconForStageType } from '../utils/iconUtils';
import type { StageType, StageData } from '../types';

interface StageListProps {
  onMobileDragStart?: (e: React.TouchEvent, id: string) => void;
  onEdit?: () => void;
}

const StageListItem = React.memo(({ 
  stage, 
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
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const isScrolling = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync transform for open/close state
  useEffect(() => {
    if (itemRef.current) {
      itemRef.current.style.transform = isSwiped ? 'translateX(-70px)' : 'translateX(0)';
    }
  }, [isSwiped]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeSwipedId && activeSwipedId !== stage.id) {
      setSwipedId(null);
    }

    if (mode === 'play') return;
    
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isScrolling.current = false;
    
    if (itemRef.current) itemRef.current.style.transition = 'none';

    if (!isSwiped && onMobileDragStart && mode === 'edit') {
      longPressTimer.current = setTimeout(() => {
        onMobileDragStart(e, stage.id);
        longPressTimer.current = null;
        touchStart.current = null; 
      }, 300);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current || mode === 'play') return;
    
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;

    if (!isScrolling.current) {
      if (Math.abs(dy) > Math.abs(dx)) {
        isScrolling.current = true;
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        return;
      }
    }
    
    if (isScrolling.current) return;

    if (Math.abs(dx) > 5) {
      if (e.cancelable) e.preventDefault();
      if (longPressTimer.current) {
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
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!touchStart.current || isScrolling.current || mode === 'play') {
      touchStart.current = null;
      return;
    }

    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    touchStart.current = null;

    if (itemRef.current) itemRef.current.style.transition = 'transform 0.2s ease-out';

    if (dx < -35) {
      setSwipedId(stage.id);
    } else {
      setSwipedId(null);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-md border border-border/60 bg-card select-none group">
      {/* Background Swipe Delete Button (Mobile) */}
      <div 
        className="md:hidden absolute inset-y-0 right-0 w-[70px] bg-destructive flex items-center justify-center text-destructive-foreground z-0 cursor-pointer swipe-delete-button"
        onClick={(e) => onDelete(e, stage.id)}
        onTouchEnd={(e) => onDelete(e, stage.id)}
        style={{ touchAction: 'manipulation' }}
      >
        <Trash2 size={18} />
      </div>

      {/* Main Item Container */}
      <div 
        ref={itemRef}
        draggable={mode === 'edit'}
        onDragStart={(e) => onDragStart(e, stage.id)}
        onClick={(e) => onSelect(e, stage.id)}
        onDoubleClick={onDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative z-10 bg-card transition-colors ${
          selectedNodeId === stage.id ? 'ring-2 ring-primary ring-inset' : 'hover:border-primary/50'
        }`}
        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'pan-y', WebkitTouchCallout: 'none', userSelect: 'none' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
          <GripVertical size={14} className="text-muted-foreground opacity-50 cursor-grab shrink-0" />
          <div className="p-1.5 rounded-full bg-primary/10 text-primary shrink-0">
            {getIconForStageType(stage.type, 16)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground font-medium truncate">
              {t(`stages.types.${stage.type}` as any) || stage.type}
            </div>
            {stage.reading && (
              <div className="text-[11px] text-muted-foreground leading-none mb-0.5 truncate">{stage.reading}</div>
            )}
            <div className="font-bold truncate text-sm">{stage.name || 'New Stage Entity'}</div>
          </div>

          {/* Mobile swipe hint */}
          {mode === 'edit' && !isSwiped && (
            <ChevronLeft size={14} aria-hidden="true" className="md:hidden text-muted-foreground/50 shrink-0" />
          )}

          {/* Mobile Edit Button */}
          {mode === 'edit' && (
            <button
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => { onSelect(e, stage.id); onEdit && onEdit(); }}
              onTouchEnd={(e) => { e.preventDefault(); onSelect(e, stage.id); onEdit && onEdit(); }}
              className="md:hidden inline-flex items-center justify-center min-w-[40px] min-h-[40px] hover:bg-accent rounded-md text-muted-foreground shrink-0"
              style={{ touchAction: 'manipulation' }}
              aria-label={t('common.edit' as any) || 'Edit'}
            >
              <Edit2 size={16} aria-hidden="true" />
            </button>
          )}

          {/* Desktop Actions */}
          {mode === 'edit' && (
            <div className="hidden md:flex items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(e, stage.id); }}
                className="p-1.5 hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20 rounded transition-all shrink-0 text-muted-foreground"
                title="削除"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Content Preview */}
        <div className="p-2 text-xs space-y-1">
          {stage.description && (
            <div className="line-clamp-2 text-muted-foreground break-words">
              {stage.description}
            </div>
          )}
          {stage.details && (
            <div className="line-clamp-1 text-muted-foreground/80 italic text-[11px]">
              {stage.details}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const STAGE_CATEGORIES: { key: 'all' | StageType; defaultName: string }[] = [
  { key: 'all', defaultName: '新規の舞台要素' },
  { key: 'Location', defaultName: '新しい場所' },
  { key: 'Faction', defaultName: '新しい組織・勢力' },
  { key: 'Lore', defaultName: '新しい世界設定・伝承' },
];

export const StageList = React.memo(({ onMobileDragStart, onEdit }: StageListProps) => {
  const { t } = useTranslation();
  const stages = useScenarioStore((state) => state.stages);
  const addStage = useScenarioStore((state) => state.addStage);
  const deleteStage = useScenarioStore((state) => state.deleteStage);
  const setSelectedNode = useScenarioStore((state) => state.setSelectedNode);
  const selectedNodeId = useScenarioStore((state) => state.selectedNodeId);
  const mode = useScenarioStore((state) => state.mode);

  const [selectedCategory, setSelectedCategory] = useState<'all' | StageType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [swipedId, setSwipedId] = useState<string | null>(null);

  // Horizontal scroll & drag state
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
    const c: Record<string, number> = { all: stages.length };
    for (const s of stages) {
      c[s.type] = (c[s.type] || 0) + 1;
    }
    return c;
  }, [stages]);

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

  // Mouse wheel horizontal scroll (passive: false)
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

  // Filtered stages based on category and search query
  const filteredStages = useMemo(() => {
    return stages.filter((stage) => {
      if (selectedCategory !== 'all' && stage.type !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (stage.name || '').toLowerCase().includes(q);
        const matchReading = (stage.reading || '').toLowerCase().includes(q);
        const matchDesc = (stage.description || '').toLowerCase().includes(q);
        const matchDetails = (stage.details || '').toLowerCase().includes(q);
        if (!matchName && !matchReading && !matchDesc && !matchDetails) {
          return false;
        }
      }
      return true;
    });
  }, [stages, selectedCategory, searchQuery]);

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
      deleteStage(id);
    }, 100);
  };

  const handleAdd = () => {
    const targetType: StageType = selectedCategory === 'all' ? 'Location' : selectedCategory;
    const catDef = STAGE_CATEGORIES.find((c) => c.key === targetType);
    const newStage: StageData = {
      id: `stage-${Date.now()}`,
      type: targetType,
      name: catDef?.defaultName || '新しい舞台要素',
      description: '',
      details: '',
      reading: '',
      note: ''
    };
    addStage(newStage);
    setSelectedNode(newStage.id);
  };

  const onDragStart = (event: React.DragEvent, id: string) => {
    if (mode === 'play') {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('application/reactflow', 'stage');
    event.dataTransfer.setData('application/reactflow/referenceId', id);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleInteraction = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setSwipedId(null);
    setSelectedNode(id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSwipedId(null);
    if (window.matchMedia('(max-width: 767px)').matches) return;
    if (onEdit) onEdit();
  };

  const activeCategoryLabel = selectedCategory === 'all'
    ? t('common.all')
    : (t(`stages.types.${selectedCategory}` as any) || selectedCategory);

  return (
    <div 
      className="flex flex-col h-full bg-card"
      onClick={(e) => { e.stopPropagation(); setSelectedNode(null); setSwipedId(null); }} 
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="flex justify-between items-center px-2 pt-2 pb-1">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Landmark size={16} />
          {t('stages.title' as any) || '舞台'}
        </h3>
        {mode === 'edit' && (
          <button 
            onClick={(e) => { e.stopPropagation(); handleAdd(); }} 
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleAdd(); }}
            className="p-1 hover:bg-muted active:bg-muted rounded text-primary hover:text-primary/80 transition-colors" 
            style={{ touchAction: 'manipulation' }}
            title={selectedCategory === 'all' ? '舞台要素を追加' : `「${activeCategoryLabel}」を追加`}
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* Sub-tabs / Category Filter Chips */}
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
          {STAGE_CATEGORIES.map((cat) => {
            const count = counts[cat.key] || 0;
            const isSelected = selectedCategory === cat.key;
            const label = cat.key === 'all'
              ? t('common.all')
              : (t(`stages.types.${cat.key}` as any) || cat.key);

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
                  <span className="shrink-0">{getIconForStageType(cat.key, 12)}</span>
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

      {/* Stage List */}
      <div className="flex-1 overflow-y-auto space-y-1 px-2 pb-2">
        {filteredStages.map((stage) => (
          <StageListItem
            key={stage.id}
            stage={stage}
            selectedNodeId={selectedNodeId}
            mode={mode}
            t={t}
            onSelect={(e: any, id: string) => handleInteraction(id, e)}
            onDelete={handleDelete}
            onEdit={onEdit}
            onMobileDragStart={onMobileDragStart}
            onDragStart={onDragStart}
            isSwiped={swipedId === stage.id}
            setSwipedId={setSwipedId}
            activeSwipedId={swipedId}
            onDoubleClick={handleDoubleClick}
          />
        ))}
        {filteredStages.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded m-2 px-3">
            {searchQuery ? (
              <div>「{searchQuery}」に一致する舞台要素はありません</div>
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
              <div>舞台要素がありません。「+」から追加してください</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
