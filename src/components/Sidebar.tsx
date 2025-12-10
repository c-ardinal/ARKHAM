import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';
import type { NodeType } from '../types';
import { useScenarioStore } from '../store/scenarioStore';
import { Package, Users, Zap, Variable as VariableIcon, Menu, Flag, GitBranch, Folder, StickyNote, Save, Upload, Download, Moon, Sun, Book, Info, ChevronDown, ChevronRight, Rabbit, Eye, EyeOff, Trash2, Check, Activity, ChartBarStacked, Minus, GitMerge, GripVertical, Shield, BookOpen, Plus, Maximize } from 'lucide-react';
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
  canvasRef?: React.RefObject<{ zoomIn: () => void; zoomOut: () => void; fitView: () => void; getZoom: () => number; setZoom: (zoom: number) => void } | null>;
  currentZoom?: number;
  setCurrentZoom?: (zoom: number) => void;
}

export const Sidebar = React.memo(React.forwardRef<HTMLElement, SidebarProps>(({ width: _width, isOpen, onToggle, isMobile = false, menuActions, onOpenPropertyPanel, canvasRef, currentZoom, setCurrentZoom }, ref) => {
  const setSelectedNode = useScenarioStore(s => s.setSelectedNode);
  const setEdgeType = useScenarioStore(s => s.setEdgeType);
  const edgeType = useScenarioStore(s => s.edgeType);
  const theme = useScenarioStore(s => s.theme);
  const language = useScenarioStore(s => s.language);
  const characters = useScenarioStore(s => s.characters);
  const resources = useScenarioStore(s => s.resources);
  const mode = useScenarioStore(s => s.mode);
  const gameState = useScenarioStore(s => s.gameState);
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const toggleMenu = (section: string) => {
      setOpenMenu(prev => prev === section ? null : section);
  };
  const [activeTab, setActiveTab] = useState<'nodes' | 'characters' | 'resources' | 'variables' | 'menu'>(isMobile ? 'menu' : 'nodes');
  const { screenToFlowPosition } = useReactFlow();

  // Reset tab on mobile switch is not necessary and causes loop issues.
  // Instead, rely on user interaction.

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
  
  const handleAddNode = (type: NodeType) => {
      // Get center of viewport relative to window
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

      // Close sidebar on mobile/tablet after adding
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
          {Icon && <Icon size={16} />} {label} {children}
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

  // TabButton component helper
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
                            {/* File Section */}
                            <div className="border border-border rounded overflow-hidden">
                                <MenuHeader onClick={() => toggleMenu('file')} expanded={openMenu === 'file'} label={t('menu.file')} />
                                {openMenu === 'file' && (
                                    <div className="flex flex-col bg-background p-1 animate-in slide-in-from-top-2 duration-200">
                                         <MenuButton onClick={menuActions.onSave} icon={Save} label={t('common.save')} />
                                         <MenuButton onClick={menuActions.onLoadClick} icon={Upload} label={t('common.load')} />
                                         
                                         <div className="h-px bg-border my-1" />
                                         <div className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1">{t('menu.loadSample' as any)}</div>
                                         <MenuButton onClick={() => menuActions.onLoadSample('story')} icon={Book} label={t('menu.loadStory' as any)} />
                                         <MenuButton onClick={() => menuActions.onLoadSample('nested')} icon={Folder} label={t('menu.loadNestedGroup' as any)} />
                                         
                                         <div className="h-px bg-border my-1" />
                                         <div className="text-xs font-semibold text-muted-foreground uppercase px-2 py-1">{t('menu.export')}</div>
                                         <MenuButton onClick={() => menuActions.onExport('text')} icon={Download} label={t('menu.exportSimple' as any)} />
                                         <MenuButton onClick={() => menuActions.onExport('markdown')} icon={Download} label={t('menu.exportMarkdown' as any)} />
                                         <div className="h-px bg-border my-1" />
                                         <MenuButton onClick={() => { 
                                             if(window.confirm('すべてのノード、キャラクター、リソース、変数、ゲーム状態、履歴を削除して初期状態に戻します。設定は保持されます。よろしいですか？')) { 
                                                 useScenarioStore.getState().resetToInitialState(); 
                                             } 
                                         }} icon={Trash2} label="消去" className="hover:bg-destructive/10 text-destructive active:bg-destructive/10" />
                                    </div>
                                )}
                            </div>

                            {/* Edit Section */}
                            <div className="border border-border rounded overflow-hidden">
                                <MenuHeader onClick={() => toggleMenu('edit')} expanded={openMenu === 'edit'} label={t('menu.edit')} />
                                {openMenu === 'edit' && (
                                    <div className="flex flex-col bg-background p-1 animate-in slide-in-from-top-2 duration-200">
                                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{t('menu.stickyNotes')}</div>
                                        <MenuButton onClick={menuActions.onShowAllStickies} icon={Eye} label={t('menu.showAllStickies')} />
                                        <MenuButton onClick={menuActions.onHideAllStickies} icon={EyeOff} label={t('menu.hideAllStickies')} />
                                        <MenuButton onClick={() => { if(window.confirm(t('menu.deleteAllStickies') + '?')) { useScenarioStore.getState().deleteAllFreeStickies(); useScenarioStore.getState().deleteAllNodeStickies(); } }} icon={Trash2} label={t('menu.deleteAllStickies')} className="hover:bg-destructive/10 text-destructive active:bg-destructive/10" />
                                        
                                        <div className="h-px bg-border my-1" />
                                        <MenuButton onClick={() => useScenarioStore.getState().showAllFreeStickies()} icon={Eye} label={t('menu.showFreeStickies' as any)} />
                                        <MenuButton onClick={() => useScenarioStore.getState().hideAllFreeStickies()} icon={EyeOff} label={t('menu.hideFreeStickies' as any)} />
                                        <MenuButton onClick={() => { if(window.confirm(t('menu.confirmDeleteFreeStickies' as any))) useScenarioStore.getState().deleteAllFreeStickies(); }} icon={Trash2} label={t('menu.deleteFreeStickies' as any)} className="hover:bg-destructive/10 text-destructive active:bg-destructive/10" />
                                        
                                        <div className="h-px bg-border my-1" />
                                        <MenuButton onClick={() => useScenarioStore.getState().showAllNodeStickies()} icon={Eye} label={t('menu.showNodeStickies' as any)} />
                                        <MenuButton onClick={() => useScenarioStore.getState().hideAllNodeStickies()} icon={EyeOff} label={t('menu.hideNodeStickies' as any)} />
                                        <MenuButton onClick={() => { if(window.confirm(t('menu.confirmDeleteNodeStickies' as any))) useScenarioStore.getState().deleteAllNodeStickies(); }} icon={Trash2} label={t('menu.deleteNodeStickies' as any)} className="hover:bg-destructive/10 text-destructive active:bg-destructive/10" />
                                        
                                        <div className="h-px bg-border my-1" />
                                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{t('menu.bulkRevealOperations' as any)}</div>
                                        <MenuButton onClick={menuActions.onRevealAll} icon={Sun} label={t('common.revealAll')} />
                                        <MenuButton onClick={menuActions.onUnrevealAll} icon={Moon} label={t('common.unrevealAll')} />
                                    </div>
                                )}
                            </div>

                            {/* View Section */}
                            {canvasRef && currentZoom !== undefined && setCurrentZoom && (
                                <div className="border border-border rounded overflow-hidden">
                                    <MenuHeader onClick={() => toggleMenu('view')} expanded={openMenu === 'view'} label={t('menu.view')} />
                                    {openMenu === 'view' && (
                                        <div className="flex flex-col bg-background p-1 animate-in slide-in-from-top-2 duration-200">
                                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{t('menu.zoomLevel')}</div>
                                            <div className="flex items-center gap-2 p-2">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        canvasRef.current?.zoomOut();
                                                        setTimeout(() => {
                                                            const zoom = canvasRef.current?.getZoom();
                                                            if (zoom) setCurrentZoom(Math.round(zoom * 100));
                                                        }, 50);
                                                    }}
                                                    onTouchEnd={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        canvasRef.current?.zoomOut();
                                                        setTimeout(() => {
                                                            const zoom = canvasRef.current?.getZoom();
                                                            if (zoom) setCurrentZoom(Math.round(zoom * 100));
                                                        }, 50);
                                                    }}
                                                    className="p-1.5 md:hover:bg-accent active:bg-accent rounded flex items-center justify-center"
                                                    style={{ touchAction: 'manipulation' }}
                                                    // title={t('menu.zoomOut')} // Tooltip removed for mobile
                                                >
                                                    <Minus size={16}/>
                                                </button>
                                                <input
                                                    type="number"
                                                    value={currentZoom}
                                                    onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 1;
                                                        const clampedValue = Math.max(1, Math.min(200, value));
                                                        setCurrentZoom(clampedValue);
                                                        canvasRef.current?.setZoom(clampedValue / 100);
                                                    }}
                                                    onBlur={(e) => {
                                                        const value = parseInt(e.target.value) || 1;
                                                        const clampedValue = Math.max(1, Math.min(200, value));
                                                        setCurrentZoom(clampedValue);
                                                        canvasRef.current?.setZoom(clampedValue / 100);
                                                    }}
                                                    className="flex-1 text-center text-sm font-mono min-w-[60px] bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                                                    min="1"
                                                    max="200"
                                                />
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        canvasRef.current?.zoomIn();
                                                        setTimeout(() => {
                                                            const zoom = canvasRef.current?.getZoom();
                                                            if (zoom) setCurrentZoom(Math.round(zoom * 100));
                                                        }, 50);
                                                    }}
                                                    onTouchEnd={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        canvasRef.current?.zoomIn();
                                                        setTimeout(() => {
                                                            const zoom = canvasRef.current?.getZoom();
                                                            if (zoom) setCurrentZoom(Math.round(zoom * 100));
                                                        }, 50);
                                                    }}
                                                    className="p-1.5 md:hover:bg-accent active:bg-accent rounded flex items-center justify-center"
                                                    style={{ touchAction: 'manipulation' }}
                                                    // title={t('menu.zoomIn')} // Tooltip removed for mobile
                                                >
                                                    <Plus size={16}/>
                                                </button>
                                            </div>
                                            <div className="h-px bg-border my-1" />
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    canvasRef.current?.fitView();
                                                    setTimeout(() => {
                                                        const zoom = canvasRef.current?.getZoom();
                                                        if (zoom) setCurrentZoom(Math.round(zoom * 100));
                                                    }, 350);
                                                }}
                                                onTouchEnd={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    canvasRef.current?.fitView();
                                                    setTimeout(() => {
                                                        const zoom = canvasRef.current?.getZoom();
                                                        if (zoom) setCurrentZoom(Math.round(zoom * 100));
                                                    }, 350);
                                                }}
                                                className="w-full text-left p-2 md:hover:bg-accent active:bg-accent rounded flex items-center gap-2 text-sm"
                                                style={{ touchAction: 'manipulation' }}
                                            >
                                                <Maximize size={16}/> {t('menu.fitView')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Settings Section */}
                            <div className="border border-border rounded overflow-hidden">
                                <MenuHeader onClick={() => toggleMenu('setting')} expanded={openMenu === 'setting'} label={t('menu.setting')} />
                                {openMenu === 'setting' && (
                                    <div className="flex flex-col bg-background p-1 animate-in slide-in-from-top-2 duration-200">
                                         <MenuButton onClick={menuActions.onToggleTheme} icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? t('menu.switchToLight' as any) : t('menu.switchToDark' as any)} />
                                         <MenuButton onClick={menuActions.onToggleLang} icon={Flag} label={language === 'en' ? t('menu.switchToJa' as any) : t('menu.switchToEn' as any)} />
                                         
                                         <div className="mt-1 flex flex-col gap-1">
                                            <div className="text-xs text-muted-foreground mb-1">{t('menu.changeEdgeStyle')}</div>
                                            <div className="flex flex-col gap-1">
                                                {['default', 'straight', 'step', 'smoothstep'].map((type) => (
                                                    <button 
                                                        key={type}
                                                        onClick={(e) => { e.stopPropagation(); setEdgeType(type as any); }}
                                                        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setEdgeType(type as any); }}
                                                        className={`flex items-center gap-2 p-2 rounded w-full justify-start text-sm transition-colors ${edgeType === type ? 'bg-primary text-primary-foreground' : 'md:hover:bg-accent active:bg-accent'}`}
                                                        style={{ touchAction: 'manipulation' }}
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
                                <MenuHeader onClick={() => toggleMenu('help')} expanded={openMenu === 'help'} label={t('menu.help')} />
                                {openMenu === 'help' && (
                                    <div className="flex flex-col bg-background p-1 animate-in slide-in-from-top-2 duration-200">
                                        <MenuButton onClick={menuActions.onOpenManual} icon={Book} label={t('common.manual')} />
                                        <MenuButton onClick={menuActions.onOpenAbout} icon={Info} label={t('menu.about')} />
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
