import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { BranchNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';
import { RevealedBadge } from '../components/common/RevealedBadge';
import { StickyIndicator } from '../components/common/StickyIndicator';

import { GitBranch } from 'lucide-react';

const BranchNode = ({ data, selected }: NodeProps<BranchNodeData>) => {
  const variables = useScenarioStore((s) => s.gameState.variables);

  const label = substituteVariables(data.label, variables);
  const description = substituteVariables(data.description || '', variables);
  const conditionValue = substituteVariables(data.conditionValue || '', variables);

  return (
    <div className={`relative px-4 py-2 shadow-sm hover:shadow-md rounded-md border-2 min-w-[150px] w-max transition-shadow duration-200 ${
      selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
    } border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/40`}>

      {data.hasSticky && <StickyIndicator />}
      {data.revealed && <RevealedBadge />}
      <Handle type="target" position={Position.Top} className="w-16 !bg-purple-400 dark:!bg-purple-500" />
      
      <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className="rounded-full p-2 mr-1 bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300 shrink-0">
              <GitBranch size={16} />
            </div>
            {typeof data.chapter === 'number' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-200/80 dark:bg-purple-800/80 text-purple-800 dark:text-purple-200 font-medium shrink-0">
                第{data.chapter}章
              </span>
            )}
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
                  <div key={branch.id} className="relative flex items-center justify-end h-4">
                      <span className="text-xs text-purple-900 dark:text-purple-200 mr-2 font-bold">{substituteVariables(branch.label, variables)}</span>
                      <Handle 
                        type="source" 
                        position={Position.Right} 
                        id={branch.id} 
                        className="!bg-purple-500 !top-auto"
                        style={{ top: '50%', transform: 'translateY(0%)' }}
                      />
                  </div>
              ))}
          </div>
      )}

      {data.branchType === 'multi' && (
          <div className="flex flex-col mt-2 gap-1.5 pt-2 border-t border-purple-200 dark:border-purple-800">
              {(data.branches || []).map((branch, index) => (
                  <div key={branch.id} className="relative flex items-center justify-between h-5 pl-2 pr-4 bg-purple-100/70 dark:bg-purple-800/50 rounded text-xs">
                      <span className="text-purple-950 dark:text-purple-100 font-bold truncate max-w-[140px]">
                        {branch.label || `Case ${index + 1}`}
                      </span>
                      <Handle 
                        type="source" 
                        position={Position.Right} 
                        id={branch.id} 
                        className="!bg-purple-600 dark:!bg-purple-400 !w-2.5 !h-2.5 !right-[-5px]"
                        style={{ top: '50%', transform: 'translateY(-50%)' }}
                      />
                  </div>
              ))}
              <div className="relative flex items-center justify-between h-5 pl-2 pr-4 bg-slate-200/70 dark:bg-slate-800/50 rounded text-xs">
                  <span className="text-muted-foreground font-semibold">その他 (Else)</span>
                  <Handle 
                    type="source" 
                    position={Position.Right} 
                    id="else" 
                    className="!bg-slate-400 dark:!bg-slate-500 !w-2.5 !h-2.5 !right-[-5px]"
                    style={{ top: '50%', transform: 'translateY(-50%)' }}
                  />
              </div>
          </div>
      )}
      
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

export default memo(BranchNode);
