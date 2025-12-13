import { memo, useEffect } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Variable, ArrowLeft, StickyNote } from 'lucide-react';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';

const VariableNode = ({ id, data, selected }: NodeProps<ScenarioNodeData>) => {
  const { gameState, updateNodeData } = useScenarioStore();
  const description = data.description;

  // Auto-healing: If no variable is selected but variables exist, select the first one.
  useEffect(() => {
    if (!data.targetVariable && Object.keys(gameState.variables).length > 0) {
      const firstVar = Object.keys(gameState.variables)[0];
       // Use timeout to avoid "cannot update while rendering"
       const timer = setTimeout(() => {
          updateNodeData(id, { targetVariable: firstVar });
       }, 0);
       return () => clearTimeout(timer);
    }
  }, [data.targetVariable, gameState.variables, id, updateNodeData]);

  // Determine the display variable (optimistic update to prevent flicker)
  const displayVariable = data.targetVariable || 
    (Object.keys(gameState.variables).length > 0 ? Object.keys(gameState.variables)[0] : 'None');

  return (
    <div className={`px-4 py-2 shadow-md rounded-md border-2 min-w-[150px] relative transition-all duration-200
      ${selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
      border-red-200 dark:border-red-800
      bg-red-50 dark:bg-red-900/40 text-red-900 dark:text-red-100
      hover:shadow-lg
      ${data.revealed ? '' : ''}
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
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-red-400" />
      
      <div className="flex flex-col">
        <div className="flex items-center">
          <div className="rounded-full p-2 mr-2 bg-red-100 text-red-600 dark:bg-red-800 dark:text-red-300 shrink-0">
            <Variable size={16} />
          </div>
          <div className="text-base font-bold text-red-900 dark:text-red-100">
              {displayVariable}
          </div>
        </div>

        {description && (
            <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800">
                <div className="text-sm opacity-80 whitespace-pre-wrap text-red-900 dark:text-red-100">
                    {substituteVariables(data.description || '', gameState.variables)}
                </div>
            </div>
        )}

        <div className="mt-2 pt-2 border-t flex items-center justify-between gap-2 border-red-200 dark:border-red-800">
           <div className="text-sm font-mono bg-black/10 dark:bg-black/30 px-1 rounded truncate max-w-[80px]" title={displayVariable}>
               {displayVariable}
           </div>
           <ArrowLeft size={12} className="opacity-50" />
           <div className="text-sm font-mono bg-black/10 dark:bg-black/30 px-1 rounded truncate max-w-[80px]" title={data.variableValue}>
               {substituteVariables(data.variableValue || 'Value', gameState.variables)}
           </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-red-400" />
      
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

export default memo(VariableNode);
