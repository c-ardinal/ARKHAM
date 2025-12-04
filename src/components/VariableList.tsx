import { useState, useEffect } from 'react';
import { VariableSuggestInput } from './VariableSuggestInput';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { Plus, Trash2, Edit2, Save, X, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import type { VariableType } from '../types';
import { evaluateFormula } from '../utils/textUtils';

export const VariableList = () => {
  const { gameState, addVariable, updateVariable, deleteVariable, updateVariableMetadata, mode } = useScenarioStore();
  const { t } = useTranslation();

  const [isAdding, setIsAdding] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);

  // New variable state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<VariableType>('string');
  const [newValue, setNewValue] = useState('');

  // Edit state
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<VariableType>('string');
  const [editValue, setEditValue] = useState('');

  // Duplicate check
  const [isChecking, setIsChecking] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Sorting
  const [sortBy, setSortBy] = useState<'created' | 'name' | 'type'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Debounce check for duplicates
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
          // Case insensitive check, excluding self
          const exists = Object.values(gameState.variables).some(v => 
              v.name.toLowerCase() === nameToCheck.toLowerCase() && 
              v.name !== originalName // Exclude self
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
        // Validate formula
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
  };

  const saveEdit = () => {
    setValidationError(null);
    if (!editingName || !editName || duplicateError || isChecking) return;

    // Update metadata (name/type) - Only in Edit Mode
    if (mode === 'edit') {
        if (editingName !== editName || gameState.variables[editingName].type !== editType) {
            updateVariableMetadata(editingName, editName, editType);
        }
    }

    // Update value - Allowed in Play Mode too
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
        parsedValue = editValue; // Keep as string for reference/formula
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

  const inputClass = "w-full border rounded px-2 py-1 text-xs bg-background border-input text-foreground";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: hsl(var(--muted-foreground) / 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: hsl(var(--muted-foreground) / 0.8);
        }
      `}</style>
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-sm font-medium text-foreground">{t.variables.title}</h3>
        {mode === 'edit' && (
            <button 
            onClick={() => setIsAdding(true)}
            className="p-1 hover:bg-accent hover:text-accent-foreground rounded text-primary"
            title={t.variables.add}
            >
            <Plus size={16} />
            </button>
        )}
      </div>

      <div className="flex gap-1 mb-2 shrink-0">
          <button onClick={() => toggleSort('created')} className={`p-1 rounded text-xs flex items-center gap-1 ${sortBy === 'created' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`} title="Sort by Created">
              Created {sortBy === 'created' && (sortOrder === 'asc' ? <ArrowDownAZ size={12} /> : <ArrowUpAZ size={12} />)}
          </button>
          <button onClick={() => toggleSort('name')} className={`p-1 rounded text-xs flex items-center gap-1 ${sortBy === 'name' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`} title="Sort by Name">
              Name {sortBy === 'name' && (sortOrder === 'asc' ? <ArrowDownAZ size={12} /> : <ArrowUpAZ size={12} />)}
          </button>
          <button onClick={() => toggleSort('type')} className={`p-1 rounded text-xs flex items-center gap-1 ${sortBy === 'type' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`} title="Sort by Type">
              Type {sortBy === 'type' && (sortOrder === 'asc' ? <ArrowDownAZ size={12} /> : <ArrowUpAZ size={12} />)}
          </button>
      </div>

      {isAdding && mode === 'edit' && (
        <div className="p-2 rounded mb-4 space-y-2 border shrink-0 bg-card border-border">
          <div className="relative">
              <input
                type="text"
                placeholder={t.variables.name}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={inputClass}
              />
              {isChecking && <span className="absolute right-2 top-1 text-[10px] text-yellow-500">Checking...</span>}
              {duplicateError && <span className="absolute right-2 top-1 text-[10px] text-destructive">Duplicate</span>}
          </div>
          <div className="flex gap-2">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as VariableType)}
              className={`flex-1 border rounded px-2 py-1 text-xs bg-background border-input text-foreground`}
            >
              <option value="string">{t.variables.string}</option>
              <option value="number">{t.variables.number}</option>
              <option value="boolean">{t.variables.boolean}</option>
            </select>
          </div>
          {newType === 'boolean' ? (
              <select
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className={inputClass}
              >
                  <option value="">Select value</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
              </select>
          ) : (
              <VariableSuggestInput
                placeholder={t.variables.value}
                value={newValue}
                onChange={setNewValue}
                className={inputClass}
              />
          )}
          {validationError && <div className="text-[10px] text-destructive">{validationError}</div>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsAdding(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            <button 
                onClick={handleAdd} 
                disabled={!!duplicateError || isChecking || !newName || (newType === 'boolean' && !newValue)}
                className={`text-xs px-2 py-1 rounded text-primary-foreground ${duplicateError || isChecking || !newName || (newType === 'boolean' && !newValue) ? 'bg-gray-500 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'}`}
            >
                {t.variables.create}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar pr-1">
        {Object.values(gameState.variables).length === 0 && !isAdding && (
            <div className="text-xs text-muted-foreground italic text-center py-4">{t.variables.noVariables}</div>
        )}
        {getSortedVariables().map((variable) => (
          <div key={variable.name} className="p-2 rounded border bg-card border-border hover:border-ring/50">
            {editingName === variable.name ? (
                <div className="space-y-2">
                    {mode === 'edit' && (
                        <div className="relative">
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className={inputClass}
                            />
                            {isChecking && <span className="absolute right-2 top-1 text-[10px] text-yellow-500">Checking...</span>}
                            {duplicateError && <span className="absolute right-2 top-1 text-[10px] text-destructive">Duplicate</span>}
                        </div>
                    )}
                    {mode === 'edit' && (
                        <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value as VariableType)}
                            className={`${inputClass} opacity-50 cursor-not-allowed`}
                            disabled
                        >
                            <option value="string">{t.variables.string}</option>
                            <option value="number">{t.variables.number}</option>
                            <option value="boolean">{t.variables.boolean}</option>
                        </select>
                    )}
                    {editType === 'boolean' ? (
                        <select
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className={inputClass}
                        >
                            <option value="true">True</option>
                            <option value="false">False</option>
                        </select>
                    ) : (
                        <VariableSuggestInput
                            value={editValue}
                            onChange={setEditValue}
                            className={inputClass}
                        />
                    )}
                    {validationError && <div className="text-[10px] text-destructive">{validationError}</div>}
                    <div className="flex justify-end gap-2 items-center">
                        {isChecking && <span className="text-[10px] text-yellow-500">Checking...</span>}
                        {duplicateError && <span className="text-[10px] text-destructive">Duplicate</span>}
                        <button onClick={cancelEdit} className="p-1 hover:bg-accent hover:text-accent-foreground rounded text-muted-foreground"><X size={14} /></button>
                        <button 
                            onClick={saveEdit} 
                            disabled={!!duplicateError || isChecking || !editName}
                            className={`p-1 rounded ${duplicateError || isChecking || !editName ? 'text-muted-foreground cursor-not-allowed' : 'hover:bg-accent hover:text-accent-foreground text-green-500'}`}
                        >
                            <Save size={14} />
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm whitespace-normal break-all text-primary">{variable.name}</span>
                        <div className="flex gap-1 shrink-0">
                            <button onClick={() => startEditing(variable.name)} className="p-1 hover:bg-accent hover:text-accent-foreground rounded text-muted-foreground">
                                <Edit2 size={12} />
                            </button>
                            {mode === 'edit' && (
                                <button onClick={() => deleteVariable(variable.name)} className="p-1 hover:bg-accent hover:text-accent-foreground rounded text-muted-foreground hover:text-destructive">
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{variable.type}</span>
                        <span className="font-mono truncate max-w-[100px] text-foreground" title={String(variable.value)}>
                            {variable.type === 'number' && typeof variable.value === 'string' 
                                ? evaluateFormula(variable.value, gameState.variables) 
                                : (variable.type === 'string' && typeof variable.value === 'string' && variable.value.includes('${')
                                    ? evaluateFormula(variable.value, gameState.variables)
                                    : String(variable.value)
                                  )
                            }
                        </span>
                    </div>
                </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
