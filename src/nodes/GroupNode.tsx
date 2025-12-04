import { memo, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { GroupNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { Minus, ArrowDownFromLine } from 'lucide-react';
import { substituteVariables } from '../utils/textUtils';

const GroupNode = ({ id, data, selected }: NodeProps<GroupNodeData>) => {
  const { toggleGroup, updateGroupSize, gameState } = useScenarioStore();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (!contentRef.current) return;

      const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
              const { width, height } = entry.contentRect;
              requestAnimationFrame(() => {
                  updateGroupSize(id, { width, height });
              });
          }
      });

      resizeObserver.observe(contentRef.current);
      return () => resizeObserver.disconnect();
  }, [id, updateGroupSize]);

  return (
    <div 
    className={`relative w-full h-full border-2 rounded-lg transition-all flex flex-col shadow-md hover:shadow-lg ${
      selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
    } border-border ${
      !data.expanded 
        ? 'min-w-[150px] min-h-[50px] border-dashed bg-muted' 
        : '!border-solid bg-muted'
    }`}
    style={{ minWidth: 'fit-content', minHeight: 'fit-content' }}
    >
      {data.revealed && (
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm z-10 border-2 border-background">
              <span className="text-white font-bold text-xs">✓</span>
          </div>
      )}
      
      <div 
        ref={contentRef}
        className="px-2 py-1 m-2 rounded text-xs font-bold flex flex-col gap-1 bg-card text-card-foreground shadow-sm border border-border whitespace-nowrap w-fit"
      >
        <div className="flex items-center gap-2">
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(id);
                }}
                className="hover:text-primary transition-colors"
            >
                {data.expanded ? <Minus size={12} /> : <ArrowDownFromLine size={12} />}
            </button>
            {substituteVariables(data.label, gameState.variables)}
        </div>
        {data.description && (
            <div className="text-[10px] opacity-80 whitespace-pre-wrap border-t border-border pt-1 mt-1">
                {substituteVariables(data.description || '', gameState.variables)}
            </div>
        )}
      </div>
      
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
};

export default memo(GroupNode);
