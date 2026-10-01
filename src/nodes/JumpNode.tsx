import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Rabbit, AlertTriangle } from 'lucide-react';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { RevealedBadge } from '../components/common/RevealedBadge';
import { StickyIndicator } from '../components/common/StickyIndicator';
import { NodeMarkdown } from '../components/common/NodeMarkdown';

const JumpNode = ({ id: _id, data, selected }: NodeProps<ScenarioNodeData>) => {
  const targetNodeId = typeof data.jumpTarget === 'string'
    ? data.jumpTarget
    : data.jumpTarget?.nodeId;
  const targetTabId = typeof data.jumpTarget === 'object' ? data.jumpTarget?.tabId : null;

  // Primitive selector: returns target node's label if found, null if unconfigured, false if broken link.
  // Because it returns primitive strings/booleans, JumpNode will NOT re-render on node movements or edits to unrelated nodes.
  const targetLabel = useScenarioStore((s) => {
    if (!targetNodeId) return null;
    if (targetTabId) {
      const tab = s.tabs.find((t) => t.id === targetTabId);
      const n = tab?.nodes.find((x) => x.id === targetNodeId);
      return n ? (n.data.label || 'Unknown Node') : false;
    }
    for (const t of s.tabs) {
      const n = t.nodes.find((x) => x.id === targetNodeId);
      if (n) return n.data.label || 'Unknown Node';
    }
    return false;
  });

  const isBroken = !data.jumpTarget || targetLabel === false;
  const description = data.description;

  return (
    <div
        className={`px-4 py-3 shadow-sm rounded-md border-2 min-w-[180px] min-h-[80px] w-max relative transition-shadow duration-200 cursor-pointer
      ${selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
      ${isBroken ? 'border-amber-500 dark:border-amber-600 bg-amber-50/50 dark:bg-yellow-950/40 text-amber-900 dark:text-amber-100' : 'border-yellow-400 dark:border-yellow-600 bg-yellow-100 dark:bg-yellow-900/60 text-yellow-900 dark:text-yellow-100'}
      hover:shadow-md
    `}>

      {data.hasSticky && <StickyIndicator />}
      {data.revealed && <RevealedBadge />}
      <div className="flex flex-col">
        <div className="flex items-center gap-2 flex-wrap">
            <div className="rounded-full p-2 bg-yellow-200 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-300 shrink-0">
                <Rabbit size={16} />
            </div>
            {isBroken && (
              <span
                className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 font-bold shrink-0 border border-amber-400"
                title={!data.jumpTarget ? 'ジャンプ先が設定されていません' : 'ジャンプ先ノードが見つかりません（リンク切れ）'}
              >
                <AlertTriangle size={12} className="text-amber-700 dark:text-amber-300" />
                {!data.jumpTarget ? 'ジャンプ先未設定' : 'リンク切れ'}
              </span>
            )}
            <div className="font-bold text-base text-yellow-900 dark:text-yellow-100">
                <NodeMarkdown content={data.label} inline />
            </div>
        </div>

        {description && (
            <div className="mt-2 pt-2 border-t border-yellow-300 dark:border-yellow-700">
                <div className="text-sm opacity-90 text-yellow-900 dark:text-yellow-100">
                    <NodeMarkdown content={data.description} />
                </div>
            </div>
        )}

        <div className="mt-2 pt-2 border-t border-yellow-300 dark:border-yellow-700">
          <label className="text-sm uppercase font-bold opacity-70 block mb-1 cursor-pointer text-yellow-900 dark:text-yellow-100">Jump To</label>
          <div className={`text-sm p-1 rounded border min-h-[24px] cursor-pointer ${isBroken ? 'border-amber-400 bg-amber-100/60 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300' : 'border-yellow-300 dark:border-yellow-700 bg-white/50 dark:bg-black/20'}`}>
              {typeof targetLabel === 'string' ? (
                  <NodeMarkdown content={targetLabel} inline />
              ) : (
                  <span className="opacity-70 italic font-semibold">{!data.jumpTarget ? '⚠️ 未設定' : '⚠️ リンク切れ (削除済)'}</span>
              )}
          </div>
        </div>
      </div>

      <Handle type="target" position={Position.Top} className="!bg-yellow-500" />
      
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

export default memo(JumpNode);

