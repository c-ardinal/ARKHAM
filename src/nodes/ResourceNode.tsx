import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Package } from 'lucide-react';
import { getIconForResourceType } from '../utils/iconUtils';
import { useScenarioStore } from '../store/scenarioStore';
import type { ResourceType, ScenarioNodeData } from '../types';
import { useTranslation } from '../hooks/useTranslation';

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
      relative min-w-[200px] max-w-[60ch] bg-card text-card-foreground rounded-lg border-2 shadow-sm
      transition-colors duration-200
      ${selected ? `border-primary ring-2 ${getBorderColor(resource.type)}` : 'border-border'}
    `}>
      {/* Revealed/Unrevealed Indicator */}
      {data.revealed && (
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm z-10 border-2 border-background">
              <span className="text-white font-bold text-xs">✓</span>
          </div>
      )}

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
               <div className="text-[10px] text-muted-foreground leading-none mb-0.5">{resource.reading}</div>
            )}
            <div className="text-sm font-bold truncate">
                {resource.name || '(No Name)'}
            </div>
        </div>
      </div>

      {/* Content Preview */}
      <div className="p-3 text-xs space-y-1">
          {resource.cost && (
              <div className="text-muted-foreground whitespace-pre-wrap break-words">
                  <span className="font-semibold">{t('resources.cost')}:</span> {resource.cost}
              </div>
          )}
           {resource.effect && (
              <div className="text-muted-foreground whitespace-pre-wrap break-words">
                  <span className="font-semibold">{t('resources.effect')}:</span> {resource.effect}
              </div>
          )}
          {resource.description && (
              <div className="whitespace-pre-wrap break-words text-muted-foreground border-t border-border/50 pt-1 mt-1">
                  {resource.description}
              </div>
          )}
      </div>

      {/* Sticky Note Icon */}
      {data.hasSticky && (
          <div className="absolute -top-5 -right-5 w-7 h-7 bg-yellow-400 text-yellow-900 rounded-sm flex items-center justify-center shadow-md border border-yellow-600 rotate-6" title="Has Sticky Notes">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>
          </div>
      )}

      {/* Sticky Note Connection Handle */}
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

export default memo(ResourceNode);
