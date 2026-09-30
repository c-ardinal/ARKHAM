import React from 'react';
import { Minus, Plus, Lock, Variable as VariableIcon, Check, X } from 'lucide-react';
import { useScenarioStore } from '../../store/scenarioStore';
import type { EntityVariable } from '../../types';

interface EntityVariablesWidgetProps {
  variables?: EntityVariable[];
  entityType: 'character' | 'stage' | 'resource' | 'node';
  entityId: string;
}

export const EntityVariablesWidget: React.FC<EntityVariablesWidgetProps> = ({
  variables,
  entityType,
  entityId,
}) => {
  const gameState = useScenarioStore((s) => s.gameState);
  const updateEntityVariableValue = useScenarioStore((s) => s.updateEntityVariableValue);

  if (!variables || variables.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5 nodrag">
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
        <span>ステータス / 変数</span>
        <span className="text-[10px] font-normal lowercase opacity-70">
          {variables.length} items
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {variables.map((v) => {
          const currentVal =
            v.linkedVariable && gameState.variables[v.linkedVariable] !== undefined
              ? gameState.variables[v.linkedVariable].value
              : v.value;

          const isConst = Boolean(v.isConstant);

          return (
            <div
              key={v.id}
              className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                isConst
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-950 dark:text-amber-200'
                  : 'bg-muted/60 border border-border/70 text-foreground'
              }`}
            >
              {/* Badge & Name */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {isConst ? (
                  <span
                    className="inline-flex items-center gap-0.5 px-1 py-0.2 text-[9px] font-medium bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded shrink-0"
                    title="定数 (ノード上からは変更不可)"
                  >
                    <Lock size={10} />
                    定数
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-0.5 px-1 py-0.2 text-[9px] font-medium bg-primary/15 text-primary rounded shrink-0"
                    title="変数 (ノード上から増減・変更可能)"
                  >
                    <VariableIcon size={10} />
                    変数
                  </span>
                )}
                <span
                  className="font-medium truncate text-[11px]"
                  title={`${v.name}${v.linkedVariable ? ` (連動: ${v.linkedVariable})` : ''}`}
                >
                  {v.name}
                </span>
              </div>

              {/* Value or Controls */}
              <div className="flex items-center gap-1 shrink-0">
                {isConst ? (
                  /* Constant: Read-only display */
                  <span className="font-mono font-semibold text-[11px] px-1 py-0.5 rounded bg-background/50 border border-border/40 min-w-[28px] text-center">
                    {String(currentVal ?? '')}
                  </span>
                ) : v.type === 'number' || typeof currentVal === 'number' ? (
                  /* Number Variable: [-] input [+] controls */
                  <div className="flex items-center gap-0.5 nodrag nopan">
                    <button
                      type="button"
                      className="nodrag nopan w-5 h-5 flex items-center justify-center rounded bg-background border border-border/70 hover:bg-muted active:scale-95 text-muted-foreground hover:text-foreground transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateEntityVariableValue(entityType, entityId, v.id, -1, true);
                      }}
                      title="-1 減算"
                    >
                      <Minus size={11} />
                    </button>
                    <input
                      type="number"
                      className="nodrag nopan w-12 h-5 text-center font-mono font-semibold text-[11px] bg-background border border-border/70 rounded px-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={currentVal ?? 0}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        updateEntityVariableValue(entityType, entityId, v.id, val, false);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      type="button"
                      className="nodrag nopan w-5 h-5 flex items-center justify-center rounded bg-background border border-border/70 hover:bg-muted active:scale-95 text-muted-foreground hover:text-foreground transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateEntityVariableValue(entityType, entityId, v.id, 1, true);
                      }}
                      title="+1 加算"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                ) : v.type === 'boolean' || typeof currentVal === 'boolean' ? (
                  /* Boolean Variable: Toggle */
                  <button
                    type="button"
                    className={`nodrag nopan px-1.5 py-0.5 text-[10px] font-semibold rounded border transition-colors flex items-center gap-1 ${
                      currentVal
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateEntityVariableValue(entityType, entityId, v.id, !currentVal, false);
                    }}
                  >
                    {currentVal ? <Check size={10} /> : <X size={10} />}
                    {currentVal ? 'TRUE' : 'FALSE'}
                  </button>
                ) : (
                  /* String Variable: Editable Text input */
                  <input
                    type="text"
                    className="nodrag nopan w-20 h-5 text-[11px] bg-background border border-border/70 rounded px-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary truncate font-mono"
                    value={String(currentVal ?? '')}
                    onChange={(e) => {
                      updateEntityVariableValue(entityType, entityId, v.id, e.target.value, false);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
