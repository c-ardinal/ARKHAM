import React, { useState, useMemo, useEffect } from 'react';
import { validateExpression, type ValidationResult } from '../core/expression';
import { INPUT_CLASS, LABEL_CLASS } from '../styles/common';
import { CheckCircle2, AlertTriangle, AlertCircle, Code, SlidersHorizontal } from 'lucide-react';
import { VariableSuggestInput } from './VariableSuggestInput';

export interface VisualConditionBuilderProps {
  value: string;
  onChange: (val: string) => void;
  variables: Record<string, { type: 'number' | 'boolean' | 'string'; value: any }>;
  label?: string;
  className?: string;
}

type Mode = 'visual' | 'expression';

/**
 * Parses simple expressions like:
 * - "alarm >= 2"
 * - "flag == true"
 * - "name == 'boss'"
 */
function parseSimpleExpression(
  expr: string
): { varName: string; op: string; val: string } | null {
  if (!expr || !expr.trim()) return null;
  const cleaned = expr.trim().replace(/^\${(.*)}$/, '$1');

  // Match: <identifier> <operator> <literal>
  const match = cleaned.match(/^([a-zA-Z0-9_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!match) return null;

  const varName = match[1].trim();
  const op = match[2].trim();
  let rawVal = match[3].trim();

  // Strip quotes if string
  if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
    rawVal = rawVal.slice(1, -1);
  }

  return { varName, op, val: rawVal };
}

export const VisualConditionBuilder: React.FC<VisualConditionBuilderProps> = ({
  value,
  onChange,
  variables,
  label = '条件判定の設定',
  className = '',
}) => {
  const variableNames = useMemo(() => Object.keys(variables), [variables]);

  // Initial detection: if expression is non-empty and cannot be parsed simply, start in 'expression' mode
  const initialParsed = useMemo(() => parseSimpleExpression(value), [value]);
  const isComplex = Boolean(value && value.trim() && !initialParsed);

  const [mode, setMode] = useState<Mode>(() => (isComplex ? 'expression' : 'visual'));

  // Visual builder local states
  const defaultVar = variableNames[0] || '';
  const [selectedVar, setSelectedVar] = useState<string>(() => initialParsed?.varName || defaultVar);
  const [selectedOp, setSelectedOp] = useState<string>(() => initialParsed?.op || '==');
  const [targetVal, setTargetVal] = useState<string>(() => initialParsed?.val ?? '0');

  // Sync if value changes externally
  useEffect(() => {
    const parsed = parseSimpleExpression(value);
    if (parsed) {
      setSelectedVar(parsed.varName);
      setSelectedOp(parsed.op);
      setTargetVal(parsed.val);
    }
  }, [value]);

  const activeVarDef = variables[selectedVar];
  const activeVarType = activeVarDef?.type || 'number';

  // Compute validation result for expression mode
  const validationResult: ValidationResult = useMemo(() => {
    if (!value || !value.trim()) {
      return { isValid: true, variables: [], usedVariables: [], undefinedVariables: [] };
    }
    return validateExpression(value, variableNames);
  }, [value, variableNames]);

  // Emit updated visual expression
  const emitVisualChange = (varName: string, op: string, val: string) => {
    if (!varName) {
      onChange('');
      return;
    }
    const varDef = variables[varName];
    const type = varDef?.type || 'number';

    let formattedExpr = '';
    if (type === 'boolean') {
      formattedExpr = `${varName} ${op} ${val === 'false' ? 'false' : 'true'}`;
    } else if (type === 'number') {
      const numVal = isNaN(Number(val)) ? 0 : Number(val);
      formattedExpr = `${varName} ${op} ${numVal}`;
    } else {
      // String
      formattedExpr = `${varName} ${op} "${val}"`;
    }

    onChange(formattedExpr);
  };

  const handleVarChange = (newVar: string) => {
    setSelectedVar(newVar);
    const newTypeDef = variables[newVar]?.type || 'number';
    let newOp = '==';
    let newVal = '0';
    if (newTypeDef === 'boolean') {
      newOp = '==';
      newVal = 'true';
    } else if (newTypeDef === 'string') {
      newOp = '==';
      newVal = '';
    }
    setSelectedOp(newOp);
    setTargetVal(newVal);
    emitVisualChange(newVar, newOp, newVal);
  };

  const handleOpChange = (newOp: string) => {
    setSelectedOp(newOp);
    emitVisualChange(selectedVar, newOp, targetVal);
  };

  const handleValChange = (newVal: string) => {
    setTargetVal(newVal);
    emitVisualChange(selectedVar, selectedOp, newVal);
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
                  <span>複合条件式が設定されています</span>
                  <button
                    type="button"
                    onClick={() => setMode('expression')}
                    className="underline text-[10px] font-bold"
                  >
                    式入力で確認
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2">
                {/* Variable Selector */}
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">対象変数</label>
                  <select
                    value={selectedVar}
                    onChange={(e) => handleVarChange(e.target.value)}
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">比較条件</label>
                    {activeVarType === 'boolean' ? (
                      <select
                        value={targetVal === 'false' ? 'false' : 'true'}
                        onChange={(e) => handleValChange(e.target.value)}
                        className={INPUT_CLASS}
                      >
                        <option value="true">True (真・成立)</option>
                        <option value="false">False (偽・不成立)</option>
                      </select>
                    ) : (
                      <select
                        value={selectedOp}
                        onChange={(e) => handleOpChange(e.target.value)}
                        className={INPUT_CLASS}
                      >
                        <option value="==">== (等しい)</option>
                        <option value="!=">!= (等しくない)</option>
                        {activeVarType === 'number' && (
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

                  {activeVarType !== 'boolean' && (
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        比較する値 ({activeVarType === 'number' ? '数値' : '文字列'})
                      </label>
                      <input
                        type={activeVarType === 'number' ? 'number' : 'text'}
                        value={targetVal}
                        onChange={(e) => handleValChange(e.target.value)}
                        className={INPUT_CLASS}
                        placeholder={activeVarType === 'number' ? '例: 1' : '例: 合言葉'}
                      />
                    </div>
                  )}
                </div>

                {/* Live Expression Chip */}
                {value && (
                  <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>生成された条件式:</span>
                    <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono font-medium">
                      {value}
                    </code>
                  </div>
                )}
              </div>
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
              placeholder="例: hp >= 10 && has_key == true"
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
                { label: 'AND (&&)', template: `${variableNames[0] || 'a'} >= 1 && ${variableNames[1] || 'b'} == true` },
                { label: 'OR (||)', template: `${variableNames[0] || 'a'} >= 1 || ${variableNames[1] || 'b'} >= 1` },
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
