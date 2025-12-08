import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';
import type { NodeType } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { Package, Users, Zap, Variable as VariableIcon, Menu, Flag, GitBranch, Folder, StickyNote, Save, Upload, Download, Moon, Sun, Book, Info, ChevronDown, ChevronRight, Rabbit, Eye, EyeOff, Trash2, Check, Activity, ChartBarStacked, Minus, GitMerge, GripVertical, Shield, BookOpen } from 'lucide-react';
import { getIconForCharacterType, getIconForResourceType } from '../utils/iconUtils';
import { useTranslation } from '../hooks/useTranslation';
import { VariableList } from './VariableList';
import { CharacterList } from './CharacterList';
import { ResourceList } from './ResourceList';

export interface MenuActions {
    onSave: () => void;
    onLoadClick: () => void;
    onLoadSample: (type: 'story' | 'nested') => void;
    onExport: (type: 'text' | 'markdown') => void;
    onReset: () => void;
    onToggleTheme: () => void;
    onToggleLang: () => void;
    onOpenManual: () => void;
    onOpenAbout: () => void;
    onShowAllStickies: () => void;
    onHideAllStickies: () => void;
    onDeleteAllStickies: () => void;
    onRevealAll: () => void;
    onUnrevealAll: () => void;
    mode: 'edit' | 'play';
    toggleMode: () => void;
}

interface SidebarProps {
  width: number;
  isOpen: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  menuActions: MenuActions;
  onOpenPropertyPanel?: () => void;
}

export const Sidebar = React.memo(React.forwardRef<HTMLElement, SidebarProps>(({ width: _width, isOpen, onToggle, isMobile = false, menuActions, onOpenPropertyPanel }, ref) => {
  const { setSelectedNode, setEdgeType, edgeType, theme, language, characters, resources, mode, gameState } = useScenarioStore();
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const toggleMenu = (section: string) => {
      setOpenMenu(prev => prev === section ? null : section);
  };
  const [activeTab, setActiveTab] = useState<'nodes' | 'characters' | 'resources' | 'variables' | 'menu' | 'mobile_root'>(isMobile ? 'mobile_root' : 'nodes');
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    if (isMobile) {
        setActiveTab('mobile_root');
    } else {
        if (activeTab === 'mobile_root') setActiveTab('nodes');
    }
  }, [isMobile]);

  // --- Mobile Drag Support ---
  const [dragType, setDragType] = useState<NodeType | null>(null);
  const [dragData, setDragData] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{x: number, y: number} | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTouching, setIsTouching] = useState(false); // Flag for context menu prevention

  useEffect(() => {
      const handleContextMenu = (e: MouseEvent) => {
          if (isTouching) {
              e.preventDefault();
              e.stopPropagation();
          }
      };
      // Use capture to ensuring it runs before others if needed, or bubble.
      // Window level might be safest for "global sidebar interaction".
      // But user said "Sidebar internal panel".
      // Let's attach to the sidebar root ref logic if possible, but Sidebar is a component.
      // We can attach to window just to be safe during sidebar touch.
      if (isTouching) {
         window.addEventListener('contextmenu', handleContextMenu, { capture: true });
      }
      return () => {
         window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      };
  }, [isTouching]);

  useEffect(() => {
      const handleWindowTouchMove = (e: TouchEvent) => {
          if (dragType) {
              e.preventDefault();
              const touch = e.touches[0];
              setDragPos({ x: touch.clientX, y: touch.clientY });
          }
      };

      const handleWindowTouchEnd = (_e: TouchEvent) => {
          if (dragType) {
              if (dragPos && dragPos.x !== 0 && dragPos.y !== 0) {
                 const flowPos = screenToFlowPosition({ x: dragPos.x, y: dragPos.y });
                 // Offset to center the node (approx 150x50 center)
                 const position = { x: flowPos.x - 75, y: flowPos.y - 25 };
                 // Ensure valid position
                 if (!isNaN(position.x) && !isNaN(position.y)) {
                     const newNode = {
                        id: `${dragType}-${Date.now()}`,
                        type: dragType,
                        position,
                        data: { 
                            label: t(`nodes.${dragType}` as any),
                            description: '',
                            referenceId: dragData || undefined
                        },
                     };
                     // @ts-ignore
                     useScenarioStore.getState().addNode(newNode);
                 }
              }
              setDragType(null);
              setDragPos(null);
              if (isMobile && onToggle && isOpen) {
                  setTimeout(() => onToggle(), 100);
              }
          }
      };

      const handleWindowTouchCancel = () => {
          setDragType(null);
          setDragPos(null);
      };

      if (dragType) {
          window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
          window.addEventListener('touchend', handleWindowTouchEnd);
          window.addEventListener('touchcancel', handleWindowTouchCancel);
      }
      return () => {
          window.removeEventListener('touchmove', handleWindowTouchMove);
          window.removeEventListener('touchend', handleWindowTouchEnd);
          window.removeEventListener('touchcancel', handleWindowTouchCancel);
      };
  }, [dragType, dragPos, screenToFlowPosition, isMobile, onToggle, isOpen, t]);

      const onNodeTouchStart = (e: React.TouchEvent, type: NodeType, data?: string) => {
          if (!isMobile) return;
          // Prevent default to avoid scrolling/selection interference and ensure touchmove fires
          // e.preventDefault(); // React synthetic event might not support preventDefault on touchstart for passive listeners...
          // But we can try. If passive, console warning.
          // Better: set touch-action: none on CSS.
          const touch = e.touches[0];
          setDragType(type);
          if (data) setDragData(data);
          else setDragData(null);
          setDragPos({ x: touch.clientX, y: touch.clientY });
          
          // Close sidebar with delay - wait, if we keep content mounted, we can toggle immediately!
          // The key is that the DOM element must NOT disappear.
          if (isOpen) {
              onToggle();
          }
      };

  const onNodeTouchMove = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  const onNodeTouchEnd = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  const getTouchProps = (type: NodeType) => ({
      onTouchStart: (e: React.TouchEvent) => onNodeTouchStart(e, type),
      onTouchMove: onNodeTouchMove,
      onTouchEnd: onNodeTouchEnd
  });
  
  // Desktop Drag
  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };
  
  const handleAddNode = (_type: NodeType) => {
      if (isMobile) return; 
  };

  // TabButton component helper
  interface TabButtonProps {
      id: 'nodes' | 'characters' | 'resources' | 'variables' | 'menu' | 'mobile_root';
      label: string;
      icon: React.ElementType;
  }
  
  const TabButton = ({ id, label, icon: Icon }: TabButtonProps) => (
      <button
        onClick={() => {
            if (activeTab === id && isOpen) {
                onToggle();
            } else {
                setActiveTab(id);
                if (!isOpen) onToggle();
            }
        }}
        className={`p-1 w-12 h-12 rounded-md transition-colors flex flex-col items-center justify-center gap-1 shrink-0 ${activeTab === id && isOpen ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-accent-foreground'}`}
        title={label}
      >
        <Icon size={24} />
        <span className="text-[10px] font-medium leading-none truncate max-w-full">{label}</span>
      </button>
      );

    // Helper for colors
    const getNodeColor = (type: NodeType) => {
        switch (type) {
            case 'event': return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-100';
            case 'element': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100';
            case 'branch': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-100';
            case 'variable': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100';
            case 'group': return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
            case 'jump': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100';
            case 'memo': return 'bg-white text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700';
            case 'character': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100';
            case 'resource': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
        }
    };

      return (
    <>
    <aside 
        ref={ref} 
        className={`flex h-full shrink-0 z-40 bg-card border-r border-border transition-all duration-300 relative`}
        style={{ width: 'auto' }}
        onClick={(e) => {
            if (e.target === e.currentTarget) {
                setSelectedNode(null);
            }
        }}
        onTouchStart={() => setIsTouching(true)}
        onTouchEnd={() => setIsTouching(false)}
        onTouchCancel={() => setIsTouching(false)}
    >
      <div className="flex flex-col items-center py-2 gap-2 w-16 bg-muted/30 h-full border-r border-border">
        {isMobile && <TabButton id="menu" label="Menu" icon={Menu} />}
        <TabButton id="nodes" label={mode === 'play' ? t('common.gameState') : t('common.nodes')} icon={mode === 'play' ? ChartBarStacked : Package} />
        <TabButton id="characters" label={t('common.charactersShort' as any)} icon={Users} />
        <TabButton id="resources" label={t('common.resources' as any)} icon={Zap} />
        <TabButton id="variables" label={t('common.variables' as any)} icon={VariableIcon} />
      </div>

      {/* Panel Content (Visible only when open) */}
      <div 
        className={`flex flex-col h-full bg-card overflow-hidden transition-all duration-300 ${isOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'}`}
        style={{ 
            position: isMobile ? 'fixed' : 'relative',
            left: isMobile ? '60px' : 'auto', 
            zIndex: isMobile ? 40 : 'auto',
            top: isMobile ? '4rem' : 'auto',
            bottom: isMobile ? 0 : 'auto',
            height: isMobile ? 'auto' : '100%',
            // Remove shadow on mobile to match PC flat look as requested, or keep minimal
            boxShadow: 'none' 
        }}
      >
        {(isOpen || dragType) && (
            <>
                <div className="p-3 border-b border-border font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                         {activeTab === 'menu' ? 'Menu' : (activeTab === 'nodes' && mode === 'play' ? t('common.gameState') : t(`common.${activeTab}` as any))}
                    </div>
                </div>
                
                <div 
                    className="flex-1 overflow-y-auto overflow-x-hidden p-2" 
                    style={{ overscrollBehavior: 'contain', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setSelectedNode(null);
                        }
                    }}
                >
                    <div className="min-w-[15rem]">
                    {activeTab === 'menu' ? (
                        <div className="flex flex-col gap-2 pb-10">
                            {/* File Section */}
                            <div className="border border-border rounded overflow-hidden">
                                <button onClick={() => toggleMenu('file')} className="w-full flex items-center justify-between p-2 bg-muted/30 hover:bg-muted/50 font-bold text-sm transition-colors">
                                    <span className="flex items-center gap-2">{t('menu.file')}</span>
                                    {openMenu === 'file' ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                </button>
                                {openMenu === 'file' && (
                                    <div className="flex flex-col bg-background p-1 animate-in slide-in-from-top-2 duration-200">
                                         <button onClick={menuActions.onSave} className="flex items-center gap-2 p-2 rounded hover:bg-accent w-full text-left text-sm">
                                            <Save size={16} /> {t('common.save')}
                                         </button>
                                         <button onClick={menuActions.onLoadClick} className="flex items-center gap-2 p-2 rounded hover:bg-accent w-full text-left text-sm">
                                            <Upload size={16} /> {t('common.load')}
                                         </button>
                                         
                                         <div className="h-px bg-border my-1" />
                                         <div className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1">{t('menu.loadSample' as any)}</div>
                                         <button onClick={() => menuActions.onLoadSample('story')} className="flex items-center gap-2 p-2 rounded hover:bg-accent w-full text-left text-sm">
                                            <Book size={16} /> {t('menu.loadStory' as any)}
                                         </button>
                                         <button onClick={() => menuActions.onLoadSample('nested')} className="flex items-center gap-2 p-2 rounded hover:bg-accent w-full text-left text-sm">
                                            <Folder size={16} /> {t('menu.loadNestedGroup' as any)}
                                         </button>
                                         
                                         <div className="h-px bg-border my-1" />
                                         <div className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1">{t('menu.export')}</div>
                                         <button onClick={() => menuActions.onExport('text')} className="flex items-center gap-2 p-2 rounded hover:bg-accent w-full text-left text-sm">
                                            <Download size={16} /> {t('menu.exportSimple' as any)}
                                         </button>
                                         <button onClick={() => menuActions.onExport('markdown')} className="flex items-center gap-2 p-2 rounded hover:bg-accent w-full text-left text-sm">
                                            <Download size={16} /> {t('menu.exportMarkdown' as any)}
                                         </button>
                                    </div>
                                )}
                            </div>

                            {/* Edit Section */}
                            <div className="border border-border rounded overflow-hidden">
                                <button onClick={() => toggleMenu('edit')} className="w-full flex items-center justify-between p-2 bg-muted/30 hover:bg-muted/50 font-bold text-sm transition-colors">
                                    <span className="flex items-center gap-2">{t('menu.edit')}</span>
                                    {openMenu === 'edit' ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                </button>
                                {openMenu === 'edit' && (
                                    <div className="flex flex-col bg-background p-1 animate-in slide-in-from-top-2 duration-200">
                                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{t('menu.stickyNotes')}</div>
                                        <button onClick={menuActions.onShowAllStickies} className="w-full text-left p-2 hover:bg-accent rounded flex items-center gap-2 text-sm"><Eye size={16}/> {t('menu.showAllStickies')}</button>
                                        <button onClick={menuActions.onHideAllStickies} className="w-full text-left p-2 hover:bg-accent rounded flex items-center gap-2 text-sm"><EyeOff size={16}/> {t('menu.hideAllStickies')}</button>
                                        <button onClick={() => { if(window.confirm(t('menu.deleteAllStickies') + '?')) { useScenarioStore.getState().deleteAllFreeStickies(); useScenarioStore.getState().deleteAllNodeStickies(); } }} className="w-full text-left p-2 hover:bg-destructive/10 text-destructive rounded flex items-center gap-2 text-sm"><Trash2 size={16}/> {t('menu.deleteAllStickies')}</button>
                                        
                                        <div className="h-px bg-border my-1" />
                                        <button onClick={() => useScenarioStore.getState().showAllFreeStickies()} className="w-full text-left p-2 hover:bg-accent rounded flex items-center gap-2 text-sm"><Eye size={16}/> {t('menu.showFreeStickies' as any)}</button>
                                        <button onClick={() => useScenarioStore.getState().hideAllFreeStickies()} className="w-full text-left p-2 hover:bg-accent rounded flex items-center gap-2 text-sm"><EyeOff size={16}/> {t('menu.hideFreeStickies' as any)}</button>
                                        <button onClick={() => { if(window.confirm(t('menu.confirmDeleteFreeStickies' as any))) useScenarioStore.getState().deleteAllFreeStickies(); }} className="w-full text-left p-2 hover:bg-destructive/10 text-destructive rounded flex items-center gap-2 text-sm"><Trash2 size={16}/> {t('menu.deleteFreeStickies' as any)}</button>
                                        
                                        <div className="h-px bg-border my-1" />
                                        <button onClick={() => useScenarioStore.getState().showAllNodeStickies()} className="w-full text-left p-2 hover:bg-accent rounded flex items-center gap-2 text-sm"><Eye size={16}/> {t('menu.showNodeStickies' as any)}</button>
                                        <button onClick={() => useScenarioStore.getState().hideAllNodeStickies()} className="w-full text-left p-2 hover:bg-accent rounded flex items-center gap-2 text-sm"><EyeOff size={16}/> {t('menu.hideNodeStickies' as any)}</button>
                                        <button onClick={() => { if(window.confirm(t('menu.confirmDeleteNodeStickies' as any))) useScenarioStore.getState().deleteAllNodeStickies(); }} className="w-full text-left p-2 hover:bg-destructive/10 text-destructive rounded flex items-center gap-2 text-sm"><Trash2 size={16}/> {t('menu.deleteNodeStickies' as any)}</button>
                                        
                                        <div className="h-px bg-border my-1" />
                                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{t('menu.bulkRevealOperations' as any)}</div>
                                        <button onClick={menuActions.onRevealAll} className="w-full text-left p-2 hover:bg-accent rounded flex items-center gap-2 text-sm"><Sun size={16}/> {t('common.revealAll')}</button>
                                        <button onClick={menuActions.onUnrevealAll} className="w-full text-left p-2 hover:bg-accent rounded flex items-center gap-2 text-sm"><Moon size={16}/> {t('common.unrevealAll')}</button>
                                    </div>
                                )}
                            </div>

                            {/* Settings Section */}
                            <div className="border border-border rounded overflow-hidden">
                                <button onClick={() => toggleMenu('setting')} className="w-full flex items-center justify-between p-2 bg-muted/30 hover:bg-muted/50 font-bold text-sm transition-colors">
                                    <span className="flex items-center gap-2">{t('menu.setting')}</span>
                                    {openMenu === 'setting' ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                </button>
                                {openMenu === 'setting' && (
                                    <div className="flex flex-col bg-background p-1 animate-in slide-in-from-top-2 duration-200">
                                         <button onClick={menuActions.onToggleTheme} className="flex items-center gap-2 p-2 rounded hover:bg-accent w-full text-left text-sm">
                                            {theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>} {theme === 'dark' ? t('menu.switchToLight' as any) : t('menu.switchToDark' as any)}
                                         </button>
                                         <button onClick={menuActions.onToggleLang} className="flex items-center gap-2 p-2 rounded hover:bg-accent w-full text-left text-sm">
                                            <Flag size={16} /> {language === 'en' ? t('menu.switchToJa' as any) : t('menu.switchToEn' as any)}
                                         </button>
                                         
                                         <div className="mt-1 flex flex-col gap-1">
                                            <div className="text-xs text-muted-foreground mb-1">{t('menu.changeEdgeStyle')}</div>
                                            <div className="flex flex-col gap-1">
                                                {['default', 'straight', 'step', 'smoothstep'].map((type) => (
                                                    <button 
                                                        key={type}
                                                        onClick={() => setEdgeType(type)}
                                                        className={`flex items-center gap-2 p-2 rounded w-full justify-start text-sm transition-colors ${edgeType === type ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                                                    >
                                                        {type === 'default' && <Activity size={16} />}
                                                        {type === 'straight' && <Minus size={16} />}
                                                        {type === 'step' && <GitBranch size={16} className="rotate-90" />} 
                                                        {type === 'smoothstep' && <GitMerge size={16} />}
                                                        <span className="flex-1 capitalize text-left">{t(`menu.edgeStyle.${type}` as any)}</span>
                                                        {edgeType === type && <Check size={14} />}
                                                    </button>
                                                ))}
                                            </div>
                                         </div>
                                    </div>
                                )}
                            </div>

                            {/* Help Section */}
                            <div className="border border-border rounded overflow-hidden">
                                <button onClick={() => toggleMenu('help')} className="w-full flex items-center justify-between p-2 bg-muted/30 hover:bg-muted/50 font-bold text-sm transition-colors">
                                    <span className="flex items-center gap-2">{t('menu.help')}</span>
                                    {openMenu === 'help' ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                </button>
                                {openMenu === 'help' && (
                                    <div className="flex flex-col bg-background p-1 animate-in slide-in-from-top-2 duration-200">
                                        <button onClick={menuActions.onOpenManual} className="flex items-center gap-2 p-2 rounded hover:bg-accent w-full text-left text-sm">
                                            <Book size={16} /> {t('common.manual')}
                                        </button>
                                        <button onClick={menuActions.onOpenAbout} className="flex items-center gap-2 p-2 rounded hover:bg-accent w-full text-left text-sm">
                                            <Info size={16} /> {t('menu.about')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'nodes' && (
                                mode === 'play' ? (
                                    <div className="flex flex-col gap-6 p-2 text-sm">
                                        {/* Status View: Inventory, Equipment, Knowledge, Skills, Stats */}
                                        {[
                                            { key: 'inventory', label: t('resources.categoryLabels.item' as any), icon: <Package size={14} />, data: gameState.inventory },
                                            { key: 'equipment', label: t('resources.categoryLabels.equipment' as any), icon: <Shield size={14} />, data: gameState.equipment },
                                            { key: 'knowledge', label: t('resources.categoryLabels.knowledge' as any), icon: <BookOpen size={14} />, data: gameState.knowledge },
                                            { key: 'skills', label: t('resources.categoryLabels.skill' as any), icon: <Zap size={14} />, data: gameState.skills },
                                            { key: 'stats', label: t('resources.categoryLabels.status' as any), icon: <Activity size={14} />, data: gameState.stats },
                                        ].map(section => {
                                            // Status View Logic
                                            // 1. Identify Definition Type from section key
                                            let definitionType = '';
                                            switch(section.key) {
                                                case 'inventory': definitionType = 'Item'; break;
                                                case 'equipment': definitionType = 'Equipment'; break;
                                                case 'knowledge': definitionType = 'Knowledge'; break;
                                                case 'skills': definitionType = 'Skill'; break;
                                                case 'stats': definitionType = 'Status'; break;
                                            }

                                            // 2. Filter resources (definitions)
                                            const definedItems = resources.filter(r => r.type === definitionType || r.type === definitionType.toLowerCase());
                                            
                                            // 3. Map to display items (Name, Quantity)
                                            const displayItems = definedItems.map(def => {
                                                // gameState keys are Names.
                                                const qty = section.data[def.name] || 0;
                                                return { name: def.name, quantity: qty };
                                            });

                                            // 4. Determine Empty State
                                            const isEmpty = displayItems.length === 0;
                                            const emptyText = section.key === 'inventory' 
                                                ? t('resources.statusView.empty' as any) 
                                                : t('resources.statusView.none' as any);

                                            return (
                                                <div key={section.key}>
                                                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2 text-muted-foreground">
                                                        {section.icon} {section.label}
                                                    </h3>
                                                    {isEmpty ? (
                                                        <div className="text-xs text-muted-foreground italic pl-6">{emptyText}</div>
                                                    ) : (
                                                        <ul className="pl-6 space-y-1">
                                                            {displayItems.map(({name, quantity}) => (
                                                                <li key={name} className="text-sm">
                                                                     {name} <span className="text-muted-foreground text-xs">x{quantity}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            );
                                        })}

                                    </div>
                                ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {['event', 'element', 'branch', 'variable', 'group', 'jump', 'memo'].map(type => (
                                        <div 
                                            key={type}
                                            className="p-2 border rounded cursor-move hover:bg-accent flex flex-col items-center gap-2 text-center text-xs touch-none select-none"
                                            style={{ WebkitTapHighlightColor: 'transparent' }}
                                            onDragStart={(event) => onDragStart(event, type as NodeType)}
                                            draggable={!isMobile}
                                            onClick={() => handleAddNode(type as NodeType)}
                                            {...getTouchProps(type as NodeType)}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 shadow-sm border-2 border-muted-foreground/20 ${getNodeColor(type as NodeType)}`}>
                                                {type === 'event' && <Flag size={20} />}
                                                {type === 'element' && <Package size={20} />}
                                                {type === 'branch' && <GitBranch size={20} />}
                                                {type === 'variable' && <VariableIcon size={20} />}
                                                {type === 'group' && <Folder size={20} />}
                                                {type === 'jump' && <Rabbit size={20} />}
                                                {type === 'memo' && <StickyNote size={20} />}
                                            </div>
                                            <span>{t(`nodes.${type}` as any)}</span>
                                        </div>
                                    ))}
                                </div>
                                )
                            )}

                            {activeTab === 'characters' && <CharacterList onMobileDragStart={isMobile ? (e: React.TouchEvent, id: string) => onNodeTouchStart(e, 'character', id) : undefined} onEdit={onOpenPropertyPanel} />}
                            {activeTab === 'resources' && <ResourceList onMobileDragStart={isMobile ? (e: React.TouchEvent, id: string) => onNodeTouchStart(e, 'resource', id) : undefined} onEdit={onOpenPropertyPanel} />}
                            {activeTab === 'variables' && <VariableList />}
                        </>
                    )}
                    </div>
                </div>
            </>
        )}
      </div>
    </aside>

    {dragType && dragPos && createPortal(
        <div 
            className="fixed z-[2500] pointer-events-none"
            style={{ 
                left: dragPos.x, 
                top: dragPos.y,
                transform: 'translate(-50%, -50%)',
                touchAction: 'none',
                width: (dragType === 'character' || dragType === 'resource') ? '280px' : '80px'
            }}
        >
            {(dragType === 'character' || dragType === 'resource') ? (
                // Detailed Card Style Ghost
                (() => {
                    const dataId = dragData;
                    const char = dragType === 'character' ? characters.find(c => c.id === dataId) : null;
                    const res = dragType === 'resource' ? resources.find(r => r.id === dataId) : null;
                    
                    if (char) {
                        return (
                            <div className="flex flex-col w-full bg-card text-card-foreground rounded-lg border-2 border-primary ring-2 ring-primary/20 shadow-xl opacity-90 backdrop-blur-sm overflow-hidden">
                                <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
                                    <GripVertical size={14} className="text-muted-foreground opacity-50 shrink-0" />
                                    <div className="p-1.5 rounded-full bg-primary/10 text-primary shrink-0">
                                        {getIconForCharacterType(char.type, 16)}
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="text-sm text-muted-foreground font-medium truncate mb-1">
                                            {t(`characters.types.${char.type}`) || char.type}
                                        </div>
                                        <div className="text-base font-bold truncate">
                                            {char.name || '(No Name)'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    if (res) {
                         return (
                            <div className="flex flex-col w-full bg-card text-card-foreground rounded-lg border-2 border-primary ring-2 ring-primary/20 shadow-xl opacity-90 backdrop-blur-sm overflow-hidden">
                                <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
                                    <GripVertical size={14} className="text-muted-foreground opacity-50 shrink-0" />
                                    <div className="p-1.5 rounded-full bg-primary/10 text-primary shrink-0">
                                        {getIconForResourceType(res.type, 16)}
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                         <div className="text-sm text-muted-foreground font-medium truncate mb-1">{t(`resources.types.${res.type}`) || res.type}</div>
                                         <div className="font-bold truncate text-base">{res.name || 'New Element'}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()
            ) : (
                // Simple Icon Style Ghost for other nodes
                <div className="p-2 rounded border border-border flex flex-col items-center gap-2 text-center text-xs bg-background/90 backdrop-blur-sm shadow-xl">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 shadow-sm border-2 border-muted-foreground/20 ${getNodeColor(dragType)}`}>
                        {dragType === 'event' && <Flag size={20} />}
                        {dragType === 'element' && <Package size={20} />}
                        {dragType === 'branch' && <GitBranch size={20} />}
                        {dragType === 'variable' && <VariableIcon size={20} />}
                        {dragType === 'group' && <Folder size={20} />}
                        {dragType === 'jump' && <Rabbit size={20} />}
                        {dragType === 'memo' && <StickyNote size={20} />}
                    </div>
                    <span className="font-medium text-foreground">{t(`nodes.${dragType}` as any)}</span>
                </div>
            )}
        </div>,
        document.body
    )}
    </>
  );
}));
