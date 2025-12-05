import React from 'react';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { Plus, Trash2, GripVertical, User, Users, Ghost, HelpCircle } from 'lucide-react';
import type { CharacterType } from '../types';

export const CharacterList = () => {
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

  const getIcon = (type: CharacterType) => {
      switch (type) {
        case 'Person': return <User size={14} />;
        case 'Participant': return <Users size={14} />;
        case 'Monster': return <Ghost size={14} />;
        case 'Other': return <HelpCircle size={14} />;
        default: return <User size={14} />;
      }
  };

  return (
    <div className="flex flex-col h-full bg-card">
        <div className="flex justify-between items-center mb-2 px-2 pt-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users size={16} />
                {t.characters.title}
            </h3>
            <button onClick={handleAdd} className="p-1 hover:bg-muted rounded text-primary hover:text-primary/80" title="Add Character">
                <Plus size={16} />
            </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 px-2 pb-2">
            {characters.map(char => (
                <div 
                    key={char.id}
                    className={`
                        group flex items-center gap-2 p-2 rounded cursor-pointer text-sm border
                        ${selectedNodeId === char.id ? 'bg-primary/10 text-primary border-primary/30' : 'bg-card hover:bg-muted border-border'}
                    `}
                    onClick={() => setSelectedNode(char.id)}
                    draggable
                    onDragStart={(e) => onDragStart(e, char.id)}
                >
                    <GripVertical size={14} className="text-muted-foreground opacity-50 cursor-grab shrink-0" />
                    <div className="text-muted-foreground shrink-0">
                        {getIcon(char.type)}
                    </div>
                    <div className="flex-1 truncate font-medium">{char.name}</div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); deleteCharacter(char.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity shrink-0"
                        title="Delete"
                    >
                        <Trash2 size={14} />
                    </button>
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
};
