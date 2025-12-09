import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
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
      relative min-w-[200px] max-w-[60ch] bg-card text-card-foreground rounded-lg border-2 shadow-sm
      transition-colors duration-200
      ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}
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
          {character.description && (
              <div className="whitespace-pre-wrap break-words text-muted-foreground pb-1">
                  {character.description}
              </div>
          )}
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700"></div>

          {/* Abilities and Skills content */}
          {character.abilities && (
             <div className="pb-1">
                 <div className="text-[10px] font-semibold text-blue-800 dark:text-blue-300 mb-0.5">{t('characters.abilities')}</div>
                 <div className="whitespace-pre-wrap break-words text-muted-foreground">
                     {character.abilities}
                 </div>
             </div>
          )}
          {character.skills && (
             <div className="pb-1">
                 <div className="text-[10px] font-semibold text-green-800 dark:text-green-300 mb-0.5">{t('characters.skills')}</div>
                 <div className="whitespace-pre-wrap break-words text-muted-foreground">
                     {character.skills}
                 </div>
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

export default memo(CharacterNode);
