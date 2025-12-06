import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Package, Shield, Book, Zap, Activity } from 'lucide-react';
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

  const getIcon = (type: ResourceType) => {
    switch (type) {
      case 'Item': return <Package size={20} />;
      case 'Equipment': return <Shield size={20} />;
      case 'Knowledge': return <Book size={20} />;
      case 'Skill': return <Zap size={20} />;
      case 'Status': return <Activity size={20} />;
      default: return <Package size={20} />;
    }
  };

  const getTypeLabel = (type: ResourceType) => {
      const types = t.resources.types as any;
      return types[type] || type;
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
      relative min-w-[200px] bg-card text-card-foreground rounded-lg border-2 shadow-sm
      transition-colors duration-200
      ${selected ? `border-primary ring-2 ${getBorderColor(resource.type)}` : 'border-border'}
    `}>
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
        <div className="p-1.5 rounded-full bg-primary/10 text-primary">
            {getIcon(resource.type)}
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
              <div className="text-muted-foreground">
                  <span className="font-semibold">{t.resources.cost}:</span> {resource.cost}
              </div>
          )}
           {resource.effect && (
              <div className="text-muted-foreground">
                  <span className="font-semibold">{t.resources.effect}:</span> {resource.effect}
              </div>
          )}
          {resource.description && (
              <div className="line-clamp-2 text-muted-foreground border-t border-border/50 pt-1 mt-1">
                  {resource.description}
              </div>
          )}
      </div>

      {/* No handles */}
    </div>
  );
};

export default memo(ResourceNode);
