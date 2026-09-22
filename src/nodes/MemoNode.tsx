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
    <div className={`px-4 py-3 shadow-sm rounded-md border-2 min-w-[180px] min-h-[100px] w-max relative transition-shadow duration-200
      ${selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
      border-slate-200 dark:border-slate-700
      bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
      hover:shadow-md
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
      <Handle
        type="target"
        position={Position.Top}
        id="flow-target"
        className="!rounded-full !w-3.5 !h-3.5 !bg-slate-400 border-2 border-background shadow-sm hover:scale-125 transition-transform"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="flow-source"
        className="!rounded-full !w-3.5 !h-3.5 !bg-slate-400 border-2 border-background shadow-sm hover:scale-125 transition-transform"
      />
      
      {/* Reference Handles (Square ■ for linking as supplementary note) */}
      <Handle
        type="target"
        position={Position.Left}
        id="ref-target"
        className="!rounded-[2px] !w-3.5 !h-3.5 !bg-teal-500 dark:!bg-teal-400 border-2 border-background shadow-sm hover:scale-125 transition-transform"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
        title="イベントからの参照を接続 (四角ピン)"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="ref-source"
        className="!rounded-[2px] !w-3.5 !h-3.5 !bg-teal-500 dark:!bg-teal-400 border-2 border-background shadow-sm hover:scale-125 transition-transform"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
        title="関連ノードへ接続 (四角ピン)"
      />
      
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
