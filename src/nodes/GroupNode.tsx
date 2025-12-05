import { memo, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { GroupNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { Minus, ArrowDownFromLine, Folder, StickyNote } from 'lucide-react';
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
    className={`relative w-full h-full border-2 rounded-xl transition-all flex flex-col shadow-xl hover:shadow-2xl ${
      selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
    } border-border/60 ${
      !data.expanded 
        ? 'min-w-[150px] min-h-[50px] border-dashed bg-muted/80' 
        : '!border-solid bg-muted/30 backdrop-blur-sm'
    }`}
    style={{ minWidth: 'fit-content', minHeight: 'fit-content' }}
    >

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
      
      <div 
        ref={contentRef}
        className="px-3 py-2 m-2 rounded-md text-xs font-bold flex flex-col gap-1 bg-card/90 text-card-foreground shadow-lg border border-border/50 whitespace-nowrap w-fit backdrop-blur-md"
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
            <div className="rounded-full p-1 bg-muted text-muted-foreground">
                <Folder size={12} />
            </div>
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

export default memo(GroupNode);
