import { memo, useEffect } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Forward } from 'lucide-react';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';

const JumpNode = ({ id, data, selected }: NodeProps<ScenarioNodeData>) => {
  const { nodes, gameState, updateNodeData } = useScenarioStore();

  // Auto-select first available node if target is empty
  useEffect(() => {
      if (!data.jumpTarget) {
          const availableNodes = nodes.filter(n => n.id !== id);
          if (availableNodes.length > 0) {
              updateNodeData(id, { jumpTarget: availableNodes[0].id });
          }
      }
  }, [data.jumpTarget, nodes, id, updateNodeData]);

  return (
    <div 
        className={`px-4 py-3 shadow-md rounded-md border-2 min-w-[180px] min-h-[80px] relative transition-all duration-200 cursor-pointer
      ${selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
      border-yellow-400 dark:border-yellow-600
      bg-yellow-100 dark:bg-yellow-900/60 text-yellow-900 dark:text-yellow-100
      hover:shadow-lg
    `}>
      {data.revealed && (
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm z-10 border-2 border-background">
              <span className="text-white font-bold text-xs">✓</span>
          </div>
      )}
      <div className="flex items-center mb-2">
        <Forward size={16} className="mr-2 opacity-70" />
        <div className="font-bold text-sm">{substituteVariables(data.label, gameState.variables)}</div>
      </div>
      
      <div className="text-xs mb-2 opacity-90">
        {substituteVariables(data.description || '', gameState.variables)}
      </div>

      <div className="mt-2">
          <label className="text-[10px] uppercase font-bold opacity-70 block mb-1 cursor-pointer">Jump To</label>
          <div className="text-xs p-1 rounded border border-yellow-300 dark:border-yellow-700 bg-white/50 dark:bg-black/20 min-h-[24px] cursor-pointer">
              {data.jumpTarget ? (
                  substituteVariables(nodes.find(n => n.id === data.jumpTarget)?.data.label || 'Unknown Node', gameState.variables)
              ) : (
                  <span className="opacity-50 italic">None</span>
              )}
          </div>
      </div>

      <Handle type="target" position={Position.Top} className="!bg-yellow-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-500" />
    </div>
  );
};

export default memo(JumpNode);
