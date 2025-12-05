import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';

import { Flag } from 'lucide-react';

const EventNode = ({ data, selected }: NodeProps<ScenarioNodeData>) => {
  const { gameState } = useScenarioStore();
  
  const label = substituteVariables(data.label, gameState.variables);
  const description = substituteVariables(data.description || '', gameState.variables);

  return (
    <div className={`relative px-4 py-2 shadow-md hover:shadow-lg rounded-md border-2 min-w-[150px] transition-all ${
      selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
    } border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20`}>
      {data.revealed && (
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm z-10 border-2 border-background">
              <span className="text-white font-bold text-xs">✓</span>
          </div>
      )}
      {!data.isStart && <Handle type="target" position={Position.Top} className="w-16 !bg-orange-400 dark:!bg-orange-600" />}
      
      <div className="flex flex-col">
        <div className="flex items-center">
          <div className="rounded-full p-2 mr-2 bg-orange-100 text-orange-600 dark:bg-orange-800 dark:text-orange-300 shrink-0">
            <Flag size={16} />
          </div>
          <div className="flex items-center">
            {data.isStart && <span className="mr-2 text-yellow-500">★</span>}
            <div className="text-lg font-bold text-orange-900 dark:text-orange-100">{label}</div>
          </div>
        </div>
        
        {description && (
            <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-800">
                <div className="text-sm opacity-80 text-orange-800 dark:text-orange-200/70 whitespace-pre-wrap">
                    {description}
                </div>
            </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-16 !bg-orange-400 dark:!bg-orange-600" />
    </div>
  );
};

export default memo(EventNode);
