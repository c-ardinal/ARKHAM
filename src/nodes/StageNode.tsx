import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { getIconForStageType } from '../utils/iconUtils';
import { useScenarioStore } from '../store/scenarioStore';
import type { StageType, ScenarioNodeData } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { RevealedBadge } from '../components/common/RevealedBadge';
import { StickyIndicator } from '../components/common/StickyIndicator';

const StageNode = ({ data, selected }: NodeProps<ScenarioNodeData>) => {
  const { t } = useTranslation();
  const stages = useScenarioStore((state) => state.stages);
  const stage = stages.find(s => s.id === data.referenceId);

  if (!stage) {
    return (
      <div className="p-4 rounded-md border-2 bg-destructive/10 border-destructive w-[200px] text-destructive text-sm font-medium">
        Deleted Stage
      </div>
    );
  }

  const getTypeLabel = (type: StageType) => {
    const types = t('stages.types' as any) as unknown as Record<string, string>;
    return types?.[type] || type;
  };

  const getBorderColor = (type: StageType) => {
    switch (type) {
      case 'Location': return 'ring-cyan-500/20';
      case 'Faction': return 'ring-amber-500/20';
      case 'Lore': return 'ring-purple-500/20';
      default: return 'ring-primary/20';
    }
  };

  return (
    <div className={`
      relative min-w-[220px] max-w-[60ch] w-max bg-card text-card-foreground rounded-lg border-2 shadow-sm
      transition-colors duration-200
      ${selected ? `border-primary ring-2 ${getBorderColor(stage.type)}` : 'border-border'}
    `}>
      {data.revealed && <RevealedBadge />}

      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
        <div className="p-1.5 rounded-full bg-primary/10 text-primary">
          {getIconForStageType(stage.type, 20)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground font-medium truncate mb-0.5">
            {getTypeLabel(stage.type)}
          </div>
          {stage.reading && (
            <div className="text-xs text-muted-foreground leading-none mb-0.5 truncate">{stage.reading}</div>
          )}
          <div className="text-sm font-bold truncate">
            {stage.name || '(No Name)'}
          </div>
        </div>
      </div>

      {/* Content Preview */}
      <div className="p-3 text-xs space-y-1.5">
        {stage.description && (
          <div className="text-muted-foreground whitespace-pre-wrap break-words">
            {stage.description}
          </div>
        )}
        {stage.details && (
          <div className="whitespace-pre-wrap break-words text-muted-foreground border-t border-border/50 pt-1.5 mt-1">
            <span className="font-semibold text-foreground/80">{t('stages.details' as any) || '詳細'}: </span>
            {stage.details}
          </div>
        )}
        {stage.note && (
          <div className="text-[11px] text-muted-foreground/80 italic border-t border-border/40 pt-1">
            {stage.note}
          </div>
        )}
      </div>

      {data.hasSticky && <StickyIndicator />}

      {/* Reference Handle (Square ■ on Left: connect from Event) */}
      <Handle
        type="target"
        position={Position.Left}
        id="ref-target"
        className="!rounded-[2px] !w-3.5 !h-3.5 !bg-teal-500 dark:!bg-teal-400 border-2 border-background shadow-sm hover:scale-125 transition-transform"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
        title="イベントからの参照を接続 (四角ピン)"
      />

      {/* Reference Handle (Square ■ on Right: connect to further references) */}
      <Handle
        type="source"
        position={Position.Right}
        id="ref-source"
        className="!rounded-[2px] !w-3.5 !h-3.5 !bg-teal-500 dark:!bg-teal-400 border-2 border-background shadow-sm hover:scale-125 transition-transform"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
        title="関連ノードへ接続 (四角ピン)"
      />

      {/* Sticky Note Connection Handle */}
      <Handle 
        type="source" 
        id="sticky-origin" 
        position={Position.Right} 
        style={{ visibility: 'hidden' }} 
      />
      <Handle 
        type="target" 
        id="sticky-target" 
        position={Position.Left} 
        style={{ visibility: 'hidden' }} 
      />
    </div>
  );
};

export default memo(StageNode);
