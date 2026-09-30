import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Package } from 'lucide-react';
import { getIconForResourceType } from '../utils/iconUtils';
import { useScenarioStore } from '../store/scenarioStore';
import type { ResourceType, ScenarioNodeData } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { RevealedBadge } from '../components/common/RevealedBadge';
import { StickyIndicator } from '../components/common/StickyIndicator';
import { NodeMarkdown } from '../components/common/NodeMarkdown';

const ResourceNode = ({ data, selected }: NodeProps<ScenarioNodeData>) => {
  const { t } = useTranslation();
  const resources = useScenarioStore((state) => state.resources);
  const resource = resources.find(r => r.id === data.referenceId);

  if (!resource) {
    return (
      <div className={`
        relative min-w-[200px] bg-card text-muted-foreground rounded-lg border-2 border-dashed border-muted-foreground/30
        p-4 flex flex-col items-center justify-center gap-2
      `}>
         <div className="p-2 rounded-full bg-muted">
           <Package size={20} className="opacity-50" />
         </div>
         <span className="text-sm font-medium">None</span>
      </div>
    );
  }



  const getTypeLabel = (type: ResourceType) => {
      const types = t('resources.types') as unknown as Record<string, string>;
      return types?.[type] || type;
  };

  const getBorderColor = (type: ResourceType) => {
      // Optional color coding by type
      switch (type) {
          case 'Item': return 'ring-emerald-500/20'; // Green
          case 'Equipment': return 'ring-blue-500/20'; // Blue
          case 'Knowledge': return 'ring-purple-500/20'; // Purple
          case 'Skill': return 'ring-yellow-500/20'; // Yellow
          case 'Status': return 'ring-red-500/20'; // Red
          default: return '';
      }
  };

  return (
    <div className={`
      relative min-w-[200px] max-w-[60ch] w-max bg-card text-card-foreground rounded-lg border-2 shadow-sm
      transition-colors duration-200
      ${selected ? `border-primary ring-2 ${getBorderColor(resource.type)}` : 'border-border'}
    `}>
      {data.revealed && <RevealedBadge />}

      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
        <div className="p-1.5 rounded-full bg-primary/10 text-primary">
            {getIconForResourceType(resource.type, 20)}
        </div>
        <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground font-medium truncate mb-1">
                {getTypeLabel(resource.type)}
            </div>
            {resource.reading && (
               <div className="text-xs text-muted-foreground leading-none mb-0.5">{resource.reading}</div>
            )}
            <div className="text-sm font-bold break-words">
                <NodeMarkdown content={resource.name || '(No Name)'} inline />
            </div>
        </div>
      </div>

      {/* Content Preview */}
      <div className="p-3 text-xs space-y-1">
          {resource.cost && (
              <div className="text-muted-foreground break-words flex items-baseline gap-1">
                  <span className="font-semibold shrink-0">{t('resources.cost')}:</span>
                  <NodeMarkdown content={resource.cost} inline />
              </div>
          )}
           {resource.effect && (
              <div className="text-muted-foreground break-words">
                  <span className="font-semibold block mb-0.5">{t('resources.effect')}:</span>
                  <NodeMarkdown content={resource.effect} />
              </div>
          )}
          {resource.description && (
              <div className="break-words text-muted-foreground border-t border-border/50 pt-1 mt-1">
                  <NodeMarkdown content={resource.description} />
              </div>
          )}
      </div>

      {data.hasSticky && <StickyIndicator />}

      {/* Reference Handle (Square ■ on Left: connect from Event) */}
      <Handle
        type="target"
        position={Position.Left}
        id="ref-target"
        className="!rounded-[2px] !w-3.5 !h-3.5 !bg-teal-500 dark:!bg-teal-400 border-2 border-background shadow-sm hover:ring-2 hover:ring-teal-400/60 transition-colors"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
        title="イベントからの参照を接続 (四角ピン)"
      />

      {/* Reference Handle (Square ■ on Right: connect to further references) */}
      <Handle
        type="source"
        position={Position.Right}
        id="ref-source"
        className="!rounded-[2px] !w-3.5 !h-3.5 !bg-teal-500 dark:!bg-teal-400 border-2 border-background shadow-sm hover:ring-2 hover:ring-teal-400/60 transition-colors"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
        title="関連ノードへ接続 (四角ピン)"
      />

      {/* Sticky Note Connection Handle */}
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

export default memo(ResourceNode);
