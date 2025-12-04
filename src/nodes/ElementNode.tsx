import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { BookOpen, Package, Zap, Activity, PlusCircle, MinusCircle } from 'lucide-react';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';

const ElementNode = ({ data, selected }: NodeProps<ScenarioNodeData>) => {
  const { gameState } = useScenarioStore();
  
  const getIcon = () => {
    switch (data.infoType) {
      case 'knowledge': return <BookOpen size={16} />;
      case 'item': return <Package size={16} />;
      case 'skill': return <Zap size={16} />;
      case 'stat': return <Activity size={16} />;
      default: return <BookOpen size={16} />;
    }
  };

  const getActionIcon = () => {
      if (data.actionType === 'consume') return <MinusCircle size={14} className="text-destructive" />;
      return <PlusCircle size={14} className="text-green-500" />;
  };
  
  return (
    <div className={`px-4 py-2 shadow-md rounded-md border-2 min-w-[150px] relative transition-all duration-200
      ${selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
      border-blue-200 dark:border-blue-800
      bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100
      hover:shadow-lg
      ${data.revealed ? 'ring-2 ring-green-400' : ''}
    `}>
      {data.revealed && (
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm z-10 border-2 border-background">
              <span className="text-white font-bold text-xs">✓</span>
          </div>
      )}
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-blue-400" />
      
      <div className="flex items-center">
        <div className="rounded-full p-2 mr-2 bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300">
          {getIcon()}
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold flex items-center gap-1">
              {substituteVariables(data.label, gameState.variables)}
              <span title={data.actionType === 'consume' ? 'Consume/Discard' : 'Obtain'}>
                  {getActionIcon()}
              </span>
          </div>
          <div className="text-[10px] opacity-80 line-clamp-2">{substituteVariables(data.description || '', gameState.variables)}</div>
        </div>
      </div>
      
      <div className="mt-2 pt-2 border-t flex justify-between items-center border-blue-200 dark:border-blue-800">
        <div className="text-xs font-mono font-semibold truncate flex-1 mr-2" title={data.infoValue}>
          {substituteVariables(data.infoValue || 'No Name', gameState.variables)}
        </div>
        {data.quantity !== undefined && (
            <div className="text-xs font-mono px-1.5 py-0.5 rounded bg-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                x{data.quantity}
            </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-blue-400" />
    </div>
  );
};

export default memo(ElementNode);
