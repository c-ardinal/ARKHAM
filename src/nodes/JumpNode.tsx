import { memo, useEffect } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Rabbit } from 'lucide-react';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';
import { RevealedBadge } from '../components/common/RevealedBadge';
import { StickyIndicator } from '../components/common/StickyIndicator';

const JumpNode = ({ id, data, selected }: NodeProps<ScenarioNodeData>) => {
  const nodes = useScenarioStore((s) => s.nodes);
  const variables = useScenarioStore((s) => s.gameState.variables);
  const updateNodeData = useScenarioStore((s) => s.updateNodeData);
  const description = data.description;

  // Auto-select first available node if target is empty
  // TODO(Task 5.x): Re-enable with proper {tabId,nodeId} payload after JumpTargetCombobox lands
  // Disabled during type transition to avoid writing string-form ID into object field.
  useEffect(() => {
      // intentionally no-op until Phase 5
  }, [data.jumpTarget, nodes, id, updateNodeData]);

  return (
    <div
        className={`px-4 py-3 shadow-sm rounded-md border-2 min-w-[180px] min-h-[80px] w-max relative transition-shadow duration-200 cursor-pointer
      ${selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
      border-yellow-400 dark:border-yellow-600
      bg-yellow-100 dark:bg-yellow-900/60 text-yellow-900 dark:text-yellow-100
      hover:shadow-md
    `}>

      {data.hasSticky && <StickyIndicator />}
      {data.revealed && <RevealedBadge />}
      <div className="flex flex-col">
        <div className="flex items-center">
            <div className="rounded-full p-2 mr-2 bg-yellow-200 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-300 shrink-0">
                <Rabbit size={16} />
            </div>
            <div className="font-bold text-base text-yellow-900 dark:text-yellow-100">
                {substituteVariables(data.label, variables)}
            </div>
        </div>

        {description && (
            <div className="mt-2 pt-2 border-t border-yellow-300 dark:border-yellow-700">
                <div className="text-sm opacity-90 whitespace-pre-wrap text-yellow-900 dark:text-yellow-100">
                    {substituteVariables(data.description || '', variables)}
                </div>
            </div>
        )}

        <div className="mt-2 pt-2 border-t border-yellow-300 dark:border-yellow-700">
          <label className="text-sm uppercase font-bold opacity-70 block mb-1 cursor-pointer text-yellow-900 dark:text-yellow-100">Jump To</label>
          <div className="text-sm p-1 rounded border border-yellow-300 dark:border-yellow-700 bg-white/50 dark:bg-black/20 min-h-[24px] cursor-pointer">
              {data.jumpTarget ? (
                  (() => {
                      const targetNodeId = typeof data.jumpTarget === 'string'
                          ? data.jumpTarget
                          : data.jumpTarget.nodeId;
                      return substituteVariables(nodes.find(n => n.id === targetNodeId)?.data.label || 'Unknown Node', variables);
                  })()
              ) : (
                  <span className="opacity-50 italic">None</span>
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
