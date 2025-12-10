import React, { useState, useEffect, useRef } from 'react';
import { VariableSuggestInput } from './VariableSuggestInput';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { Plus, Trash2, Edit2, Save, X, ArrowDownAZ, ArrowUpAZ, Variable as VariableIcon } from 'lucide-react';
import type { VariableType } from '../types';
import { evaluateFormula } from '../utils/textUtils';

const VariableListItem = React.memo(({
    variable,
    mode,
    isEditing,
    startEditing,
    onDelete,
    t,
    editName, setEditName,
    editType, setEditType,
    editValue, setEditValue,
    isChecking, duplicateError, validationError,
    cancelEdit, saveEdit,
    inputClass,
    gameState,
    isSwiped, setSwipedId,
    activeSwipedId
}: any) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const touchStart = useRef<{x: number, y: number} | null>(null);
    const isScrolling = useRef(false);

    useEffect(() => {
        if (itemRef.current && !isEditing) {
            itemRef.current.style.transform = isSwiped ? 'translateX(-70px)' : 'translateX(0)';
        }
    }, [isSwiped, isEditing]);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (activeSwipedId && activeSwipedId !== variable.name) {
            setSwipedId(null);
        }

        if (mode !== 'edit' && !isEditing) return; 

        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        isScrolling.current = false;
        if (itemRef.current) itemRef.current.style.transition = 'none';
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStart.current || (mode !== 'edit' && !isEditing)) return;
        
        const dx = e.touches[0].clientX - touchStart.current.x;
        const dy = e.touches[0].clientY - touchStart.current.y;

        if(!isScrolling.current) {
            if(Math.abs(dy) > Math.abs(dx)) {
                isScrolling.current = true;
                return;
            }
        }
        
        if(isScrolling.current) return;

        if(Math.abs(dx) > 5) {
             if(e.cancelable) e.preventDefault();
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
                 setSwipedId(variable.name); 
            } else {
                 setSwipedId(null);
                 itemRef.current.style.transform = 'translateX(0)';
            }
        }
    };

    if (isEditing) {
        return (
            <div className="p-2 border border-primary/50 rounded bg-accent/10 mb-2">
                <div className="relative mb-2">
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={inputClass}
                    />
                    {isChecking && <span className="absolute right-2 top-1 text-[10px] text-yellow-500">Checking...</span>}
                    {duplicateError && <span className="absolute right-2 top-1 text-[10px] text-destructive">Duplicate</span>}
                </div>
                {mode === 'edit' && (
                    <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as VariableType)}
                        className={`${inputClass} mb-2 opacity-50 cursor-not-allowed`}
                        disabled
                    >
                        <option value="string">{t('variables.string')}</option>
                        <option value="number">{t('variables.number')}</option>
                        <option value="boolean">{t('variables.boolean')}</option>
                    </select>
                )}
                {editType === 'boolean' ? (
                    <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className={`${inputClass} mb-2`}
                    >
                        <option value="true">True</option>
                        <option value="false">False</option>
                    </select>
                ) : (
                    <VariableSuggestInput
                        value={editValue}
                        onChange={setEditValue}
                        className={`${inputClass} mb-2`}
                    />
                )}
                {validationError && <div className="text-[10px] text-destructive mb-1">{validationError}</div>}
                <div className="flex justify-end gap-2 items-center">
                    <button 
                        onClick={cancelEdit} 
                        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); cancelEdit(); }}
                        className="p-1 hover:bg-accent hover:text-accent-foreground active:bg-accent rounded text-muted-foreground"
                    >
                        <X size={14} />
                    </button>
                    <button 
                        onClick={saveEdit} 
                        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); saveEdit(); }}
                        disabled={!!duplicateError || isChecking || !editName}
                        className={`p-1 rounded ${duplicateError || isChecking || !editName ? 'text-muted-foreground cursor-not-allowed' : 'hover:bg-accent hover:text-accent-foreground active:bg-accent text-green-500'}`}
                    >
                        <Save size={14} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden mb-2 rounded-lg shadow-sm w-full select-none group">
             <div className="absolute inset-y-0 right-0 w-[70px] bg-destructive flex items-center justify-center z-0 rounded-r-lg swipe-delete-button">
                <button 
                    className="w-full h-full flex items-center justify-center text-destructive-foreground active:bg-destructive/80"
                    onClick={(e) => { e.stopPropagation(); setSwipedId(null); onDelete(e, variable.name); }}
                     onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setSwipedId(null); onDelete(e, variable.name); }}
                >
                    <Trash2 size={20} />
                </button>
             </div>

             <div
                 ref={itemRef}
                 className="relative z-10 bg-card p-2 border border-border rounded-lg transition-transform duration-200"
                 onTouchStart={handleTouchStart}
                 onTouchMove={handleTouchMove}
                 onTouchEnd={handleTouchEnd}
                 onClick={() => setSwipedId(null)}
             >
                <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-base whitespace-normal break-all text-primary">{variable.name}</span>
                    <div className="flex gap-1 shrink-0">
                        <button 
                            onClick={(e) => { e.stopPropagation(); startEditing(variable.name); }} 
                            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(variable.name); }}
                            className="p-1 hover:bg-accent hover:text-accent-foreground active:bg-accent rounded text-muted-foreground"
                        >
                            <Edit2 size={12} />
                        </button>
                        {mode === 'edit' && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDelete(e, variable.name); }}
                                className="hidden md:block p-1.5 hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20 rounded transition-all shrink-0 text-muted-foreground"
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{variable.type}</span>
                    <span className="font-mono truncate max-w-[220px] text-foreground" title={String(variable.value)}>
                        {variable.type === 'number' && typeof variable.value === 'string' 
                            ? evaluateFormula(variable.value, gameState.variables) 
                            : (variable.type === 'string' && typeof variable.value === 'string' && variable.value.includes('${')
                                ? evaluateFormula(variable.value, gameState.variables)
                                : String(variable.value)
                              )
                        }
                    </span>
                </div>
             </div>
        </div>
    );
});

export const VariableList = React.memo(() => {
  const { gameState, addVariable, updateVariable, deleteVariable, updateVariableMetadata, mode } = useScenarioStore();
  const { t } = useTranslation();

  const [isAdding, setIsAdding] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<VariableType>('string');
  const [newValue, setNewValue] = useState('');

  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<VariableType>('string');
  const [editValue, setEditValue] = useState('');

  const [isChecking, setIsChecking] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [sortBy, setSortBy] = useState<'created' | 'name' | 'type'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
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

  useEffect(() => {
      if (!isAdding && !editingName) {
          setDuplicateError(null);
          setIsChecking(false);
          return;
      }

      const nameToCheck = isAdding ? newName : editName;
      const originalName = isAdding ? null : editingName;

      if (!nameToCheck) {
          setDuplicateError(null);
          setIsChecking(false);
          return;
      }

      setIsChecking(true);
      setDuplicateError(null);

      const timer = setTimeout(() => {
          const exists = Object.values(gameState.variables).some(v => 
              v.name.toLowerCase() === nameToCheck.toLowerCase() && 
              v.name !== originalName
          );
          if (exists) {
              setDuplicateError('Duplicate name');
          } else {
              setDuplicateError(null);
          }
          setIsChecking(false);
      }, 500);

      return () => clearTimeout(timer);
  }, [newName, editName, isAdding, editingName, gameState.variables]);

  const handleAdd = () => {
    setValidationError(null);
    if (!newName || duplicateError || isChecking) return;
    
    let parsedValue: any = newValue;
    if (newType === 'number') {
        const evaluated = evaluateFormula(newValue, gameState.variables);
        if (typeof evaluated === 'number' && isNaN(evaluated)) {
            setValidationError('Invalid formula or number');
            return;
        }
        if (newValue.includes('/0') || newValue.includes('/ 0')) {
             if (!isFinite(Number(evaluated))) {
                 setValidationError('Division by zero');
                 return;
             }
        }
        parsedValue = newValue;
    }
    if (newType === 'boolean') parsedValue = newValue === 'true';

    addVariable(newName, newType, parsedValue);
    setNewName('');
    setNewValue('');
    setIsAdding(false);
  };

  const startEditing = (name: string) => {
    const v = gameState.variables[name];
    setEditingName(name);
    setEditName(v.name);
    setEditType(v.type);
    setEditValue(String(v.value));
    setValidationError(null);
    setSwipedId(null);
  };

  const saveEdit = () => {
    setValidationError(null);
    if (!editingName || !editName || duplicateError || isChecking) return;

    if (mode === 'edit') {
        if (editingName !== editName || gameState.variables[editingName].type !== editType) {
            updateVariableMetadata(editingName, editName, editType);
        }
    }

    let parsedValue: any = editValue;
    if (editType === 'number') {
        const evaluated = evaluateFormula(editValue, gameState.variables);
        if (typeof evaluated === 'number' && isNaN(evaluated)) {
            setValidationError('Invalid formula or number');
            return;
        }
        if (!isFinite(Number(evaluated))) {
             setValidationError('Division by zero or infinity');
             return;
        }
        parsedValue = editValue;
    }
    if (editType === 'boolean') parsedValue = editValue === 'true';

    updateVariable(mode === 'edit' ? editName : editingName, parsedValue);
    setEditingName(null);
  };

  const cancelEdit = () => {
      setEditingName(null);
      setDuplicateError(null);
      setValidationError(null);
  };

  const handleDelete = (e: React.MouseEvent | React.TouchEvent, name: string) => {
      e.stopPropagation();
      e.preventDefault();
      setTimeout(() => {
        deleteVariable(name);
      }, 100);
  };

  const getSortedVariables = () => {
      const vars = Object.values(gameState.variables);
      return vars.sort((a, b) => {
          let valA: any = a[sortBy === 'created' ? 'name' : sortBy]; 
          let valB: any = b[sortBy === 'created' ? 'name' : sortBy];
          
          if (sortBy === 'created') {
               return sortOrder === 'asc' ? 0 : -1; 
          }

          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
      });
  };

  const toggleSort = (type: 'created' | 'name' | 'type') => {
      if (sortBy === type) {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
          setSortBy(type);
          setSortOrder('asc');
      }
  };

  const inputClass = "w-full border rounded px-2 py-1 text-sm bg-background border-input text-foreground";

  return (
    <div className="flex flex-col h-full overflow-hidden" onClick={() => setSwipedId(null)}>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: hsl(var(--muted-foreground) / 0.5); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: hsl(var(--muted-foreground) / 0.8); }
      `}</style>
      <div className="flex items-center justify-between mb-2 px-2 pt-2 shrink-0">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <VariableIcon size={16} />
            {t('variables.title')}
        </h3>
        {mode === 'edit' && (
            <button 
            onClick={() => setIsAdding(true)}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setIsAdding(true); }}
            className="p-1 hover:bg-muted active:bg-muted rounded text-primary hover:text-primary/80"
            style={{ touchAction: 'manipulation' }}
            >
                <Plus size={16} />
            </button>
        )}
      </div>

      <div className="px-2 mb-2 flex gap-2 shrink-0">
          <button onClick={() => toggleSort('name')} className={`text-xs flex items-center gap-1 ${sortBy === 'name' ? 'text-primary' : 'text-muted-foreground'}`}>
             Name {sortBy === 'name' && (sortOrder === 'asc' ? <ArrowDownAZ size={12}/> : <ArrowUpAZ size={12}/>)}
          </button>
          <button onClick={() => toggleSort('type')} className={`text-xs flex items-center gap-1 ${sortBy === 'type' ? 'text-primary' : 'text-muted-foreground'}`}>
             Type {sortBy === 'type' && (sortOrder === 'asc' ? <ArrowDownAZ size={12}/> : <ArrowUpAZ size={12}/>)}
          </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
        {isAdding && (
          <div className="p-2 border border-primary/50 rounded bg-accent/10 mb-2">
            <div className="relative mb-2">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Variable name"
                    className={inputClass}
                />
                {isChecking && <span className="absolute right-2 top-1 text-[10px] text-yellow-500">Checking...</span>}
                {duplicateError && <span className="absolute right-2 top-1 text-[10px] text-destructive">Duplicate</span>}
            </div>
            <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as VariableType)}
                className={`${inputClass} mb-2`}
            >
                <option value="string">{t('variables.string')}</option>
                <option value="number">{t('variables.number')}</option>
                <option value="boolean">{t('variables.boolean')}</option>
            </select>
            {newType === 'boolean' ? (
                <select
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className={`${inputClass} mb-2`}
                >
                    <option value="">Select...</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                </select>
            ) : (
                <VariableSuggestInput
                    value={newValue}
                    onChange={setNewValue}
                    placeholder="Initial value (can assume empty)"
                    className={`${inputClass} mb-2`}
                />
            )}
            {validationError && <div className="text-[10px] text-destructive mb-1">{validationError}</div>}
             <div className="flex justify-end gap-2 items-center">
                <button 
                    onClick={() => { setIsAdding(false); setDuplicateError(null); setValidationError(null); }} 
                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setIsAdding(false); setDuplicateError(null); setValidationError(null); }}
                    className="p-1 hover:bg-accent hover:text-accent-foreground active:bg-accent rounded text-muted-foreground"
                >
                    <X size={14} />
                </button>
                <button 
                    onClick={handleAdd} 
                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleAdd(); }}
                    disabled={!!duplicateError || isChecking || !newName}
                    className={`p-1 rounded ${duplicateError || isChecking || !newName ? 'text-muted-foreground cursor-not-allowed' : 'hover:bg-accent hover:text-accent-foreground active:bg-accent text-green-500'}`}
                >
                    <Plus size={14} />
                </button>
            </div>
          </div>
        )}

        {getSortedVariables().map(v => (
             <VariableListItem
                key={v.name}
                variable={v}
                mode={mode}
                isEditing={editingName === v.name}
                startEditing={startEditing}
                onDelete={handleDelete}
                t={t}
                editName={editName} setEditName={setEditName}
                editType={editType} setEditType={setEditType}
                editValue={editValue} setEditValue={setEditValue}
                isChecking={isChecking} duplicateError={duplicateError} validationError={validationError}
                cancelEdit={cancelEdit} saveEdit={saveEdit}
                inputClass={inputClass}
                gameState={gameState}
                isSwiped={swipedId === v.name}
                setSwipedId={setSwipedId}
                activeSwipedId={swipedId}
            />
        ))}

        {Object.keys(gameState.variables).length === 0 && !isAdding && (
             <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded m-2">
                 No variables
             </div>
        )}
      </div>
    </div>
  );
});
