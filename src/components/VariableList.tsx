import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { VariableSuggestInput } from './VariableSuggestInput';
import { useScenarioStore, useUnifiedVariableList, type UnifiedVariableItem } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Variable as VariableIcon,
  Lock,
  Link as LinkIcon,
  Search,
  Minus,
  Globe,
  User,
  MapPin,
  Package,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { VariableType } from '../types';
import { INPUT_CLASS } from '../styles/common';

type VariableCategoryKey = 'all' | 'global' | 'character' | 'stage' | 'resource' | 'node';

interface VariableCategoryDef {
  key: VariableCategoryKey;
  label: string;
  icon: React.ReactNode;
}

const VARIABLE_CATEGORIES: VariableCategoryDef[] = [
  { key: 'all', label: 'すべて', icon: <VariableIcon size={12} /> },
  { key: 'global', label: '全体', icon: <Globe size={12} /> },
  { key: 'character', label: 'キャラ', icon: <User size={12} /> },
  { key: 'stage', label: '舞台', icon: <MapPin size={12} /> },
  { key: 'resource', label: '部隊', icon: <Package size={12} /> },
  { key: 'node', label: '要素', icon: <Layers size={12} /> },
];

export const VariableList = React.memo(() => {
  const {
    gameState,
    mode,
    addVariable,
    updateVariable,
    deleteVariable,
    updateVariableMetadata,
    characters,
    stages,
    resources,
    tabs,
    addEntityVariable,
    updateEntityVariable,
    deleteEntityVariable,
    updateEntityVariableValue,
    setSelectedNode,
  } = useScenarioStore();

  const { t } = useTranslation();
  const allUnifiedVars = useUnifiedVariableList();

  // Search & Selected Category (Matching ResourceList & StageList)
  const [selectedCategory, setSelectedCategory] = useState<VariableCategoryKey>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Category horizontal scroll & drag state (Matching ResourceList & StageList)
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const activeCatButtonRef = useRef<HTMLButtonElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const isMouseDownRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const [isDraggingCategory, setIsDraggingCategory] = useState(false);

  // Adding Form state
  const [isAdding, setIsAdding] = useState(false);
  const [targetScope, setTargetScope] = useState<string>('global'); // 'global' or 'character:id' etc.
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<VariableType>('number');
  const [newValue, setNewValue] = useState<any>(0);
  const [newIsConstant, setNewIsConstant] = useState(false);
  const [newLinkedVariable, setNewLinkedVariable] = useState('');
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // Editing Item state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<VariableType>('number');
  const [editValue, setEditValue] = useState<any>('');
  const [editIsConstant, setEditIsConstant] = useState(false);
  const [editLinkedVariable, setEditLinkedVariable] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Category item counts
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: allUnifiedVars.length,
      global: 0,
      character: 0,
      stage: 0,
      resource: 0,
      node: 0,
    };
    allUnifiedVars.forEach((v) => {
      if (c[v.ownerType] !== undefined) c[v.ownerType]++;
    });
    return c;
  }, [allUnifiedVars]);

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
        inline: 'nearest',
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

  // Available element nodes for target scope selection
  const elementNodes = useMemo(() => {
    const list: Array<{ id: string; name: string }> = [];
    (tabs || []).forEach((tab) => {
      tab.nodes.forEach((n) => {
        if (
          n.type === 'element' ||
          n.type === 'information' ||
          (n.data?.variables && n.data.variables.length > 0)
        ) {
          list.push({
            id: n.id,
            name: n.data.infoValue || n.data.label || n.id,
          });
        }
      });
    });
    return list;
  }, [tabs]);

  // Global variables keys for linking dropdown
  const globalVarKeys = useMemo(() => Object.keys(gameState.variables || {}), [gameState.variables]);

  // Check duplicate name when adding
  useEffect(() => {
    if (!isAdding || !newName.trim()) {
      setDuplicateError(null);
      return;
    }
    const cleanName = newName.trim().toLowerCase();
    const isGlobal = targetScope === 'global';
    const exists = allUnifiedVars.some((v) => {
      if (isGlobal) {
        return v.ownerType === 'global' && v.name.toLowerCase() === cleanName;
      }
      const [type, id] = targetScope.split(':');
      return v.ownerType === type && v.ownerId === id && v.name.toLowerCase() === cleanName;
    });

    if (exists) {
      setDuplicateError('同名の変数が既に存在します');
    } else {
      setDuplicateError(null);
    }
  }, [isAdding, newName, targetScope, allUnifiedVars]);

  // Handle Add Variable submission
  const handleAddSubmit = () => {
    if (!newName.trim() || duplicateError) return;

    let parsedVal: any = newValue;
    if (newType === 'number') {
      const num = Number(newValue);
      parsedVal = isNaN(num) ? 0 : num;
    } else if (newType === 'boolean') {
      parsedVal = String(newValue) === 'true';
    }

    if (targetScope === 'global') {
      addVariable(newName.trim(), newType, parsedVal);
    } else {
      const [type, id] = targetScope.split(':') as ['character' | 'stage' | 'resource' | 'node', string];
      addEntityVariable(type, id, {
        name: newName.trim(),
        type: newType,
        value: parsedVal,
        isConstant: newIsConstant,
        linkedVariable: newLinkedVariable || undefined,
      });
    }

    // Reset form
    setNewName('');
    setNewType('number');
    setNewValue(0);
    setNewIsConstant(false);
    setNewLinkedVariable('');
    setIsAdding(false);
  };

  // Start editing an item
  const startEdit = (item: UnifiedVariableItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditType(item.type);
    setEditValue(String(item.value ?? ''));
    setEditIsConstant(item.isConstant);
    setEditLinkedVariable(item.linkedVariable || '');
    setEditError(null);
    setIsAdding(false);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  // Save edit
  const saveEdit = (item: UnifiedVariableItem) => {
    if (!editName.trim()) return;

    let parsedVal: any = editValue;
    if (editType === 'number') {
      const num = Number(editValue);
      parsedVal = isNaN(num) ? 0 : num;
    } else if (editType === 'boolean') {
      parsedVal = String(editValue) === 'true';
    }

    if (item.ownerType === 'global') {
      if (item.name !== editName.trim() || item.type !== editType) {
        updateVariableMetadata(item.name, editName.trim(), editType);
      }
      updateVariable(editName.trim(), parsedVal);
    } else if (item.ownerType && item.ownerId && item.varId) {
      updateEntityVariable(item.ownerType, item.ownerId, item.varId, {
        name: editName.trim(),
        type: editType,
        value: parsedVal,
        isConstant: editIsConstant,
        linkedVariable: editLinkedVariable || undefined,
      });
    }

    setEditingId(null);
  };

  // Delete variable
  const handleDelete = (item: UnifiedVariableItem) => {
    if (item.ownerType === 'global') {
      deleteVariable(item.name);
    } else if (item.ownerType && item.ownerId && item.varId) {
      deleteEntityVariable(item.ownerType, item.ownerId, item.varId);
    }
  };

  // Delta change for number variable
  const handleDelta = (item: UnifiedVariableItem, delta: number) => {
    if (item.isConstant) return;
    if (item.ownerType === 'global') {
      const current = Number(item.value) || 0;
      updateVariable(item.name, current + delta);
    } else if (item.ownerType && item.ownerId && item.varId) {
      updateEntityVariableValue(item.ownerType, item.ownerId, item.varId, delta, true);
    }
  };

  // Direct value update for variable
  const handleValueChange = (item: UnifiedVariableItem, val: any) => {
    if (item.isConstant) return;
    if (item.ownerType === 'global') {
      updateVariable(item.name, val);
    } else if (item.ownerType && item.ownerId && item.varId) {
      updateEntityVariableValue(item.ownerType, item.ownerId, item.varId, val, false);
    }
  };

  // Filtered variables based on category and search query
  const filteredVariables = useMemo(() => {
    return allUnifiedVars.filter((v) => {
      if (selectedCategory !== 'all' && v.ownerType !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (v.name || '').toLowerCase().includes(q);
        const matchFullName = (v.fullName || '').toLowerCase().includes(q);
        const matchOwner = (v.ownerName || '').toLowerCase().includes(q);
        if (!matchName && !matchFullName && !matchOwner) {
          return false;
        }
      }
      return true;
    });
  }, [allUnifiedVars, selectedCategory, searchQuery]);

  const inputClass = INPUT_CLASS + ' px-2 py-1 text-xs';

  return (
    <div
      className="flex flex-col h-full bg-card"
      onClick={(e) => {
        e.stopPropagation();
        setSelectedNode(null);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header (Matching ResourceList & StageList) */}
      <div className="flex justify-between items-center px-2 pt-2 pb-1">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <VariableIcon size={16} />
          {t('variables.title') || '変数'}
        </h3>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsAdding(!isAdding);
              setEditingId(null);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsAdding(!isAdding);
              setEditingId(null);
            }}
            className="p-1 hover:bg-muted active:bg-muted rounded text-primary hover:text-primary/80 transition-colors"
            style={{ touchAction: 'manipulation' }}
            title={isAdding ? '閉じる' : '変数を追加'}
          >
            {isAdding ? <X size={16} /> : <Plus size={16} />}
          </button>
        )}
      </div>

      {/* Sub-tabs / Category Filter Chips with Drag, Wheel & Chevrons (Matching ResourceList & StageList) */}
      <div className="relative border-b border-border/50 py-1.5 px-1 group" onClick={(e) => e.stopPropagation()}>
        {/* Scroll Left Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              scrollByAmount(-90);
            }}
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
          {VARIABLE_CATEGORIES.map((cat) => {
            const count = counts[cat.key] || 0;
            const isSelected = selectedCategory === cat.key;

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
                <span className="shrink-0">{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1 rounded-full ${
                    isSelected
                      ? 'bg-primary-foreground/25 text-primary-foreground'
                      : 'bg-background/80 text-muted-foreground'
                  }`}
                >
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
            onClick={(e) => {
              e.stopPropagation();
              scrollByAmount(90);
            }}
            className="absolute right-0 top-0 bottom-0 z-10 w-6 flex items-center justify-center bg-gradient-to-l from-card via-card/90 to-transparent text-muted-foreground hover:text-foreground transition-opacity"
            aria-label="次へスクロール"
            title="次へスクロール"
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Search Input (Matching ResourceList & StageList) */}
      <div className="px-2 pt-2 pb-1" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder={t('common.search') || '検索...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-7 py-1 text-xs bg-muted/40 hover:bg-muted/60 focus:bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSearchQuery('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Variable List & Forms (Matching ResourceList layout) */}
      <div className="flex-1 overflow-y-auto space-y-1 px-2 pb-2">
        {/* Add Variable Form */}
        {isAdding && (
          <div
            className="p-3 border border-primary/50 rounded-lg bg-card shadow-sm space-y-2.5 mb-2 mt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Plus size={14} className="text-primary" />
              新規変数・定数の作成
            </div>

            {/* Target Scope */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                対象スコープ（割り当て先）
              </label>
              <select
                value={targetScope}
                onChange={(e) => {
                  setTargetScope(e.target.value);
                  if (e.target.value === 'global') {
                    setNewIsConstant(false);
                    setNewLinkedVariable('');
                  }
                }}
                className={inputClass}
              >
                <option value="global">全体（グローバル変数: $&#123;変数名&#125;）</option>
                {characters.length > 0 && (
                  <optgroup label="キャラクター">
                    {characters.map((c) => (
                      <option key={`character:${c.id}`} value={`character:${c.id}`}>
                        キャラ: {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {stages.length > 0 && (
                  <optgroup label="舞台・場所">
                    {stages.map((s) => (
                      <option key={`stage:${s.id}`} value={`stage:${s.id}`}>
                        舞台: {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {resources.length > 0 && (
                  <optgroup label="部隊・リソース">
                    {resources.map((r) => (
                      <option key={`resource:${r.id}`} value={`resource:${r.id}`}>
                        部隊/リソース: {r.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {elementNodes.length > 0 && (
                  <optgroup label="要素ノード">
                    {elementNodes.map((n) => (
                      <option key={`node:${n.id}`} value={`node:${n.id}`}>
                        要素: {n.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Variable / Constant Kind (if not global) */}
            {targetScope !== 'global' && (
              <div className="flex items-center gap-3 py-0.5">
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="newVarKind"
                    checked={!newIsConstant}
                    onChange={() => setNewIsConstant(false)}
                    className="accent-primary"
                  />
                  <span className="text-foreground font-medium flex items-center gap-1">
                    <VariableIcon size={12} className="text-primary" />
                    変数 (増減・変更可)
                  </span>
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="newVarKind"
                    checked={newIsConstant}
                    onChange={() => setNewIsConstant(true)}
                    className="accent-amber-500"
                  />
                  <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                    <Lock size={12} />
                    定数 (読取専用)
                  </span>
                </label>
              </div>
            )}

            {/* Optional Global Variable Linking */}
            {targetScope !== 'global' && globalVarKeys.length > 0 && (
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  グローバル変数と連動（任意）
                </label>
                <select
                  value={newLinkedVariable}
                  onChange={(e) => {
                    const linked = e.target.value;
                    setNewLinkedVariable(linked);
                    if (linked && gameState.variables[linked]) {
                      setNewType(gameState.variables[linked].type);
                      setNewValue(gameState.variables[linked].value);
                      if (!newName) setNewName(linked);
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">連動しない（単独の変数）</option>
                  {globalVarKeys.map((k) => (
                    <option key={k} value={k}>
                      {k} (現在値: {String(gameState.variables[k]?.value ?? '')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">変数名</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例: HP, SAN, フラグA"
                className={inputClass}
              />
              {duplicateError && <div className="text-[11px] text-destructive mt-1">{duplicateError}</div>}
            </div>

            {/* Type */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">データ型</label>
              <select
                value={newType}
                onChange={(e) => {
                  const t = e.target.value as VariableType;
                  setNewType(t);
                  if (t === 'number') setNewValue(0);
                  else if (t === 'boolean') setNewValue(false);
                  else setNewValue('');
                }}
                className={inputClass}
                disabled={Boolean(newLinkedVariable)}
              >
                <option value="number">数値 (number)</option>
                <option value="string">文字列 (string)</option>
                <option value="boolean">真偽値 (boolean)</option>
              </select>
            </div>

            {/* Initial Value */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">初期値</label>
              {newType === 'boolean' ? (
                <select
                  value={String(newValue)}
                  onChange={(e) => setNewValue(e.target.value === 'true')}
                  className={inputClass}
                  disabled={Boolean(newLinkedVariable)}
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : newType === 'number' ? (
                <input
                  type="number"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="0"
                  className={inputClass}
                  disabled={Boolean(newLinkedVariable)}
                />
              ) : (
                <VariableSuggestInput
                  value={String(newValue ?? '')}
                  onChange={setNewValue}
                  placeholder="初期値テキスト"
                  className={inputClass}
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1 border-t border-border/50">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2.5 py-1 text-xs rounded border border-border hover:bg-muted text-muted-foreground"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleAddSubmit}
                disabled={!newName.trim() || !!duplicateError}
                className={`px-3 py-1 text-xs rounded font-semibold flex items-center gap-1 ${
                  !newName.trim() || !!duplicateError
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                <Plus size={14} />
                作成
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredVariables.length === 0 && !isAdding && (
          <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded m-2 px-3">
            <VariableIcon size={24} className="mx-auto text-muted-foreground/40 mb-1.5" />
            <div>{searchQuery ? '一致する変数がありません' : '変数が定義されていません'}</div>
          </div>
        )}

        {/* Variables List Items */}
        {filteredVariables.map((item) => {
          const isItemEditing = editingId === item.id;

          if (isItemEditing) {
            return (
              <div
                key={item.id}
                className="p-3 border-2 border-primary/60 rounded-lg bg-card shadow-sm space-y-2 mb-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span>変数編集: {item.fullName}</span>
                  <button type="button" onClick={cancelEdit} className="text-muted-foreground hover:text-foreground">
                    <X size={14} />
                  </button>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">変数名</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">データ型</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as VariableType)}
                    className={inputClass}
                    disabled={mode !== 'edit' || Boolean(item.linkedVariable)}
                  >
                    <option value="number">数値 (number)</option>
                    <option value="string">文字列 (string)</option>
                    <option value="boolean">真偽値 (boolean)</option>
                  </select>
                </div>

                {item.ownerType !== 'global' && (
                  <div className="flex items-center gap-2 py-1">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editIsConstant}
                        onChange={(e) => setEditIsConstant(e.target.checked)}
                        className="rounded accent-amber-500"
                      />
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <Lock size={12} className="text-amber-500" />
                        定数としてロック（ノード上からの増減を不可にする）
                      </span>
                    </label>
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">値</label>
                  {editType === 'boolean' ? (
                    <select
                      value={String(editValue)}
                      onChange={(e) => setEditValue(e.target.value === 'true')}
                      className={inputClass}
                      disabled={Boolean(editLinkedVariable)}
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : editType === 'number' ? (
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className={inputClass}
                      disabled={Boolean(editLinkedVariable)}
                    />
                  ) : (
                    <VariableSuggestInput
                      value={String(editValue ?? '')}
                      onChange={setEditValue}
                      className={inputClass}
                    />
                  )}
                </div>

                {editError && <div className="text-[11px] text-destructive">{editError}</div>}

                <div className="flex justify-end gap-2 pt-1 border-t border-border/50">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-2 py-1 text-xs rounded border border-border hover:bg-muted text-muted-foreground"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(item)}
                    disabled={!editName.trim()}
                    className="px-3 py-1 text-xs rounded font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1"
                  >
                    <Save size={13} />
                    保存
                  </button>
                </div>
              </div>
            );
          }

          // Normal Item Display Card
          const isConst = item.isConstant;

          // Scope styling
          const scopeBadgeConfig: Record<string, { label: string; icon: any; className: string }> = {
            global: {
              label: '全体',
              icon: Globe,
              className: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
            },
            character: {
              label: `キャラ: ${item.ownerName || ''}`,
              icon: User,
              className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
            },
            stage: {
              label: `舞台: ${item.ownerName || ''}`,
              icon: MapPin,
              className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
            },
            resource: {
              label: `部隊: ${item.ownerName || ''}`,
              icon: Package,
              className: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
            },
            node: {
              label: `要素: ${item.ownerName || ''}`,
              icon: Layers,
              className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
            },
          };

          const scopeInfo = scopeBadgeConfig[item.ownerType] || scopeBadgeConfig.global;
          const ScopeIcon = scopeInfo.icon;

          return (
            <div
              key={item.id}
              className={`p-2 rounded-lg border transition-all duration-150 group ${
                isConst
                  ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                  : 'bg-card border-border hover:border-primary/40 shadow-xs'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (item.ownerId) setSelectedNode(item.ownerId);
              }}
            >
              {/* Top Row: Scope Badge, Kind Badge, Actions */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {/* Scope Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded border ${scopeInfo.className} truncate max-w-[170px]`}
                    title={`対象: ${scopeInfo.label}`}
                  >
                    <ScopeIcon size={10} className="shrink-0" />
                    <span className="truncate">{scopeInfo.label}</span>
                  </span>

                  {/* Constant / Variable Badge */}
                  {isConst ? (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded shrink-0"
                      title="定数 (ノードやプレイモード上から変更不可)"
                    >
                      <Lock size={9} />
                      定数
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-primary/15 text-primary rounded shrink-0"
                      title="変数 (ノード上や進行中に増減・編集可能)"
                    >
                      <VariableIcon size={9} />
                      変数
                    </span>
                  )}

                  {/* Linked Global Variable */}
                  {item.linkedVariable && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] text-muted-foreground bg-background rounded border border-border/60 shrink-0"
                      title={`グローバル変数「${item.linkedVariable}」と連動`}
                    >
                      <LinkIcon size={8} />
                      {item.linkedVariable}
                    </span>
                  )}
                </div>

                {/* Edit & Delete Action Buttons */}
                <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(item);
                    }}
                    className="p-1 text-muted-foreground hover:text-primary hover:bg-muted rounded transition-colors"
                    title="編集"
                  >
                    <Edit2 size={12} />
                  </button>
                  {mode === 'edit' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item);
                      }}
                      className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="削除"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Middle Row: Name and Reference Tag */}
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <div className="font-bold text-sm text-foreground truncate min-w-0">
                  {item.name}
                </div>
                <div
                  className="font-mono text-[11px] text-primary/80 bg-primary/5 hover:bg-primary/10 px-1.5 py-0.5 rounded cursor-pointer select-all shrink-0 transition-colors"
                  title="クリックして全選択 / テキスト内で参照可能"
                  onClick={(e) => e.stopPropagation()}
                >
                  ${`{${item.fullName}}`}
                </div>
              </div>

              {/* Bottom Row: Type and Value Control */}
              <div className="flex items-center justify-between gap-2 text-xs pt-1.5 border-t border-border/40">
                <span className="text-[10px] uppercase font-mono text-muted-foreground/75 px-1 rounded bg-muted/60">
                  {item.type}
                </span>

                {/* Value display / adjustment */}
                {isConst ? (
                  <div className="font-mono font-semibold text-foreground flex items-center gap-1">
                    <span>{String(item.value)}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">(固定値)</span>
                  </div>
                ) : item.type === 'number' ? (
                  <div
                    className="flex items-center gap-1 bg-background border border-border rounded p-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleDelta(item, -1)}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted active:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="-1"
                    >
                      <Minus size={11} />
                    </button>
                    <input
                      type="number"
                      value={item.value ?? 0}
                      onChange={(e) => handleValueChange(item, Number(e.target.value) || 0)}
                      className="w-12 text-center text-xs font-mono font-bold bg-transparent outline-none py-0.5"
                    />
                    <button
                      type="button"
                      onClick={() => handleDelta(item, 1)}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted active:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="+1"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                ) : item.type === 'boolean' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleValueChange(item, !item.value);
                    }}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-colors ${
                      item.value
                        ? 'bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/30'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    {item.value ? 'True' : 'False'}
                  </button>
                ) : (
                  <div
                    className="font-mono text-xs text-foreground truncate max-w-[150px]"
                    title={String(item.value ?? '')}
                  >
                    {String(item.value ?? '') || <span className="italic text-muted-foreground">（未設定）</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
