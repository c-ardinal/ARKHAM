import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { StickyNote } from 'lucide-react';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';
import { RevealedBadge } from '../components/common/RevealedBadge';
import { StickyIndicator } from '../components/common/StickyIndicator';

const MemoNode = ({ data, selected }: NodeProps<ScenarioNodeData>) => {
  const variables = useScenarioStore((s) => s.gameState.variables);

  return (
    <div className={`px-4 py-3 shadow-md rounded-md border-2 min-w-[180px] min-h-[100px] w-max relative transition-shadow duration-200
      ${selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
      border-slate-200 dark:border-slate-700
      bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
      hover:shadow-lg
    `}>

      {data.hasSticky && <StickyIndicator />}
      {data.revealed && <RevealedBadge />}
      <div className="flex items-center mb-2">
        <StickyNote size={16} className="mr-2 opacity-70" />
        <div className="font-bold text-base">{substituteVariables(data.label, variables)}</div>
      </div>
      <div className="text-sm whitespace-pre-wrap opacity-90 leading-relaxed">
        {substituteVariables(data.description || '', variables)}
      </div>
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
      
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

export default memo(MemoNode);
