import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Variable, ArrowLeft } from 'lucide-react';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';

const VariableNode = ({ data, selected }: NodeProps<ScenarioNodeData>) => {
  const { gameState } = useScenarioStore();
  const description = data.description;

  return (
    <div className={`px-4 py-2 shadow-md rounded-md border-2 min-w-[150px] relative transition-all duration-200
      ${selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
      border-red-200 dark:border-red-800
      bg-red-50 dark:bg-red-900/40 text-red-900 dark:text-red-100
      hover:shadow-lg
      ${data.revealed ? 'ring-2 ring-green-400' : ''}
    `}>
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
              {substituteVariables(data.label, gameState.variables)}
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
           <div className="text-sm font-mono bg-black/10 dark:bg-black/30 px-1 rounded truncate max-w-[80px]" title={data.targetVariable}>
               {data.targetVariable || 'None'}
           </div>
           <ArrowLeft size={12} className="opacity-50" />
           <div className="text-sm font-mono bg-black/10 dark:bg-black/30 px-1 rounded truncate max-w-[80px]" title={data.variableValue}>
               {substituteVariables(data.variableValue || 'Value', gameState.variables)}
           </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-red-400" />
    </div>
  );
};

export default memo(VariableNode);
