import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { BranchNodeData } from '../types';
import { useScenarioStore, useAllVariables } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';
import { RevealedBadge } from '../components/common/RevealedBadge';
import { StickyIndicator } from '../components/common/StickyIndicator';
import { GitBranch, AlertTriangle } from 'lucide-react';
import { NodeMarkdown } from '../components/common/NodeMarkdown';

const BranchNode = ({ id, data, selected }: NodeProps<BranchNodeData>) => {
  const variables = useAllVariables();
  const edges = useScenarioStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.edges || []);

  const label = substituteVariables(data.label, variables);
  const description = substituteVariables(data.description || '', variables);
  const conditionValue = substituteVariables(data.conditionValue || '', variables);

  const rawBranches = data.branches || [];
  const hasLegacyCondition = Boolean(data.conditionValue);
  const effectiveBranches = rawBranches.length > 0 
    ? rawBranches 
    : (hasLegacyCondition ? [{ id: 'true', label: 'True (条件一致)', conditionValue: data.conditionValue, conditionType: data.conditionType || 'variable' }] : []);

  const isMulti = effectiveBranches.length >= 2;

  // Helper to check which pin has an outgoing edge for this branch route
  const isRightConnected = (bId: string) =>
    edges.some((e) => {
      if (e.source !== id) return false;
      const sh = e.sourceHandle || '';
      if (sh === bId || sh === `${bId}-right`) return true;
      if (bId === 'false' && (sh === 'else' || sh === 'else-right')) return true;
      if (bId === 'else' && (sh === 'false' || sh === 'false-right')) return true;
      return false;
    });

  const isLeftConnected = (bId: string) =>
    edges.some((e) => {
      if (e.source !== id) return false;
      const sh = e.sourceHandle || '';
      if (sh === `${bId}-left`) return true;
      if (bId === 'false' && sh === 'else-left') return true;
      if (bId === 'else' && sh === 'false-left') return true;
      return false;
    });

  const elseRightUsed = isRightConnected('else');
  const elseLeftUsed = isLeftConnected('else');

  const trueUsed = isRightConnected(effectiveBranches[0]?.id || 'true') || isLeftConnected(effectiveBranches[0]?.id || 'true');
  const falseUsed = isRightConnected('false') || isLeftConnected('false') || elseRightUsed || elseLeftUsed;

  const showElseRow = isMulti && !effectiveBranches.some((b) => b.id === 'else');

  const hasUnconnectedRoutes = isMulti
    ? effectiveBranches.some((b) => !isRightConnected(b.id) && !isLeftConnected(b.id))
    : (!trueUsed || !falseUsed);

  const hasUnconnectedElse = showElseRow && !elseRightUsed && !elseLeftUsed;

  return (
    <div className={`relative px-4 py-2.5 shadow-sm hover:shadow-md rounded-md border-2 min-w-[180px] max-w-[420px] w-max transition-shadow duration-200 ${
      selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
    } ${
      hasUnconnectedRoutes
        ? 'border-amber-400 dark:border-amber-600 bg-amber-50/20 dark:bg-purple-900/30'
        : hasUnconnectedElse
          ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/40'
          : 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/40'
    }`}>

      {data.hasSticky && <StickyIndicator />}
      {data.revealed && <RevealedBadge />}
      <Handle type="target" position={Position.Top} className="w-16 !bg-purple-400 dark:!bg-purple-500" />
      
      <div className="flex flex-col">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="rounded-full p-2 mr-1 bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300 shrink-0">
            <GitBranch size={16} />
          </div>
          {typeof data.chapter === 'number' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-200/80 dark:bg-purple-800/80 text-purple-800 dark:text-purple-200 font-medium shrink-0">
              第{data.chapter}章
            </span>
          )}
          {hasUnconnectedRoutes && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 font-medium shrink-0 border border-amber-300 dark:border-amber-700"
              title="出力エッジが接続されていない未接続のルート（経路）が存在します"
            >
              <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
              未接続あり
            </span>
          )}
          {!hasUnconnectedRoutes && hasUnconnectedElse && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 font-medium shrink-0 border border-amber-300/80 dark:border-amber-700/80"
              title="フォールバックルート「その他 (Else)」が出力エッジに未接続です（警告）"
            >
              <AlertTriangle size={11} className="text-amber-600 dark:text-amber-400" />
              Else未接続
            </span>
          )}
          <div className="text-base font-bold text-purple-900 dark:text-purple-100 break-words">
            <NodeMarkdown content={label} inline />
          </div>
        </div>

        {description && (
          <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800">
            <div className="text-sm opacity-80 text-purple-900 dark:text-purple-300/70 break-words">
              <NodeMarkdown content={description} />
            </div>
          </div>
        )}

        <div className="mt-2 pt-1.5 border-t border-purple-200 dark:border-purple-800 text-center">
          <span className="text-[11px] text-purple-900/80 dark:text-purple-200/80 bg-purple-200/50 dark:bg-purple-800/50 rounded px-2 py-0.5 font-medium break-words inline-block max-w-full">
            {isMulti 
              ? `条件分岐 (${effectiveBranches.length} ルート)` 
              : (effectiveBranches[0]?.conditionValue ? `条件: ${effectiveBranches[0].conditionValue}` : (conditionValue ? `条件: ${conditionValue}` : '条件分岐'))}
          </span>
        </div>
      </div>

      {/* When 1 route (or default): Progressive True / False Bottom Pin layout */}
      {!isMulti && (
        <div className="flex justify-between items-center mt-3 pt-2 border-t border-purple-200/60 dark:border-purple-800/60 gap-6">
          <div className="relative flex flex-col items-center max-w-[220px] text-center">
            <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 font-bold mb-1 break-words">
              {!trueUsed && (
                <span title="Trueルートに出力エッジが接続されていません">
                  <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
                </span>
              )}
              {effectiveBranches[0]?.label && !effectiveBranches[0].label.startsWith('ルート ')
                ? effectiveBranches[0].label
                : 'True (一致)'}
            </span>
            <Handle 
              type="source" 
              position={Position.Bottom} 
              id={effectiveBranches[0]?.id || 'true'} 
              className={`!left-auto ${!trueUsed ? '!bg-amber-500 ring-2 ring-amber-300 dark:ring-amber-700' : '!bg-green-500'}`}
              title={!trueUsed ? '【未接続】エッジを接続してください' : undefined}
            />
            {/* Alias handle for 'true' */}
            {effectiveBranches[0]?.id && effectiveBranches[0].id !== 'true' && (
              <Handle 
                type="source" 
                position={Position.Bottom} 
                id="true" 
                className="!opacity-0 !pointer-events-none !left-auto" 
              />
            )}
          </div>

          <div className="relative flex flex-col items-center max-w-[220px] text-center">
            <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400 font-bold mb-1 break-words">
              {!falseUsed && (
                <span title="Falseルートに出力エッジが接続されていません">
                  <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
                </span>
              )}
              False (不一致 / その他)
            </span>
            <Handle 
              type="source" 
              position={Position.Bottom} 
              id="false" 
              className={`!left-auto ${!falseUsed ? '!bg-amber-500 ring-2 ring-amber-300 dark:ring-amber-700' : '!bg-red-500'}`}
              title={!falseUsed ? '【未接続】エッジを接続してください' : undefined}
            />
            {/* Alias handle for 'else' */}
            <Handle 
              type="source" 
              position={Position.Bottom} 
              id="else" 
              className="!opacity-0 !pointer-events-none !left-auto" 
            />
          </div>
        </div>
      )}

      {/* When 2 or more routes: Progressive Multi-Exit Dual-Sided (Left & Right) Pin layout */}
      {isMulti && (
        <div className="flex flex-col mt-2 gap-1.5 pt-2 border-t border-purple-200 dark:border-purple-800">
          {effectiveBranches.map((branch, index) => {
            const rightUsed = isRightConnected(branch.id);
            const leftUsed = isLeftConnected(branch.id);
            const isUnconnected = !rightUsed && !leftUsed;

            return (
              <div
                key={branch.id}
                className={`relative flex items-center justify-between min-h-[26px] py-1 pl-4 pr-4 rounded text-xs gap-2 transition-colors ${
                  isUnconnected
                    ? 'bg-amber-100/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80'
                    : 'bg-purple-100/70 dark:bg-purple-800/50'
                }`}
              >
                {/* Left Pin */}
                <Handle 
                  type="source" 
                  position={Position.Left} 
                  id={`${branch.id}-left`} 
                  isConnectable={!rightUsed}
                  className={`!w-2.5 !h-2.5 !left-[-5px] transition-colors ${
                    rightUsed
                      ? '!bg-slate-300 dark:!bg-slate-600 !border !border-dashed !border-slate-400 opacity-40 cursor-not-allowed'
                      : isUnconnected
                        ? '!bg-amber-500 ring-2 ring-amber-300 dark:ring-amber-600'
                        : '!bg-purple-600 dark:!bg-purple-400'
                  }`}
                  style={{ top: '50%', transform: 'translateY(-50%)' }}
                  title={rightUsed ? '右側ピンに接続済みのため接続不可' : isUnconnected ? '【未接続】左側へ接続' : '左側へ接続'}
                />

                <span className="inline-flex items-center justify-center gap-1 text-purple-950 dark:text-purple-100 font-bold break-words leading-tight max-w-[320px] text-center flex-1" title={branch.label}>
                  {isUnconnected && (
                    <span title="このルートに出力エッジが接続されていません">
                      <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    </span>
                  )}
                  {branch.label || `ルート ${index + 1}`}
                </span>

                {/* Right Pin */}
                <Handle 
                  type="source" 
                  position={Position.Right} 
                  id={branch.id} 
                  isConnectable={!leftUsed}
                  className={`!w-2.5 !h-2.5 !right-[-5px] transition-colors ${
                    leftUsed
                      ? '!bg-slate-300 dark:!bg-slate-600 !border !border-dashed !border-slate-400 opacity-40 cursor-not-allowed'
                      : isUnconnected
                        ? '!bg-amber-500 ring-2 ring-amber-300 dark:ring-amber-600'
                        : '!bg-purple-600 dark:!bg-purple-400'
                  }`}
                  style={{ top: '50%', transform: 'translateY(-50%)' }}
                  title={leftUsed ? '左側ピンに接続済みのため接続不可' : isUnconnected ? '【未接続】右側へ接続' : '右側へ接続'}
                />
                {/* When branch.id is 'false', provide alias handles so edges with 'else'/'else-left' properly dock here */}
                {branch.id === 'false' && (
                  <>
                    <Handle 
                      type="source" 
                      position={Position.Left} 
                      id="else-left" 
                      className="!opacity-0 !pointer-events-none !left-[-5px]" 
                      style={{ top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <Handle 
                      type="source" 
                      position={Position.Right} 
                      id="else" 
                      className="!opacity-0 !pointer-events-none !right-[-5px]" 
                      style={{ top: '50%', transform: 'translateY(-50%)' }}
                    />
                  </>
                )}
              </div>
            );
          })}

          {/* Else Route Row with Dual-Sided Pins (rendered only when explicit or needed) */}
          {/* Else Route Row with Dual-Sided Pins (rendered for multi-route branches) */}
          {showElseRow && (
            <div className={`relative flex items-center justify-between min-h-[26px] py-1 pl-4 pr-4 rounded text-xs gap-2 transition-colors ${
              elseRightUsed || elseLeftUsed
                ? 'bg-purple-100/70 dark:bg-purple-800/50'
                : 'bg-amber-50/40 dark:bg-amber-950/20 border border-amber-300/60 dark:border-amber-700/60'
            }`}>
              {/* Left Else Pin */}
              <Handle 
                type="source" 
                position={Position.Left} 
                id="else-left" 
                isConnectable={!elseRightUsed}
                className={`!w-2.5 !h-2.5 !left-[-5px] transition-colors ${
                  elseRightUsed
                    ? '!bg-slate-300 dark:!bg-slate-600 !border !border-dashed !border-slate-400 opacity-40 cursor-not-allowed'
                    : elseLeftUsed
                      ? '!bg-purple-600 dark:!bg-purple-400'
                      : '!bg-amber-500 ring-2 ring-amber-300 dark:ring-amber-600'
                }`}
                style={{ top: '50%', transform: 'translateY(-50%)' }}
                title={elseRightUsed ? '右側ピンに接続済みのため接続不可' : !elseLeftUsed ? '【未接続 (警告)】左側へ接続 (その他)' : '左側へ接続 (その他)'}
              />

              <span className="text-muted-foreground font-semibold flex-1 text-center inline-flex items-center justify-center gap-1">
                {!elseRightUsed && !elseLeftUsed && (
                  <span title="その他 (Else) ルートに出力エッジが接続されていません（警告）">
                    <AlertTriangle size={11} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  </span>
                )}
                その他 (Else)
              </span>

              {/* Right Else Pin */}
              <Handle 
                type="source" 
                position={Position.Right} 
                id="else" 
                isConnectable={!elseLeftUsed}
                className={`!w-2.5 !h-2.5 !right-[-5px] transition-colors ${
                  elseLeftUsed
                    ? '!bg-slate-300 dark:!bg-slate-600 !border !border-dashed !border-slate-400 opacity-40 cursor-not-allowed'
                    : elseRightUsed
                      ? '!bg-purple-600 dark:!bg-purple-400'
                      : '!bg-amber-500 ring-2 ring-amber-300 dark:ring-amber-600'
                }`}
                style={{ top: '50%', transform: 'translateY(-50%)' }}
                title={elseLeftUsed ? '左側ピンに接続済みのため接続不可' : !elseRightUsed ? '【未接続 (警告)】右側へ接続 (その他)' : '右側へ接続 (その他)'}
              />
            </div>
          )}
        </div>
      )}
      
      <Handle 
        type="source" 
        id="sticky-origin" 
        position={Position.Right} 
        className="!w-1 !h-1 !bg-transparent !border-none !min-w-0 !min-h-0" 
        style={{ top: -6, right: -6, position: 'absolute' }} 
        isConnectable={false} 
      />
    </div>
  );
};

export default memo(BranchNode);
