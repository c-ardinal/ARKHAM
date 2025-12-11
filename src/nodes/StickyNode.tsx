import { memo, useEffect } from 'react';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from 'reactflow';
import type { ScenarioNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { substituteVariables } from '../utils/textUtils';

const StickyNode = ({ id, data, selected }: NodeProps<ScenarioNodeData>) => {
  const { gameState } = useScenarioStore();
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
    // Double check update after a short delay to handle layout shifts
    const timer = setTimeout(() => updateNodeInternals(id), 50);
    return () => clearTimeout(timer);
  }, [id, updateNodeInternals]);
  
  // Only show handle if connected (though it's invisible anyway)
  // We place it at center to make the link look like it's pointing to the note body.
  
  return (
    <div className={`px-4 py-3 shadow-lg rounded-sm min-w-[150px] min-h-[80px] relative transition-all duration-200
      ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
      bg-yellow-100 text-yellow-900
      border border-yellow-300
      hover:shadow-xl
      cursor-move
    `}>
      {/* Invisible target handle for connecting from parent node */}
      <Handle 
        type="target" 
        id="sticky-target"
        position={Position.Top} 
        className="sticky-handle-center"
        style={{ opacity: 0, width: 10, height: 10 }} 
        isConnectable={false} 
      />
      
      {data.label && (
          <div className="font-bold text-base mb-1 break-words">
            {substituteVariables(data.label, gameState.variables)}
          </div>
      )}
      <div className="text-sm whitespace-pre-wrap opacity-90 leading-snug break-words">
        {substituteVariables(data.description || '', gameState.variables)}
      </div>
    </div>
  );
};

export default memo(StickyNode);
