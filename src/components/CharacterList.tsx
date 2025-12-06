import React from 'react';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { Plus, Trash2, GripVertical, Users } from 'lucide-react';
import { getIconForCharacterType } from '../utils/iconUtils';
import type { CharacterType } from '../types';

export const CharacterList = React.memo(() => {
  const { t } = useTranslation();
  const { characters, addCharacter, deleteCharacter, setSelectedNode, selectedNodeId } = useScenarioStore();

  const handleAdd = () => {
    const newChar = {
      id: `char-${Date.now()}`,
      type: 'Person' as CharacterType,
      name: 'New Character',
      description: '',
      abilities: '',
      skills: '',
      reading: '',
      note: ''
    };
    addCharacter(newChar);
    setSelectedNode(newChar.id);
  };

  const onDragStart = (event: React.DragEvent, id: string) => {
    event.dataTransfer.setData('application/reactflow', 'character');
    event.dataTransfer.setData('application/reactflow/referenceId', id);
    event.dataTransfer.effectAllowed = 'move';
  };



  return (
    <div 
        className="flex flex-col h-full bg-card"
        onClick={() => setSelectedNode(null)} // Deselect on background click
    >
        <div className="flex justify-between items-center mb-2 px-2 pt-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users size={16} />
                {t('characters.title')}
            </h3>
            <button 
                onClick={(e) => { e.stopPropagation(); handleAdd(); }} 
                className="p-1 hover:bg-muted rounded text-primary hover:text-primary/80" 
                title="Add Character"
            >
                <Plus size={16} />
            </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 px-2 pb-2">
            {characters.map(char => (
                <div 
                    key={char.id}
                    className={`
                        group relative flex flex-col w-full bg-card text-card-foreground rounded-lg border-2 shadow-sm
                        transition-colors duration-200 mb-2 cursor-pointer
                        ${selectedNodeId === char.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}
                    `}
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent ensuring background click handler from firing
                        setSelectedNode(char.id);
                    }}
                    draggable
                    onDragStart={(e) => onDragStart(e, char.id)}
                >
                    {/* Header */}
                    <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
                        <GripVertical size={14} className="text-muted-foreground opacity-50 cursor-grab shrink-0" />
                        <div className="p-1.5 rounded-full bg-primary/10 text-primary shrink-0">
                            {getIconForCharacterType(char.type, 16)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-muted-foreground font-medium truncate mb-1">
                                {t(`characters.types.${char.type}`) || char.type}
                            </div>
                            {char.reading && (
                                <div className="text-xs text-muted-foreground leading-none mb-0.5 truncate">{char.reading}</div>
                            )}
                            <div className="text-base font-bold truncate">
                                {char.name || '(No Name)'}
                            </div>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); deleteCharacter(char.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 hover:text-destructive rounded transition-all shrink-0"
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    {/* Content Preview */}
                    <div className="p-2 text-sm space-y-1">
                        {(char.abilities || char.skills) && (
                           <div className="pb-1 flex gap-1 flex-wrap">
                               {char.abilities && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs">{t('characters.abilities')}</span>}
                               {char.skills && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">{t('characters.skills')}</span>}
                           </div>
                        )}
                        {char.description && (
                            <div className="line-clamp-2 text-muted-foreground break-words">
                                {char.description}
                            </div>
                        )}
                        {!char.description && !char.abilities && !char.skills && (
                            <div className="text-muted-foreground italic opacity-50">No details</div>
                        )}
                    </div>
                </div>
            ))}
            {characters.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded m-2">
                    Start by adding a character
                </div>
            )}
        </div>
    </div>
  );
});
