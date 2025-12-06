import React from 'react';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { Plus, Trash2, GripVertical, Package } from 'lucide-react';
import { getIconForResourceType } from '../utils/iconUtils';
import type { ResourceType } from '../types';

export const ResourceList = () => {
  const { t } = useTranslation();
  const { resources, addResource, deleteResource, setSelectedNode, selectedNodeId } = useScenarioStore();

  const handleAdd = () => {
    const newRes = {
      id: `res-${Date.now()}`,
      type: 'Item' as ResourceType,
      name: 'New Element',
      description: '',
      cost: '',
      effect: '',
      reading: '',
      note: ''
    };
    addResource(newRes);
    setSelectedNode(newRes.id);
  };

  const onDragStart = (event: React.DragEvent, id: string) => {
    event.dataTransfer.setData('application/reactflow', 'resource');
    event.dataTransfer.setData('application/reactflow/referenceId', id);
    event.dataTransfer.effectAllowed = 'move';
  };



  return (
    <div className="flex flex-col h-full bg-card">
        <div className="flex justify-between items-center mb-2 px-2 pt-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
                <Package size={16} />
                {t('resources.title')}
            </h3>
            <button onClick={handleAdd} className="p-1 hover:bg-muted rounded text-primary hover:text-primary/80" title="Add Element">
                <Plus size={16} />
            </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 px-2 pb-2">
            {resources.map(res => (
                <div 
                    key={res.id}
                    className={`
                        group flex items-center gap-2 p-2 rounded cursor-pointer text-sm border
                        ${selectedNodeId === res.id ? 'bg-primary/10 text-primary border-primary/30' : 'bg-card hover:bg-muted border-border'}
                    `}
                    onClick={() => setSelectedNode(res.id)}
                    draggable
                    onDragStart={(e) => onDragStart(e, res.id)}
                >
                    <GripVertical size={14} className="text-muted-foreground opacity-50 cursor-grab shrink-0" />
                    <div className="text-muted-foreground shrink-0">
                        {getIconForResourceType(res.type, 14)}
                    </div>
                    <div className="flex-1 truncate font-medium">{res.name}</div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); deleteResource(res.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity shrink-0"
                        title="Delete"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            ))}
            {resources.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded m-2">
                    Start by adding an element
                </div>
            )}
        </div>
    </div>
  );
};
