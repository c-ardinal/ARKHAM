import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';
import type { NodeType } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { Package, Users, Zap, Variable as VariableIcon, Menu, Flag, Rabbit, Check, ChartBarStacked, Shield, GripVertical, ChevronDown, ChevronRight, BookOpen, Activity, GitBranch, Folder, StickyNote } from 'lucide-react';
import { getIconForCharacterType, getIconForResourceType } from '../utils/iconUtils';
import { useTranslation } from '../hooks/useTranslation';
import { VariableList } from './VariableList';
import { CharacterList } from './CharacterList';
import { ResourceList } from './ResourceList';
import type { MenuSection, MenuItem } from '../types/menu';

interface SidebarProps {
  width: number;
  isOpen: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  onOpenPropertyPanel?: () => void;
  menuItems: MenuSection[];
}

export const Sidebar = React.memo(React.forwardRef<HTMLElement, SidebarProps>(({ width: _width, isOpen, onToggle, isMobile = false, onOpenPropertyPanel, menuItems }, ref) => {
  const setSelectedNode = useScenarioStore(s => s.setSelectedNode);
  const mode = useScenarioStore(s => s.mode);
  const gameState = useScenarioStore(s => s.gameState);
  const resources = useScenarioStore(s => s.resources);
  const characters = useScenarioStore(s => s.characters);
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const toggleMenu = (section: string) => {
      setOpenMenu(prev => prev === section ? null : section);
  };
  const [activeTab, setActiveTab] = useState<'nodes' | 'characters' | 'resources' | 'variables' | 'menu'>(isMobile ? 'menu' : 'nodes');
  const { screenToFlowPosition } = useReactFlow();

  // --- Mobile Drag Support ---
  const [dragType, setDragType] = useState<NodeType | null>(null);
  const [dragData, setDragData] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{x: number, y: number} | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTouching, setIsTouching] = useState(false);

  useEffect(() => {
      const handleContextMenu = (e: MouseEvent) => {
          if (isTouching) {
              e.preventDefault();
              e.stopPropagation();
          }
      };
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
                 const position = { x: flowPos.x - 75, y: flowPos.y - 25 };
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
          const touch = e.touches[0];
          setDragType(type);
          if (data) setDragData(data);
          else setDragData(null);
          setDragPos({ x: touch.clientX, y: touch.clientY });
          
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
  
  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };
  
  const handleAddNode = (type: NodeType) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const position = screenToFlowPosition({ x: centerX, y: centerY });
      const newNode = {
        id: `${type}-${Date.now()}`,
        type: type,
        position: { x: position.x - 75, y: position.y - 25 },
        data: { 
            label: t(`nodes.${type}` as any),
            description: '',
            referenceId: undefined
        },
      };
      // @ts-ignore
      useScenarioStore.getState().addNode(newNode);
      if (isMobile && isOpen) {
          onToggle();
      }
  };

  const MenuButton = ({ onClick, icon: Icon, label, className = "", children, ...props }: any) => (
      <button
          onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onClick?.(e); }}
          className={`flex items-center gap-2 p-2 rounded w-full text-left text-sm transition-colors active:bg-accent md:hover:bg-accent ${className}`}
          style={{ touchAction: 'manipulation' }}
          {...props}
      >
          {Icon && <Icon size={16} />} <span>{label}</span> {children}
      </button>
  );

  const MenuHeader = ({ onClick, expanded, label }: any) => (
      <button 
          onClick={(e) => { e.stopPropagation(); onClick(e); }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onClick(e); }}
          className="w-full flex items-center justify-between p-2 bg-muted/30 active:bg-muted/50 md:hover:bg-muted/50 font-bold text-sm transition-colors"
          style={{ touchAction: 'manipulation' }}
      >
          <span className="flex items-center gap-2">{label}</span>
          {expanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
      </button>
  );

  const renderMobileMenuItem = (item: MenuItem, depth = 0) => {
    if (item.type === 'divider') return <div key={item.id} className="h-px bg-border my-1" />;
    
    if (item.type === 'custom') return <div key={item.id} className="p-2">{item.customRender}</div>;

    if (item.type === 'submenu') {
        return (
            <div key={item.id} className="flex flex-col">
                <div className={`px-2 py-1 text-xs font-semibold text-muted-foreground ${depth > 0 ? 'pl-4' : ''} mt-1`}>{item.label}</div>
                {item.children?.map(child => renderMobileMenuItem(child, depth + 1))}
            </div>
        );
    }

    // item or checkbox
    return (
        <MenuButton 
            key={item.id} 
            onClick={item.action} 
            icon={item.icon} 
            label={item.label} 
            className={`${item.danger ? 'hover:bg-destructive/10 text-destructive active:bg-destructive/10' : ''} ${depth > 0 ? 'pl-6' : ''}`}
        >
             {item.type === 'checkbox' && item.checked && <Check size={14} className="ml-auto"/>}
        </MenuButton>
    );
  };

  interface TabButtonProps {
      id: 'nodes' | 'characters' | 'resources' | 'variables' | 'menu';
      label: string;
      icon: React.ElementType;
  }
  
  const TabButton = ({ id, label, icon: Icon }: TabButtonProps) => {
      const handleTap = () => {
        if (activeTab === id && isOpen) {
            onToggle();
        } else {
            setActiveTab(id);
            if (!isOpen) onToggle();
        }
      };

      return (
      <button
        onClick={handleTap}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => {
            e.preventDefault(); 
            e.stopPropagation();
            handleTap();
        }}
        className={`p-1 w-12 h-12 rounded-md transition-colors flex flex-col items-center justify-center gap-1 shrink-0 ${activeTab === id && isOpen ? 'bg-primary text-primary-foreground' : 'text-accent-foreground active:bg-accent'}`}
        style={{ touchAction: 'manipulation' }}
      >
        <Icon size={24} />
        <span className="text-[10px] font-medium leading-none truncate max-w-full">{label}</span>
      </button>
      );
  };

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
            e.stopPropagation();
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
        className={`flex flex-col h-full bg-card overflow-hidden transition-all duration-300 ${isOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'} ${isMobile ? 'absolute z-[60] h-full top-0 left-16 shadow-xl border-l' : ''}`}
        style={{ 
            position: isMobile ? 'absolute' : 'relative',
            zIndex: isMobile ? 60 : 'auto',
            height: '100%',
            boxShadow: isMobile ? '4px 0 15px rgba(0,0,0,0.1)' : 'none' 
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
                            {menuItems.map(section => (
                                <div key={section.id} className="border border-border rounded overflow-hidden">
                                    <MenuHeader 
                                        onClick={() => toggleMenu(section.id)} 
                                        expanded={openMenu === section.id} 
                                        label={section.label} 
                                    />
                                    {openMenu === section.id && (
                                        <div className="flex flex-col bg-background p-1 animate-in slide-in-from-top-2 duration-200">
                                            {section.items.map(item => renderMobileMenuItem(item))}
                                        </div>
                                    )}
                                </div>
                            ))}

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
                                                                <li key={name} className="text-sm flex justify-between items-center">
                                                                    <span>{name}</span>
                                                                    <span className="text-muted-foreground text-xs">x{quantity}</span>
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
                                            draggable={!isMobile}
                                            onDragStart={(e) => onDragStart(e, type as NodeType)}
                                            onClick={() => handleAddNode(type as NodeType)}
                                            {...getTouchProps(type as NodeType)}
                                            style={isMobile ? { touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' } : undefined}
                                            className={`flex flex-col items-center justify-center gap-1 p-2 rounded cursor-grab active:cursor-grabbing border text-xs text-center h-20 transition-colors hover:bg-accent touch-none select-none`}
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
