import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Lock, Variable as VariableIcon, Link as LinkIcon, Check, X } from 'lucide-react';
import { useScenarioStore } from '../../store/scenarioStore';
import type { EntityVariable, VariableType } from '../../types';

interface EntityVariablesPropertySectionProps {
  variables?: EntityVariable[];
  entityType: 'character' | 'stage' | 'resource' | 'node';
  entityId: string;
}

export const EntityVariablesPropertySection: React.FC<EntityVariablesPropertySectionProps> = ({
  variables = [],
  entityType,
  entityId,
}) => {
  const gameState = useScenarioStore((s) => s.gameState);
  const addEntityVariable = useScenarioStore((s) => s.addEntityVariable);
  const updateEntityVariable = useScenarioStore((s) => s.updateEntityVariable);
  const deleteEntityVariable = useScenarioStore((s) => s.deleteEntityVariable);

  // Form states
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New variable inputs
  const [name, setName] = useState('');
  const [type, setType] = useState<VariableType>('number');
  const [value, setValue] = useState<any>(0);
  const [isConstant, setIsConstant] = useState(false);
  const [linkedVariable, setLinkedVariable] = useState<string>('');

  const globalVarKeys = Object.keys(gameState.variables || {});

  const handleResetForm = () => {
    setName('');
    setType('number');
    setValue(0);
    setIsConstant(false);
    setLinkedVariable('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleStartEdit = (v: EntityVariable) => {
    setEditingId(v.id);
    setName(v.name);
    setType(v.type);
    setValue(v.value);
    setIsConstant(Boolean(v.isConstant));
    setLinkedVariable(v.linkedVariable || '');
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!name.trim()) return;

    if (editingId) {
      updateEntityVariable(entityType, entityId, editingId, {
        name: name.trim(),
        type,
        value,
        isConstant,
        linkedVariable: linkedVariable || undefined,
      });
      handleResetForm();
    } else {
      addEntityVariable(entityType, entityId, {
        name: name.trim(),
        type,
        value,
        isConstant,
        linkedVariable: linkedVariable || undefined,
      });
      handleResetForm();
    }
  };

  return (
    <div className="pt-3 border-t border-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <VariableIcon size={16} className="text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            ステータス / 変数・定数
          </span>
        </div>
        {!isAdding && !editingId && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 rounded hover:bg-primary/10 transition-colors"
            onClick={() => {
              handleResetForm();
              setIsAdding(true);
            }}
          >
            <Plus size={14} />
            追加
          </button>
        )}
      </div>

      {/* Variables List */}
      <div className="space-y-1.5">
        {variables.length === 0 && !isAdding && !editingId && (
          <p className="text-xs text-muted-foreground italic py-1">
            設定されている変数・定数はありません
          </p>
        )}

        {variables.map((v) => {
          if (editingId === v.id) return null; // rendered in edit form below

          const isConst = Boolean(v.isConstant);
          const currentVal =
            v.linkedVariable && gameState.variables[v.linkedVariable] !== undefined
              ? gameState.variables[v.linkedVariable].value
              : v.value;

          return (
            <div
              key={v.id}
              className={`flex items-center justify-between p-2 rounded border text-xs ${
                isConst
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'bg-muted/40 border-border'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {isConst ? (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded shrink-0"
                    title="定数 (ノード上からは変更不可)"
                  >
                    <Lock size={10} />
                    定数
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-primary/15 text-primary rounded shrink-0"
                    title="変数 (ノード上から増減・変更可能)"
                  >
                    <VariableIcon size={10} />
                    変数
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground truncate flex items-center gap-1">
                    <span>{v.name}</span>
                    {v.linkedVariable && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-normal bg-background/80 px-1 rounded border border-border/50"
                        title={`グローバル変数「${v.linkedVariable}」と連動`}
                      >
                        <LinkIcon size={9} />
                        {v.linkedVariable}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    値: {String(currentVal ?? '')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 ml-2 shrink-0">
                <button
                  type="button"
                  className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                  onClick={() => handleStartEdit(v)}
                  title="編集"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  className="p-1 text-destructive/70 hover:text-destructive rounded hover:bg-destructive/10"
                  onClick={() => deleteEntityVariable(entityType, entityId, v.id)}
                  title="削除"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add or Edit Form */}
      {(isAdding || editingId) && (
        <div className="p-3 rounded-lg border border-primary/30 bg-card shadow-sm space-y-2.5 text-xs">
          <div className="font-semibold text-foreground text-xs pb-1 border-b border-border flex items-center justify-between">
            <span>{editingId ? '変数 / 定数の編集' : '新規 変数 / 定数の追加'}</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground p-0.5"
              onClick={handleResetForm}
            >
              <X size={14} />
            </button>
          </div>

          {/* Constant vs Variable Radio */}
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="isConstant"
                checked={!isConstant}
                onChange={() => setIsConstant(false)}
                className="text-primary focus:ring-primary"
              />
              <span className="font-medium text-foreground">変数 (増減可能)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="isConstant"
                checked={isConstant}
                onChange={() => setIsConstant(true)}
                className="text-amber-600 focus:ring-amber-500"
              />
              <span className="font-medium text-foreground">定数 (固定値)</span>
            </label>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
              名前 (アクセス名: {`\${要素名.${name || '変数名'}}`})
            </label>
            <input
              type="text"
              className="w-full px-2 py-1 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="例: HP, MP, 警戒度, クレジット"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Type */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">型</label>
              <select
                className="w-full px-2 py-1 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={type}
                onChange={(e) => {
                  const newType = e.target.value as VariableType;
                  setType(newType);
                  if (newType === 'number') setValue(0);
                  else if (newType === 'boolean') setValue(false);
                  else setValue('');
                }}
              >
                <option value="number">数値 (Number)</option>
                <option value="boolean">真偽値 (Boolean)</option>
                <option value="string">文字列 (String)</option>
              </select>
            </div>

            {/* Value */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                {isConstant ? '定数値' : '初期値'}
              </label>
              {type === 'number' ? (
                <input
                  type="number"
                  className="w-full px-2 py-1 text-xs rounded border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                />
              ) : type === 'boolean' ? (
                <select
                  className="w-full px-2 py-1 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={String(value)}
                  onChange={(e) => setValue(e.target.value === 'true')}
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <input
                  type="text"
                  className="w-full px-2 py-1 text-xs rounded border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Link to global variable (Optional) */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <LinkIcon size={11} />
              グローバル変数と連動 (任意)
            </label>
            <select
              className="w-full px-2 py-1 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={linkedVariable}
              onChange={(e) => setLinkedVariable(e.target.value)}
            >
              <option value="">-- 連動なし (ローカル保持) --</option>
              {globalVarKeys.map((k) => (
                <option key={k} value={k}>
                  {k} (現在値: {String(gameState.variables[k]?.value ?? '')})
                </option>
              ))}
            </select>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded border border-border hover:bg-muted"
              onClick={handleResetForm}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="px-3 py-1 text-xs bg-primary text-primary-foreground font-medium rounded hover:bg-primary/90 flex items-center gap-1"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              <Check size={13} />
              {editingId ? '保存' : '追加'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
