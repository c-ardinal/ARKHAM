import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { GroupNodeData } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { Minus, ArrowDownFromLine, Folder } from 'lucide-react';
import { RevealedBadge } from '../components/common/RevealedBadge';
import { StickyIndicator } from '../components/common/StickyIndicator';

import { NodeMarkdown } from '../components/common/NodeMarkdown';

const GroupNode = ({ id, data, selected }: NodeProps<GroupNodeData>) => {
  const toggleGroup = useScenarioStore((s) => s.toggleGroup);
  const mode = useScenarioStore((s) => s.mode);

  const isPlayMode = mode === 'play';

  return (
    <div
      className={`relative w-full h-full border-2 rounded-xl transition-shadow duration-200 flex flex-col shadow-md hover:shadow-lg ${
        selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
      } border-border/80 dark:border-border/60 ${
        !data.expanded
          ? 'min-w-[150px] min-h-[50px] border-dashed bg-muted/80'
          : '!border-solid bg-muted/60 dark:bg-muted/30 backdrop-blur-sm'
      } pointer-events-none`}
      style={{ minWidth: 'fit-content', minHeight: 'fit-content' }}
    >
      {data.hasSticky && <div className="pointer-events-auto"><StickyIndicator /></div>}
      {data.revealed && <div className="pointer-events-auto"><RevealedBadge /></div>}
      
      {/* Title & Description Header: Grabbable drag handle for moving the group node */}
      <div 
        className={`group-drag-handle px-3 py-2 m-2 rounded-md text-xs font-bold flex flex-col gap-1 bg-card/90 text-card-foreground shadow-sm border border-border/50 whitespace-nowrap w-fit backdrop-blur-md ${
          isPlayMode ? 'pointer-events-none' : 'pointer-events-auto cursor-grab active:cursor-grabbing'
        }`}
      >
        <div className="flex items-center gap-2">
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(id);
                }}
                className="hover:text-primary transition-colors pointer-events-auto nodrag nopan"
                title={data.expanded ? '折りたたむ' : '展開する'}
            >
                {data.expanded ? <Minus size={12} /> : <ArrowDownFromLine size={12} />}
            </button>
            <div className="rounded-full p-1 bg-muted text-muted-foreground shrink-0 pointer-events-none">
                <Folder size={12} />
            </div>
            <div className="max-w-[320px] overflow-hidden text-ellipsis pointer-events-none select-none">
              <NodeMarkdown content={data.label} inline />
            </div>
        </div>
        {data.description && (
            <div className="text-xs opacity-80 border-t border-border pt-1 mt-1 max-w-[400px] pointer-events-none select-none whitespace-normal break-words">
                <NodeMarkdown content={data.description} />
            </div>
        )}
      </div>
      
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground pointer-events-auto" />
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground pointer-events-auto" />
      
      <Handle 
          type="source" 
          id="sticky-origin" 
          position={Position.Right} 
          className="!w-1 !h-1 !bg-transparent !border-none !min-w-0 !min-h-0 pointer-events-auto" 
          style={{ top: -6, right: -6, position: 'absolute' }} 
          isConnectable={false} 
      />
    </div>
  );
};

export default memo(GroupNode);
