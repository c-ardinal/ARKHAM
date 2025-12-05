import React, { useState } from 'react';
import type { NodeType } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { Package, ChevronsRight, Zap, BookOpen, Brain, ChevronsLeft, StickyNote, Variable as VariableIcon, Flag, GitBranch, Folder, Rabbit, Layers, Users } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { VariableList } from './VariableList';
import { CharacterList } from './CharacterList';
import { ResourceList } from './ResourceList';
import { substituteVariables } from '../utils/textUtils';

interface SidebarProps {
  width: number;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ width, isOpen, onToggle }: SidebarProps) => {
  const { mode, gameState } = useScenarioStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'nodes' | 'characters' | 'resources' | 'variables'>('nodes');

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  if (!isOpen) {
      return (
          <aside className="border-r flex flex-col items-center bg-card border-border" style={{ width: 50 }}>
              <div className="p-2 border-b border-border w-full flex justify-center items-center">
                  <div className="h-[34px] flex items-center justify-center">
                    <button onClick={onToggle} className="p-1 rounded hover:bg-accent hover:text-accent-foreground text-muted-foreground" title="Expand">
                        <ChevronsRight size={16} />
                    </button>
                  </div>
              </div>
              
              <div className="flex flex-col gap-2 w-full px-1 py-2">
                  <button 
                      onClick={() => { setActiveTab('nodes'); onToggle(); }}
                      className={`p-2 rounded flex items-center justify-center transition-colors ${activeTab === 'nodes' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'}`}
                      title={t.common.nodes}
                  >
                      <Layers size={18} />
                  </button>
                  <button 
                      onClick={() => { setActiveTab('characters'); onToggle(); }}
                      className={`p-2 rounded flex items-center justify-center transition-colors ${activeTab === 'characters' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'}`}
                      title={t.characters.title}
                  >
                      <Users size={18} />
                  </button>
                  <button 
                      onClick={() => { setActiveTab('resources'); onToggle(); }}
                      className={`p-2 rounded flex items-center justify-center transition-colors ${activeTab === 'resources' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'}`}
                      title={t.resources.title}
                  >
                      <Package size={18} />
                  </button>
                  <button 
                      onClick={() => { setActiveTab('variables'); onToggle(); }}
                      className={`p-2 rounded flex items-center justify-center transition-colors ${activeTab === 'variables' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'}`}
                      title={t.variables.title}
                  >
                      <VariableIcon size={18} />
                  </button>
              </div>
          </aside>
      );
  }

  if (mode === 'play') {
    return (
      <aside 
        className="border-r flex flex-col bg-card border-border"
        style={{ width }}
      >
        <div className="p-4 border-b flex justify-between items-center border-border">
          <h2 className="text-lg font-semibold text-card-foreground">{t.common.gameState}</h2>
          <button onClick={onToggle} className="p-1 rounded hover:bg-accent hover:text-accent-foreground text-muted-foreground">
            <ChevronsLeft size={16} />
          </button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          {/* Inventory */}
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2 text-muted-foreground">
              <Package size={14} /> {t.gameState.inventory}
            </h3>
            {Object.keys(gameState.inventory).length === 0 ? (
              <div className="text-xs text-muted-foreground italic">{t.gameState.empty}</div>
            ) : (
              <ul className="space-y-1">
                {Object.entries(gameState.inventory).map(([item, qty], i) => (
                  <li key={i} className="text-sm px-2 py-1 rounded flex justify-between bg-muted text-foreground">
                      <span>{substituteVariables(item, gameState.variables)}</span>
                      <span className="font-mono text-xs opacity-70">x{qty}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Knowledge */}
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2 text-muted-foreground">
              <Brain size={14} /> {t.gameState.knowledge}
            </h3>
            {Object.keys(gameState.knowledge).length === 0 ? (
              <div className="text-xs text-muted-foreground italic">{t.gameState.none}</div>
            ) : (
              <ul className="space-y-1">
                {Object.entries(gameState.knowledge).map(([k, qty], i) => (
                  <li key={i} className="text-sm px-2 py-1 rounded flex justify-between bg-muted text-foreground">
                      <span>{substituteVariables(k, gameState.variables)}</span>
                      <span className="font-mono text-xs opacity-70">x{qty}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Skills */}
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2 text-muted-foreground">
              <Zap size={14} /> {t.gameState.skills}
            </h3>
            {Object.keys(gameState.skills).length === 0 ? (
              <div className="text-xs text-muted-foreground italic">{t.gameState.none}</div>
            ) : (
              <ul className="space-y-1">
                {Object.entries(gameState.skills).map(([s, qty], i) => (
                  <li key={i} className="text-sm px-2 py-1 rounded flex justify-between bg-muted text-foreground">
                      <span>{substituteVariables(s, gameState.variables)}</span>
                      <span className="font-mono text-xs opacity-70">x{qty}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Stats */}
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2 text-muted-foreground">
              <BookOpen size={14} /> {t.gameState.stats}
            </h3>
            {Object.keys(gameState.stats).length === 0 ? (
              <div className="text-xs text-muted-foreground italic">{t.gameState.none}</div>
            ) : (
              <ul className="space-y-1">
                {Object.entries(gameState.stats).map(([key, val], i) => (
                  <li key={i} className="text-sm flex justify-between px-2 py-1 rounded bg-muted text-foreground">
                    <span>{substituteVariables(key, gameState.variables)}</span>
                    <span className="font-bold">{val}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="border-t pt-4 flex-1 min-h-0 border-border">
            <VariableList />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside 
        className="border-r flex flex-col bg-card border-border"
        style={{ width }}
    >
      <div className="p-2 border-b flex justify-between items-center border-border bg-muted/40s">
        {/* Tabs */}
        <div className="flex space-x-1 flex-1">
            <button 
                onClick={() => setActiveTab('nodes')}
                className={`p-2 rounded flex items-center justify-center flex-1 transition-colors ${activeTab === 'nodes' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'}`}
                title="Nodes"
            >
                <Layers size={18} />
            </button>
            <button 
                onClick={() => setActiveTab('characters')}
                className={`p-2 rounded flex items-center justify-center flex-1 transition-colors ${activeTab === 'characters' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'}`}
                title="Characters"
            >
                <Users size={18} />
            </button>
             <button 
                onClick={() => setActiveTab('resources')}
                className={`p-2 rounded flex items-center justify-center flex-1 transition-colors ${activeTab === 'resources' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'}`}
                title="Resources/Elements"
            >
                <Package size={18} />
            </button>
            <button 
                onClick={() => setActiveTab('variables')}
                className={`p-2 rounded flex items-center justify-center flex-1 transition-colors ${activeTab === 'variables' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'}`}
                title="Variables"
            >
                <VariableIcon size={18} />
            </button>
        </div>
        <button onClick={onToggle} className="p-1 rounded hover:bg-accent hover:text-accent-foreground text-muted-foreground ml-2">
            <ChevronsLeft size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'nodes' && (
             <div className="h-full flex flex-col bg-card">
                 <div className="flex justify-between items-center mb-2 px-2 pt-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Layers size={16} />
                        {t.common.nodes}
                    </h3>
                 </div>
                 <div className="flex-1 overflow-y-auto flex flex-col gap-2 px-2 pb-2">
                 {/* Draggable Nodes List */}
                 <div 
                    className="p-3 rounded cursor-move transition-colors font-medium border flex items-center gap-2 dark:bg-amber-900/20 dark:hover:bg-amber-900/50 dark:text-amber-200 dark:border-amber-800 bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
                    onDragStart={(event) => onDragStart(event, 'event')}
                    draggable
                 >
                    <Flag size={16} /> {t.nodes.event}
                 </div>
                 <div 
                    className="p-3 rounded cursor-move transition-colors font-medium border flex items-center gap-2 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-200 dark:border-blue-800 bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200"
                    onDragStart={(event) => onDragStart(event, 'element')}
                    draggable
                 >
                    <Package size={16} /> {t.nodes.element}
                 </div>
                 <div 
                    className="p-3 rounded cursor-move transition-colors font-medium border flex items-center gap-2 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-200 dark:border-purple-800 bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200"
                    onDragStart={(event) => onDragStart(event, 'branch')}
                    draggable
                 >
                    <GitBranch size={16} /> {t.nodes.branch}
                 </div>
                 <div 
                    className="p-3 rounded cursor-move transition-colors font-medium border flex items-center gap-2 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-200 dark:border-red-800 bg-red-50 hover:bg-red-100 text-red-900 border-red-200"
                    onDragStart={(event) => onDragStart(event, 'variable')}
                    draggable
                 >
                    <VariableIcon size={16} /> {t.nodes.variable}
                 </div>
                 <div 
                    className="p-3 rounded cursor-move transition-colors font-medium border flex items-center gap-2 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300"
                    onDragStart={(event) => onDragStart(event, 'group')}
                    draggable
                 >
                    <Folder size={16} /> {t.nodes.group}
                 </div>
                 <div 
                    className="p-3 rounded cursor-move transition-colors font-medium border flex items-center gap-2 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-800 bg-yellow-50 hover:bg-yellow-100 text-yellow-900 border-yellow-200"
                    onDragStart={(event) => onDragStart(event, 'jump')}
                    draggable
                 >
                    <Rabbit size={16} /> {t.nodes.jump}
                 </div>
                 <div 
                    className="p-3 rounded cursor-move transition-colors font-medium border flex items-center gap-2 dark:bg-slate-500 dark:hover:bg-slate-400 dark:text-slate-100 dark:border-slate-500 bg-white hover:bg-slate-50 text-slate-900 border-slate-200"
                    onDragStart={(event) => onDragStart(event, 'memo')}
                    draggable
                 >
                    <StickyNote size={16} /> {t.nodes.memo}
                 </div>
            </div>
             </div>
        )}
        {activeTab === 'characters' && <CharacterList />}
        {activeTab === 'resources' && <ResourceList />}
        {activeTab === 'variables' && <VariableList />}
      </div>
    </aside>
  );
};
