import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { BranchNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';


import { GitBranch } from 'lucide-react';

const BranchNode = ({ data, selected }: NodeProps<BranchNodeData>) => {
  const { gameState } = useScenarioStore();
  
  const label = substituteVariables(data.label, gameState.variables);
  const description = substituteVariables(data.description || '', gameState.variables);
  const conditionValue = substituteVariables(data.conditionValue || '', gameState.variables);

  return (
    <div className={`relative px-4 py-2 shadow-md hover:shadow-lg rounded-md border-2 min-w-[150px] transition-all ${
      selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
    } border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/40`}>
      {data.revealed && (
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm z-10 border-2 border-background">
              <span className="text-white font-bold text-xs">✓</span>
          </div>
      )}
      <Handle type="target" position={Position.Top} className="w-16 !bg-purple-400 dark:!bg-purple-500" />
      
      <div className="flex flex-col">
        <div className="flex items-center">
          <div className="rounded-full p-2 mr-2 bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300 shrink-0">
            <GitBranch size={16} />
          </div>
          <div className="text-base font-bold text-purple-900 dark:text-purple-100">
              {label}
          </div>
        </div>

        {description && (
            <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800">
                <div className="text-sm opacity-80 text-purple-900 dark:text-purple-300/70 whitespace-pre-wrap">
                    {description}
                </div>
            </div>
        )}

        <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800">
            <div className="text-base text-purple-900 dark:text-purple-300 font-mono bg-purple-100 dark:bg-purple-800 rounded px-1 font-bold w-fit mx-auto">
                {data.branchType} {conditionValue && `(${conditionValue})`}
            </div>
        </div>
      </div>

      {data.branchType === 'if_else' && (
        <div className="flex justify-between mt-2 gap-4">
            <div className="relative">
                <Handle type="source" position={Position.Bottom} id="true" className="!bg-green-500 !left-4" />
                <span className="text-xs text-green-700 dark:text-green-400 font-bold">True</span>
            </div>
            <div className="relative">
                <Handle type="source" position={Position.Bottom} id="false" className="!bg-red-500 !left-auto !right-4" />
                <span className="text-xs text-red-700 dark:text-red-400 font-bold">False</span>
            </div>
        </div>
      )}

      {data.branchType === 'switch' && data.branches && (
          <div className="flex flex-col mt-2 gap-2">
              {data.branches.map((branch) => (
                  <div key={branch.id} className="relative flex items-center justify-end">
                      <span className="text-xs text-purple-900 dark:text-purple-200 mr-2 font-bold">{substituteVariables(branch.label, gameState.variables)}</span>
                      <Handle 
                        type="source" 
                        position={Position.Right} 
                        id={branch.id} 
                        className="!bg-purple-500 !top-auto"
                        style={{ top: '50%' }}
                      />
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};

export default memo(BranchNode);
