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

  const rawBranches = data.branches || [];
  const hasLegacyCondition = Boolean(data.conditionValue);
  const effectiveBranches = rawBranches.length > 0 
    ? rawBranches 
    : (hasLegacyCondition ? [{ id: 'true', label: 'True (条件一致)', conditionValue: data.conditionValue, conditionType: data.conditionType || 'variable' }] : []);

  const isMulti = effectiveBranches.length >= 2;

  return (
    <div className={`relative px-4 py-2.5 shadow-sm hover:shadow-md rounded-md border-2 min-w-[180px] max-w-[420px] w-max transition-shadow duration-200 ${
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
          <div className="text-base font-bold text-purple-900 dark:text-purple-100 break-words">
            {label}
          </div>
        </div>

        {description && (
          <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800">
            <div className="text-sm opacity-80 text-purple-900 dark:text-purple-300/70 whitespace-pre-wrap break-words">
              {description}
            </div>
          </div>
        )}

        <div className="mt-2 pt-1.5 border-t border-purple-200 dark:border-purple-800 text-center">
          <span className="text-[11px] text-purple-900/80 dark:text-purple-200/80 bg-purple-200/50 dark:bg-purple-800/50 rounded px-2 py-0.5 font-medium break-words inline-block max-w-full">
            {isMulti 
              ? `条件分岐 (${effectiveBranches.length} ルート)` 
              : (effectiveBranches[0]?.conditionValue ? `条件: ${effectiveBranches[0].conditionValue}` : (conditionValue ? `条件: ${conditionValue}` : '条件分岐'))}
          </span>
        </div>
      </div>

      {/* When 1 route (or default): Progressive True / False Bottom Pin layout */}
      {!isMulti && (
        <div className="flex justify-between items-center mt-3 pt-2 border-t border-purple-200/60 dark:border-purple-800/60 gap-6">
          <div className="relative flex flex-col items-center max-w-[220px] text-center">
            <span className="text-xs text-green-700 dark:text-green-400 font-bold mb-1 break-words">
              {effectiveBranches[0]?.label ? effectiveBranches[0].label : 'True (一致)'}
            </span>
            <Handle 
              type="source" 
              position={Position.Bottom} 
              id={effectiveBranches[0]?.id || 'true'} 
              className="!bg-green-500 !left-auto" 
            />
            {/* Alias handle for 'true' */}
            {effectiveBranches[0]?.id && effectiveBranches[0].id !== 'true' && (
              <Handle 
                type="source" 
                position={Position.Bottom} 
                id="true" 
                className="!opacity-0 !pointer-events-none !left-auto" 
              />
            )}
          </div>

          <div className="relative flex flex-col items-center max-w-[220px] text-center">
            <span className="text-xs text-red-700 dark:text-red-400 font-bold mb-1 break-words">
              False (不一致 / その他)
            </span>
            <Handle 
              type="source" 
              position={Position.Bottom} 
              id="false" 
              className="!bg-red-500 !left-auto" 
            />
            {/* Alias handle for 'else' */}
            <Handle 
              type="source" 
              position={Position.Bottom} 
              id="else" 
              className="!opacity-0 !pointer-events-none !left-auto" 
            />
          </div>
        </div>
      )}

      {/* When 2 or more routes: Progressive Multi-Exit Right Pin layout */}
      {isMulti && (
        <div className="flex flex-col mt-2 gap-1.5 pt-2 border-t border-purple-200 dark:border-purple-800">
          {effectiveBranches.map((branch, index) => (
            <div key={branch.id} className="relative flex items-center justify-between min-h-[26px] py-1 pl-2.5 pr-6 bg-purple-100/70 dark:bg-purple-800/50 rounded text-xs gap-3">
              <span className="text-purple-950 dark:text-purple-100 font-bold break-words leading-tight max-w-[340px]" title={branch.label}>
                {branch.label || `ルート ${index + 1}`}
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
          <div className="relative flex items-center justify-between min-h-[26px] py-1 pl-2.5 pr-6 bg-slate-200/70 dark:bg-slate-800/50 rounded text-xs gap-3">
            <span className="text-muted-foreground font-semibold">その他 (Else)</span>
            <Handle 
              type="source" 
              position={Position.Right} 
              id="else" 
              className="!bg-slate-400 dark:!bg-slate-500 !w-2.5 !h-2.5 !right-[-5px]"
              style={{ top: '50%', transform: 'translateY(-50%)' }}
            />
            {/* Alias handle for 'false' for legacy compatibility */}
            <Handle 
              type="source" 
              position={Position.Right} 
              id="false" 
              className="!opacity-0 !pointer-events-none" 
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
