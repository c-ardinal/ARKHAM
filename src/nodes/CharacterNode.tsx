import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { getIconForCharacterType } from '../utils/iconUtils';
import { useScenarioStore } from '../store/scenarioStore';
import type { CharacterType, ScenarioNodeData } from '../types';
import { useTranslation } from '../hooks/useTranslation';

const CharacterNode = ({ data, selected }: NodeProps<ScenarioNodeData>) => {
  const { t } = useTranslation();
  const characters = useScenarioStore((state) => state.characters);
  const character = characters.find(c => c.id === data.referenceId);

  if (!character) {
    return (
      <div className={`p-4 rounded-md border-2 bg-destructive/10 border-destructive w-[200px] text-destructive`}>
        Deleted Character
      </div>
    );
  }



  const getTypeLabel = (type: CharacterType) => {
      // Accessing strict typed properties
      const types = t('characters.types') as unknown as Record<string, string>; 
      return types?.[type] || type;
  };

  return (
    <div className={`
      relative min-w-[200px] bg-card text-card-foreground rounded-lg border-2 shadow-sm
      transition-colors duration-200
      ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}
    `}>
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
        <div className="p-1.5 rounded-full bg-primary/10 text-primary">
            {getIconForCharacterType(character.type, 20)}
        </div>
        <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground font-medium truncate mb-1">
                {getTypeLabel(character.type)}
            </div>
            {character.reading && (
               <div className="text-[10px] text-muted-foreground leading-none mb-0.5">{character.reading}</div>
            )}
            <div className="text-sm font-bold truncate">
                {character.name || '(No Name)'}
            </div>
        </div>
      </div>

      {/* Content Preview */}
      <div className="p-3 text-xs space-y-1">
          {/* Tags for abilities/skills presence */}
          {(character.abilities || character.skills) && (
             <div className="pb-1 flex gap-1 flex-wrap">
                 {character.abilities && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px]">{t('characters.abilities')}</span>}
                 {character.skills && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-[10px]">{t('characters.skills')}</span>}
             </div>
          )}

          {character.description && (
              <div className="line-clamp-2 text-muted-foreground">
                  {character.description}
              </div>
          )}
      </div>

      {/* No handles */}
    </div>
  );
};

export default memo(CharacterNode);
