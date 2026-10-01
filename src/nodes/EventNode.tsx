import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { RevealedBadge } from '../components/common/RevealedBadge';
import { StickyIndicator } from '../components/common/StickyIndicator';
import { useTranslation } from '../hooks/useTranslation';

import { Flag, Star, Clock, KeyRound, Gift, Zap, Dices, AlertTriangle } from 'lucide-react';
import { NodeMarkdown } from '../components/common/NodeMarkdown';

const EventNode = ({ id, data, selected }: NodeProps<ScenarioNodeData>) => {
  const { t } = useTranslation();

  // Only subscribe to resources if the node actually has items
  const hasItems = Boolean(
    (data.requiredItems && data.requiredItems.length > 0) ||
    (data.acquiredItems && data.acquiredItems.length > 0)
  );
  const resources = useScenarioStore((s) => (hasItems ? s.resources : null));
  const itemMap = useMemo(() => {
    if (!resources) return null;
    return new Map(resources.map((r) => [r.id, r.name]));
  }, [resources]);

  // Return primitive number so Zustand avoids re-rendering this node when other edges change
  const narrativeOutCount = useScenarioStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    if (!tab) return 0;
    let count = 0;
    for (const e of tab.edges) {
      if (
        e.source === id &&
        e.type !== 'reference' &&
        !e.sourceHandle?.startsWith('ref-') &&
        !e.targetHandle?.startsWith('ref-')
      ) {
        count++;
      }
    }
    return count;
  });
  const hasMultipleOutputs = narrativeOutCount > 1;

  const hasBadges = Boolean(
    data.timeCostMinutes ||
    hasItems ||
    (data.variableOperations && data.variableOperations.length > 0) ||
    data.resourceCheck ||
    data.sanCheck
  );

  return (
    <div className={`relative px-4 py-2 shadow-sm hover:shadow-md rounded-md border-2 min-w-[150px] max-w-[420px] w-max transition-shadow duration-200 ${
      selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
    } ${
      hasMultipleOutputs
        ? 'border-amber-500 dark:border-amber-600 bg-amber-50/30 dark:bg-amber-950/30'
        : 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20'
    }`}>
      {data.hasSticky && <StickyIndicator />}
      {data.revealed && <RevealedBadge />}
      {!data.isStart && (
        <Handle
          type="target"
          position={Position.Top}
          id="flow-target"
          className="!rounded-full !w-3.5 !h-3.5 !bg-orange-400 dark:!bg-orange-600 border-2 border-background shadow-sm hover:ring-2 hover:ring-orange-400/60 transition-colors"
        />
      )}

      <div className="flex flex-col">
        <div className="flex items-center">
          <div className="rounded-full p-2 mr-2 bg-orange-100 text-orange-600 dark:bg-orange-800 dark:text-orange-300 shrink-0">
            <Flag size={16} />
          </div>
          <div className="flex items-center gap-2">
            {data.isStart && (
              <Star
                size={14}
                className="mr-1 fill-yellow-400 text-yellow-500 shrink-0"
                aria-label={t('common.startNode') || 'Start Node'}
              />
            )}
            {typeof data.chapter === 'number' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-200/80 dark:bg-orange-800/80 text-orange-800 dark:text-orange-200 font-medium shrink-0">
                第{data.chapter}章
              </span>
            )}
            {hasMultipleOutputs && (
              <span
                className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 font-medium shrink-0 border border-amber-300 dark:border-amber-700"
                title="イベントノードの出力は1本のみです。複数分岐する場合は「分岐ノード」を使用してください。"
              >
                <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
                複数出力不可 ({narrativeOutCount}本)
              </span>
            )}
            <div className="text-lg font-bold text-orange-900 dark:text-orange-100 break-words">
              <NodeMarkdown content={data.label} inline />
            </div>
          </div>
        </div>

        {/* Encapsulated Event Badges */}
        {hasBadges && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-1.5 border-t border-orange-200/60 dark:border-orange-800/60 max-w-full">
            {typeof data.timeCostMinutes === 'number' && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 border border-orange-200/60 dark:border-orange-800/60 font-medium shrink-0">
                <Clock size={10} className="shrink-0" />
                <span>{data.timeCostMinutes}分</span>
              </span>
            )}

            {data.requiredItems && data.requiredItems.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200/80 dark:border-amber-800/80 font-medium max-w-[280px] break-words" title={data.requiredItems.map((id) => itemMap?.get(id) || id).join(', ')}>
                <KeyRound size={10} className="shrink-0" />
                <span>要: {data.requiredItems.map((id) => itemMap?.get(id) || id).join(', ')}</span>
              </span>
            )}

            {data.acquiredItems && data.acquiredItems.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/80 font-medium max-w-[280px] break-words" title={data.acquiredItems.map((id) => itemMap?.get(id) || id).join(', ')}>
                <Gift size={10} className="shrink-0" />
                <span>獲: {data.acquiredItems.map((id) => itemMap?.get(id) || id).join(', ')}</span>
              </span>
            )}

            {data.variableOperations && data.variableOperations.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800/80 font-medium max-w-[280px] break-words" title={data.variableOperations.map((op) => `${op.variableName} ${op.operator === 'add' ? '+=' : op.operator === 'subtract' ? '-=' : '='} ${op.value}`).join('\n')}>
                <Zap size={10} className="shrink-0" />
                <span>{data.variableOperations.map((op) => `${op.variableName} ${op.operator === 'add' ? '+' : op.operator === 'subtract' ? '-' : '='}${op.value}`).join(', ')}</span>
              </span>
            )}

            {(data.resourceCheck || data.sanCheck) && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border border-purple-200/80 dark:border-purple-800/80 font-medium max-w-[280px] break-words">
                <Dices size={10} className="shrink-0" />
                <span>{(data.resourceCheck || data.sanCheck)?.trigger || '判定あり'}</span>
              </span>
            )}
          </div>
        )}
        
        {data.description && (
            <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-800">
                <div className="text-sm opacity-80 text-orange-800 dark:text-orange-200/70 break-words">
                    <NodeMarkdown content={data.description} />
                </div>
            </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="flow-source"
        className="!rounded-full !w-3.5 !h-3.5 !bg-orange-400 dark:!bg-orange-600 border-2 border-background shadow-sm hover:ring-2 hover:ring-orange-400/60 transition-colors"
      />

      {/* Reference Handle (Square ■ for characters, stages, elements, memos) */}
      <Handle
        type="source"
        position={Position.Right}
        id="ref-source"
        className="!rounded-[2px] !w-3.5 !h-3.5 !bg-teal-500 dark:!bg-teal-400 border-2 border-background shadow-sm hover:ring-2 hover:ring-teal-400/60 transition-colors"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
        title="補足・参照ノードを接続 (四角ピン)"
      />
      
      {/* Sticky Note Connection Handle - Placed at end to avoid interfering with default handles */}
      <Handle 
          type="source" 
          id="sticky-origin" 
          position={Position.Right} 
          className="!w-1 !h-1 !bg-transparent !border-none !min-w-0 !min-h-0" 
          style={{ top: -7, right: -7, position: 'absolute' }}   
          isConnectable={false} 
      />
    </div>
  );
};

export default memo(EventNode);
