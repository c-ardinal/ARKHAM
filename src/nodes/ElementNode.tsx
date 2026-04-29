import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Plus, Minus } from 'lucide-react';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';
import { RevealedBadge } from '../components/common/RevealedBadge';
import { StickyIndicator } from '../components/common/StickyIndicator';

const ElementNode = ({ data, selected }: NodeProps<ScenarioNodeData>) => {
  const variables = useScenarioStore((s) => s.gameState.variables);
  const description = data.description;
  
  const getIcon = () => {
    if (data.actionType === 'consume') return <Minus size={16} />;
    return <Plus size={16} />;
  };

  return (
    <div className={`px-4 py-2 shadow-md rounded-md border-2 min-w-[150px] max-w-[60ch] w-max relative transition-all duration-200
      ${selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
      border-blue-200 dark:border-blue-800
      bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100
      hover:shadow-lg
      ${data.revealed ? '' : ''}
    `}>

      {data.hasSticky && <StickyIndicator />}
      {data.revealed && <RevealedBadge />}
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-blue-400" />
      
      <div className="flex flex-col">
        <div className="flex items-center">
          <div className="rounded-full p-2 mr-2 bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300 shrink-0">
            {getIcon()}
          </div>
          <div className="text-base font-bold flex items-center gap-1 text-blue-900 dark:text-blue-100">
              {substituteVariables(data.infoValue || 'None', variables)}
          </div>
        </div>

        {description && (
            <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                <div className="text-sm opacity-80 whitespace-pre-wrap text-blue-900 dark:text-blue-100">
                    {substituteVariables(data.description || '', variables)}
                </div>
            </div>
        )}
        
        <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
            <div className={`text-sm font-mono font-semibold p-1 rounded flex justify-center items-center ${
                data.actionType === 'consume' 
                    ? 'bg-red-100 text-red-950 dark:bg-red-900 dark:text-red-50' 
                    : 'bg-green-100 text-green-950 dark:bg-green-900 dark:text-green-50'
            }`} title={data.infoValue}>
              <span className="truncate max-w-[100px]">
                  {substituteVariables(data.infoValue || 'None', variables)}
              </span>
              <span className="font-bold ml-1 shrink-0 opacity-80">
                  x{data.quantity !== undefined ? data.quantity : 1}
              </span>
            </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-blue-400" />
      
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

export default memo(ElementNode);
