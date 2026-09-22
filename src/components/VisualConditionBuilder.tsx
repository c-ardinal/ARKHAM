import React, { useState, useMemo, useEffect } from 'react';
import { validateExpression, type ValidationResult } from '../core/expression';
import { INPUT_CLASS, LABEL_CLASS } from '../styles/common';
import { CheckCircle2, AlertTriangle, AlertCircle, Code, SlidersHorizontal, Plus, Trash2 } from 'lucide-react';
import { VariableSuggestInput } from './VariableSuggestInput';

export interface VisualConditionBuilderProps {
  value: string;
  onChange: (val: string) => void;
  variables: Record<string, { type: 'number' | 'boolean' | 'string'; value: any }>;
  label?: string;
  className?: string;
}

type Mode = 'visual' | 'expression';

export interface ConditionRow {
  id: string;
  varName: string;
  op: string;
  val: string;
}

/**
 * Parses single condition like "alarm >= 2" or "${alarm} == true"
 */
function parseSingleCondition(expr: string): { varName: string; op: string; val: string } | null {
  if (!expr || !expr.trim()) return null;
  const cleaned = expr.trim().replace(/^\((.*)\)$/, '$1').trim().replace(/^\${(.*)}$/, '$1');

  const match = cleaned.match(/^([a-zA-Z0-9_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!match) return null;

  const varName = match[1].trim();
  const op = match[2].trim();
  let rawVal = match[3].trim();

  if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
    rawVal = rawVal.slice(1, -1);
  }

  return { varName, op, val: rawVal };
}

/**
 * Parses simple or multi-row AND/OR expressions
 */
function parseExpressionToRows(expr: string): { rows: ConditionRow[]; combinator: 'AND' | 'OR' } | null {
  if (!expr || !expr.trim()) return null;
  const trimmed = expr.trim();

  // Check if purely AND
  if (trimmed.includes('&&') && !trimmed.includes('||')) {
    const parts = trimmed.split('&&');
    const parsedParts: ConditionRow[] = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parseSingleCondition(parts[i]);
      if (!p) return null;
      parsedParts.push({ id: `row_${i}_${Date.now()}`, ...p });
    }
    return { rows: parsedParts, combinator: 'AND' };
  }

  // Check if purely OR
  if (trimmed.includes('||') && !trimmed.includes('&&')) {
    const parts = trimmed.split('||');
    const parsedParts: ConditionRow[] = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parseSingleCondition(parts[i]);
      if (!p) return null;
      parsedParts.push({ id: `row_${i}_${Date.now()}`, ...p });
    }
    return { rows: parsedParts, combinator: 'OR' };
  }

  // Single condition
  const single = parseSingleCondition(trimmed);
  if (single) {
    return {
      rows: [{ id: `row_0_${Date.now()}`, ...single }],
      combinator: 'AND',
    };
  }

  return null;
}

/**
 * Formats row into expression string
 */
function formatSingleCondition(
  row: ConditionRow,
  variables: Record<string, { type: 'number' | 'boolean' | 'string'; value: any }>
): string {
  const varDef = variables[row.varName];
  const type = varDef?.type || 'number';

  if (type === 'boolean') {
    return `${row.varName} ${row.op} ${row.val === 'false' ? 'false' : 'true'}`;
  } else if (type === 'number') {
    const numVal = isNaN(Number(row.val)) ? 0 : Number(row.val);
    return `${row.varName} ${row.op} ${numVal}`;
  } else {
    return `${row.varName} ${row.op} "${row.val}"`;
  }
}

export const VisualConditionBuilder: React.FC<VisualConditionBuilderProps> = ({
  value,
  onChange,
  variables,
  label = '条件判定の設定',
  className = '',
}) => {
  const variableNames = useMemo(() => Object.keys(variables), [variables]);

  // Initial detection
  const initialParsed = useMemo(() => parseExpressionToRows(value), [value]);
  const isComplex = Boolean(value && value.trim() && !initialParsed);

  const [mode, setMode] = useState<Mode>(() => (isComplex ? 'expression' : 'visual'));

  const defaultVar = variableNames[0] || '';
  const [rows, setRows] = useState<ConditionRow[]>(() => {
    if (initialParsed && initialParsed.rows.length > 0) {
      return initialParsed.rows;
    }
    return [{ id: `row_${Date.now()}`, varName: defaultVar, op: '==', val: '0' }];
  });
  const [combinator, setCombinator] = useState<'AND' | 'OR'>(() => initialParsed?.combinator || 'AND');

  // Sync if value changes externally
  useEffect(() => {
    const parsed = parseExpressionToRows(value);
    if (parsed) {
      setRows(parsed.rows);
      setCombinator(parsed.combinator);
    }
  }, [value]);

  // Compute validation result for expression mode
  const validationResult: ValidationResult = useMemo(() => {
    if (!value || !value.trim()) {
      return { isValid: true, variables: [], usedVariables: [], undefinedVariables: [] };
    }
    return validateExpression(value, variableNames);
  }, [value, variableNames]);

  // Emit updated visual expression
  const emitRowsChange = (updatedRows: ConditionRow[], comb: 'AND' | 'OR') => {
    if (updatedRows.length === 0) {
      onChange('');
      return;
    }

    const formattedParts = updatedRows
      .filter((r) => Boolean(r.varName))
      .map((r) => formatSingleCondition(r, variables));

    if (formattedParts.length === 0) {
      onChange('');
    } else if (formattedParts.length === 1) {
      onChange(formattedParts[0]);
    } else {
      const glue = comb === 'AND' ? ' && ' : ' || ';
      const joined = formattedParts.map((p) => `(${p})`).join(glue);
      onChange(joined);
    }
  };

  const handleRowChange = (id: string, updates: Partial<ConditionRow>) => {
    const nextRows = rows.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, ...updates };
      // If variable changed, reset op and val according to type
      if (updates.varName && updates.varName !== r.varName) {
        const type = variables[updates.varName]?.type || 'number';
        updated.op = '==';
        updated.val = type === 'boolean' ? 'true' : type === 'number' ? '0' : '';
      }
      return updated;
    });
    setRows(nextRows);
    emitRowsChange(nextRows, combinator);
  };

  const handleAddRow = () => {
    const newVar = variableNames[0] || '';
    const type = variables[newVar]?.type || 'number';
    const newRow: ConditionRow = {
      id: `row_${Date.now()}_${Math.random()}`,
      varName: newVar,
      op: '==',
      val: type === 'boolean' ? 'true' : type === 'number' ? '0' : '',
    };
    const nextRows = [...rows, newRow];
    setRows(nextRows);
    emitRowsChange(nextRows, combinator);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) return;
    const nextRows = rows.filter((r) => r.id !== id);
    setRows(nextRows);
    emitRowsChange(nextRows, combinator);
  };

  const handleCombinatorChange = (comb: 'AND' | 'OR') => {
    setCombinator(comb);
    emitRowsChange(rows, comb);
  };

  return (
    <div className={`space-y-2 text-xs ${className}`}>
      <div className="flex items-center justify-between">
        <label className={LABEL_CLASS}>{label}</label>
        <div className="flex items-center bg-muted p-0.5 rounded border border-border">
          <button
            type="button"
            onClick={() => setMode('visual')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              mode === 'visual' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="選択肢を選んで簡単に条件を設定"
          >
            <SlidersHorizontal size={12} />
            <span>ビジュアル</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('expression')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              mode === 'expression' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="式を直接入力（構文自動チェック付き）"
          >
            <Code size={12} />
            <span>式入力</span>
          </button>
        </div>
      </div>

      {mode === 'visual' ? (
        <div className="p-2.5 rounded border border-border bg-card/60 space-y-2.5">
          {variableNames.length === 0 ? (
            <div className="text-[11px] text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
              ※変数が未登録です。「変数」タブから変数を登録してください。
            </div>
          ) : (
            <>
              {isComplex && (
                <div className="text-[11px] text-primary/90 bg-primary/10 p-1.5 rounded flex items-center justify-between">
                  <span>高度な入れ子条件式が設定されています</span>
                  <button
                    type="button"
                    onClick={() => setMode('expression')}
                    className="underline text-[10px] font-bold"
                  >
                    式入力で確認
                  </button>
                </div>
              )}

              {/* Multi-Condition AND / OR Selector (shown if 2+ conditions) */}
              {rows.length > 1 && (
                <div className="flex items-center justify-between p-1.5 bg-muted/40 rounded border border-border/80">
                  <span className="text-[11px] font-medium text-foreground">複数条件の結合:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCombinatorChange('AND')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        combinator === 'AND'
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      すべて満たす (AND)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCombinatorChange('OR')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        combinator === 'OR'
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      いずれかを満たす (OR)
                    </button>
                  </div>
                </div>
              )}

              {/* Condition Rows */}
              <div className="space-y-2">
                {rows.map((row, index) => {
                  const varDef = variables[row.varName];
                  const varType = varDef?.type || 'number';

                  return (
                    <div
                      key={row.id}
                      className="p-2 rounded border border-border/70 bg-background/80 relative space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          条件 {index + 1}
                        </span>
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                            title="この条件を削除"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-1.5">
                        {/* Variable Selector */}
                        <div>
                          <select
                            value={row.varName}
                            onChange={(e) => handleRowChange(row.id, { varName: e.target.value })}
                            className={INPUT_CLASS}
                          >
                            {variableNames.map((vName) => {
                              const type = variables[vName]?.type || 'number';
                              const typeLabel = type === 'boolean' ? '真偽' : type === 'number' ? '数値' : '文字';
                              return (
                                <option key={vName} value={vName}>
                                  {vName} ({typeLabel})
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Operator & Value */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            {varType === 'boolean' ? (
                              <select
                                value={row.val === 'false' ? 'false' : 'true'}
                                onChange={(e) => handleRowChange(row.id, { val: e.target.value })}
                                className={INPUT_CLASS}
                              >
                                <option value="true">True (真・成立)</option>
                                <option value="false">False (偽・不成立)</option>
                              </select>
                            ) : (
                              <select
                                value={row.op}
                                onChange={(e) => handleRowChange(row.id, { op: e.target.value })}
                                className={INPUT_CLASS}
                              >
                                <option value="==">== (等しい)</option>
                                <option value="!=">!= (等しくない)</option>
                                {varType === 'number' && (
                                  <>
                                    <option value=">=">&gt;= (以上)</option>
                                    <option value=">">&gt; (より大きい)</option>
                                    <option value="<=">&lt;= (以下)</option>
                                    <option value="<">&lt; (より小さい)</option>
                                  </>
                                )}
                              </select>
                            )}
                          </div>

                          {varType !== 'boolean' && (
                            <div>
                              <input
                                type={varType === 'number' ? 'number' : 'text'}
                                value={row.val}
                                onChange={(e) => handleRowChange(row.id, { val: e.target.value })}
                                className={INPUT_CLASS}
                                placeholder={varType === 'number' ? '例: 1' : '例: 合言葉'}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Condition Row Button */}
              <button
                type="button"
                onClick={handleAddRow}
                className="w-full py-1 text-[11px] rounded border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary flex items-center justify-center gap-1 transition-colors"
              >
                <Plus size={12} />
                <span>条件を追加 (AND/OR)</span>
              </button>

              {/* Live Expression Chip */}
              {value && (
                <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>生成された条件式:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono font-medium max-w-[340px] break-all" title={value}>
                    {value}
                  </code>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Expression Mode */
        <div className="p-2.5 rounded border border-border bg-card/60 space-y-2">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">
              条件式 (比較演算子: ==, !=, &gt;=, &lt;=, &gt;, &lt; / 論理演算子: &amp;&amp;, ||, !)
            </label>
            <VariableSuggestInput
              value={value || ''}
              onChange={onChange}
              className={INPUT_CLASS}
              placeholder="例: (hp >= 10 && has_key == true) || is_admin == true"
            />
          </div>

          {/* Real-time Syntax & Variable Validation Status */}
          {value && value.trim() ? (
            <div>
              {validationResult.isValid ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span>構文正常</span>
                  {validationResult.variables.length > 0 && (
                    <span className="text-[10px] opacity-80">
                      (参照変数: {validationResult.variables.join(', ')})
                    </span>
                  )}
                </div>
              ) : validationResult.undefinedVariables && validationResult.undefinedVariables.length > 0 ? (
                <div className="flex items-start gap-1.5 text-[11px] text-amber-500 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">未定義の変数: </span>
                    <span>「{validationResult.undefinedVariables.join(', ')}」</span>
                    <span className="block text-[10px] opacity-80">変数タブから事前に定義してください。</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 text-[11px] text-destructive bg-destructive/10 p-1.5 rounded border border-destructive/20">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">構文エラー: </span>
                    <span>{validationResult.error}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              ※条件が成立した時に True ルート、不成立の時に False ルートへ進行します。
            </p>
          )}

          {/* Quick Syntax Presets */}
          <div className="pt-1 border-t border-border/50">
            <span className="text-[10px] text-muted-foreground block mb-1">クイック構文プリセット:</span>
            <div className="flex flex-wrap gap-1">
              {[
                { label: '変数 >= 値', template: `${variableNames[0] || 'count'} >= 1` },
                { label: 'フラグ == true', template: `${variableNames[0] || 'flag'} == true` },
                { label: 'AND (&&)', template: `(${variableNames[0] || 'a'} >= 1) && (${variableNames[1] || 'b'} == true)` },
                { label: 'OR (||)', template: `(${variableNames[0] || 'a'} >= 1) || (${variableNames[1] || 'b'} >= 1)` },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onChange(preset.template)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border border-border/80"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
