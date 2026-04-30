import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';
import { RevealedBadge } from '../components/common/RevealedBadge';
import { StickyIndicator } from '../components/common/StickyIndicator';
import { useTranslation } from '../hooks/useTranslation';

import { Flag, Star } from 'lucide-react';

const EventNode = ({ data, selected }: NodeProps<ScenarioNodeData>) => {
  const variables = useScenarioStore((s) => s.gameState.variables);
  const { t } = useTranslation();

  const label = substituteVariables(data.label, variables);
  const description = substituteVariables(data.description || '', variables);

  return (
    <div className={`relative px-4 py-2 shadow-md hover:shadow-lg rounded-md border-2 min-w-[150px] w-max transition-shadow duration-200 ${
      selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
    } border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20`}>
      {data.hasSticky && <StickyIndicator />}
      {data.revealed && <RevealedBadge />}
      {!data.isStart && <Handle type="target" position={Position.Top} className="w-16 !bg-orange-400 dark:!bg-orange-600" />}

      <div className="flex flex-col">
        <div className="flex items-center">
          <div className="rounded-full p-2 mr-2 bg-orange-100 text-orange-600 dark:bg-orange-800 dark:text-orange-300 shrink-0">
            <Flag size={16} />
          </div>
          <div className="flex items-center">
            {data.isStart && (
              <Star
                size={14}
                className="mr-2 fill-yellow-400 text-yellow-500"
                aria-label={t('common.startNode') || 'Start Node'}
              />
            )}
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
      
      {/* Sticky Note Connection Handle - Placed at end to avoid interfering with default handles */}
      <Handle 
          type="source" 
          id="sticky-origin" 
          position={Position.Right} 
          className="!w-1 !h-1 !bg-transparent !border-none !min-w-0 !min-h-0" 
          style={{ top: -7, right: -7, position: 'absolute' }}   
          isConnectable={false} 
      />
    </div>
  );
};

export default memo(EventNode);
