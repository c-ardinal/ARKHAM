import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Package, StickyNote } from 'lucide-react';
import { getIconForResourceType } from '../utils/iconUtils';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';

const ElementNode = ({ data, selected }: NodeProps<ScenarioNodeData>) => {
  const { gameState, resources } = useScenarioStore();
  const description = data.description;
  const resource = resources.find(r => r.id === data.referenceId);
  
  const getIcon = () => {
    if (!resource) return <Package size={16} />;
    return getIconForResourceType(resource.type, 16);
  };

  return (
    <div className={`px-4 py-2 shadow-md rounded-md border-2 min-w-[150px] max-w-[60ch] relative transition-all duration-200
      ${selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
      border-blue-200 dark:border-blue-800
      bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100
      hover:shadow-lg
      ${data.revealed ? 'ring-2 ring-green-400' : ''}
    `}>

      {data.hasSticky && (
          <div className="absolute -top-5 -right-5 w-7 h-7 bg-yellow-400 text-yellow-900 rounded-sm flex items-center justify-center shadow-md border border-yellow-600 rotate-6" title="Has Sticky Notes">
            <StickyNote size={14} />
          </div>
      )}
      {data.revealed && (
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm z-10 border-2 border-background">
              <span className="text-white font-bold text-xs">✓</span>
          </div>
      )}
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-blue-400" />
      
      <div className="flex flex-col">
        <div className="flex items-center">
          <div className="rounded-full p-2 mr-2 bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300 shrink-0">
            {getIcon()}
          </div>
          <div className="text-base font-bold flex items-center gap-1 text-blue-900 dark:text-blue-100">
              {substituteVariables(data.label, gameState.variables)}
          </div>
        </div>
        
        {description && (
            <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                <div className="text-sm opacity-80 whitespace-pre-wrap text-blue-900 dark:text-blue-100">
                    {substituteVariables(data.description || '', gameState.variables)}
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
                  {substituteVariables(data.infoValue || 'None', gameState.variables)}
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
