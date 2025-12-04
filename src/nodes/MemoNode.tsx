import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { StickyNote } from 'lucide-react';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';

const MemoNode = ({ data, selected }: NodeProps<ScenarioNodeData>) => {
  const { gameState } = useScenarioStore();

  return (
    <div className={`px-4 py-3 shadow-md rounded-md border-2 min-w-[180px] min-h-[100px] relative transition-all duration-200
      ${selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
      border-yellow-200 dark:border-yellow-800
      bg-yellow-50 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100
      hover:shadow-lg
    `}>
      {data.revealed && (
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm z-10 border-2 border-background">
              <span className="text-white font-bold text-xs">✓</span>
          </div>
      )}
      <div className="flex items-center mb-2">
        <StickyNote size={16} className="mr-2 opacity-70" />
        <div className="font-bold text-sm">{substituteVariables(data.label, gameState.variables)}</div>
      </div>
      <div className="text-xs whitespace-pre-wrap opacity-90 leading-relaxed">
        {substituteVariables(data.description || '', gameState.variables)}
      </div>
      <Handle type="target" position={Position.Top} className="!bg-yellow-400" />
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-400" />
    </div>
  );
};

export default memo(MemoNode);
