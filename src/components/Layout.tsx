import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { Sidebar } from './Sidebar';
import { PropertyPanel } from './PropertyPanel';
import { Canvas } from './Canvas';
import { ManualModal } from './ManualModal';
import { AboutModal } from './AboutModal';
import { ValidationErrorModal } from './ValidationErrorModal';
import { UpdateHistoryModal } from './UpdateHistoryModal';
import { useScenarioStore } from '../store/scenarioStore';
import { validateScenarioData } from '../utils/scenarioValidator';
import { Play, Edit, Undo, Redo, ChevronDown, Check, ChevronRight, Save, Upload, Book, Folder, Download, StickyNote, Eye, EyeOff, Trash2, Sun, Moon, Languages, Activity, Minus, Info, Spline, CornerDownRight, Route, Plus, Maximize, FileText, Settings, HelpCircle, History } from 'lucide-react';

import { useTranslation } from '../hooks/useTranslation';
import { generateScenarioText } from '../utils/exportUtils';
import sampleStory from '../../sample/sample_Story.json';
import sampleNestedGroup from '../../sample/sample_NestedGroupNodes.json';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { createPortal } from 'react-dom'; // Import createPortal

interface MenuItemProps {
    onClick?: (e: React.MouseEvent) => void;
    icon?: React.ElementType;
    label: string;
    danger?: boolean;
    checked?: boolean;
    onClose?: () => void;
}

const MenuItem = ({ onClick, icon: Icon, label, danger = false, checked = false, onClose }: MenuItemProps) => (
    <button 
        onClick={(e) => {
            onClick?.(e);
            onClose?.();
        }}
        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors relative hover:bg-accent hover:text-accent-foreground whitespace-nowrap ${danger ? 'text-red-600 dark:text-red-400 font-medium hover:bg-red-100 dark:hover:bg-red-900/30' : ''}`}
    >
        {checked && <Check size={14} className="absolute left-2 text-primary" />}
        <div className={`flex items-center gap-2 ${checked ? 'ml-6' : ''}`}>
            {Icon && <Icon size={14} />}
            {label}
        </div>
    </button>
);

interface SubMenuProps {
    label: string;
    children: React.ReactNode;
    onClose?: () => void;
    icon?: React.ElementType;
}

const SubMenu = ({ label, children, onClose, icon: Icon }: SubMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    // Toggle on click for mobile friendliness
    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    if (isMobile) {
        return (
            <div className="w-full">
                <button 
                    onClick={handleToggle}
                    className="w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors hover:bg-accent hover:text-accent-foreground whitespace-nowrap"
                >
                    <div className="flex items-center gap-2">
                        {Icon && <Icon size={14} />}
                        {label}
                    </div>
                    <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="pl-4 border-l border-border ml-2 my-1 space-y-1">
                        {React.Children.map(children, child => 
                            React.isValidElement(child) 
                                ? React.cloneElement(child as React.ReactElement<{ onClose?: () => void }>, { onClose }) 
                                : child
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div 
            className="relative"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <button 
                onClick={handleToggle}
                className="w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors hover:bg-accent hover:text-accent-foreground whitespace-nowrap"
            >
                <div className="flex items-center gap-2">
                    {Icon && <Icon size={14} />}
                    {label}
                </div>
                <ChevronRight size={12} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute left-full top-0 w-max min-w-[14rem] rounded-md shadow-lg border border-border py-1 z-50 bg-popover text-popover-foreground">
                    {React.Children.map(children, child => 
                        React.isValidElement(child) 
                            ? React.cloneElement(child as React.ReactElement<{ onClose?: () => void }>, { onClose }) 
                            : child
                    )}
                </div>
            )}
        </div>
    );
};


const MenuDropdown = ({ label, children, isOpen, onToggle, onClose, icon: Icon }: { label: string, children: React.ReactNode, isOpen: boolean, onToggle: () => void, onClose: () => void, icon?: React.ElementType }) => {
    const ref = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState<{top: number, left: number} | null>(null);
    const isCompactMenu = useMediaQuery('(max-width: 1150px)');
    
    // Use useLayoutEffect to calculate position before paint to avoid flicker
    useLayoutEffect(() => {
        if (isOpen && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            setPosition({ top: rect.bottom + 4, left: rect.left });
        } else if (!isOpen) {
            setPosition(null);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
             const dropdownEl = document.getElementById(`menu-dropdown-${label}`);
             if (
                 ref.current && 
                 !ref.current.contains(event.target as Node) && 
                 dropdownEl && 
                 !dropdownEl.contains(event.target as Node)
             ) {
                onClose();
             }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen, onClose, label]);

    return (
        <>
            <button 
                ref={ref}
                onClick={onToggle}
                className={`flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors ${isOpen ? 'bg-accent/50 text-accent-foreground' : ''}`}
                title={isCompactMenu ? label : undefined}
            >
                {Icon && (isCompactMenu || !label) && <Icon size={18} />}
                {!isCompactMenu && label}
                {!isCompactMenu && <ChevronDown size={14} className="opacity-50" />}
            </button>
            {isOpen && position && createPortal(
                <div 
                    id={`menu-dropdown-${label}`}
                    style={{ top: position.top, left: position.left }}
                    className="fixed mt-1 w-max min-w-[14rem] rounded-md shadow-lg border border-border py-1 z-[100] bg-popover text-popover-foreground menu-dropdown-content animate-in fade-in zoom-in-95 duration-100"
                >
                    {React.Children.map(children, child => 
                         React.isValidElement(child) 
                            ? React.cloneElement(child as React.ReactElement<{ onClose?: () => void }>, { onClose }) 
                            : child
                    )}
                </div>,
                document.body
            )}
        </>
    );
};

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onClose: () => void;
}

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onClose }: ConfirmationModalProps) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl p-6 w-[400px] max-w-full">
                <h3 className="text-lg font-bold mb-2 text-card-foreground">{title}</h3>
                <p className="text-muted-foreground mb-6">{message}</p>
                <div className="flex justify-end gap-2">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export const Layout = () => {
  const { mode, setMode, nodes, edges, gameState, language, setLanguage, theme, setTheme, undo, redo, past, future, setEdgeType, edgeType, selectedNodeId, setSelectedNode, characters, resources } = useScenarioStore();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [validationError, setValidationError] = useState<{ errors: string[]; warnings: string[]; corrections?: string[]; jsonContent?: string } | null>(null);

  // Mobile logic: 
  // Use (pointer: coarse) to target primary input mechanism.
  // - Smartphones/Tablets (Primary: Touch) -> Mobile Layout
  // - PCs with Touchscreen (Primary: Mouse) -> PC Layout (pointer: fine)
  const mobileQuery = '(max-width: 1366px) and (pointer: coarse)';
  const isMobile = useMediaQuery(mobileQuery);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
      // Initialize synchronously to prevent delay/flash
      if (typeof window !== 'undefined') {
          return !window.matchMedia('(max-width: 1366px) and (pointer: coarse)').matches;
      }
      return true; 
  });
  const [propertyPanelWidth, setPropertyPanelWidth] = useState(320);
  const [isResizingProperty, setIsResizingProperty] = useState(false);
  const [mobilePropertyPanelOpen, setMobilePropertyPanelOpen] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const canvasRef = useRef<{ zoomIn: () => void; zoomOut: () => void; fitView: () => void; getZoom: () => number; setZoom: (zoom: number) => void }>(null);
  const [currentZoom, setCurrentZoom] = useState(100);

  useEffect(() => {
    document.fonts.ready.then(() => {
        setFontsLoaded(true);
    });
  }, []);

  const toggleMode = useCallback(() => {
      setMode(mode === 'edit' ? 'play' : 'edit');
  }, [mode, setMode]);

  // Sync sidebar only when isMobile actually changes (e.g. resizing window)
  useEffect(() => {
    if (isMobile) {
        setIsSidebarOpen(false);
    } else {
        setIsSidebarOpen(true);
    }
  }, [isMobile]);

  useEffect(() => {
      if (theme === 'dark') {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  }, [theme]);

  // Update zoom display periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const zoom = canvasRef.current?.getZoom();
      if (zoom) setCurrentZoom(Math.round(zoom * 100));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const handleSave = () => {
    const data = {
      nodes,
      edges,
      gameState,
      characters,
      resources,
      edgeType
    };
    
    // Validate and correct the data before saving
    const validation = validateScenarioData(data);
    const dataToSave = validation.correctedData || data;
    
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Generate timestamp: YYYYMMDDHHmmssSSS
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0') +
        now.getMilliseconds().toString().padStart(3, '0');
        
    const a = document.createElement('a');
    a.href = url;
    a.download = `TRPGScenarioManager_${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Keyboard shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              e.preventDefault();
              undo();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
              e.preventDefault();
              redo();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
              e.preventDefault();
              handleSave();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, nodes, edges, gameState]);



  const handleLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        // Validate the data
        const validation = validateScenarioData(data);
        
        if (!validation.isValid) {
          // Show errors in modal
          setValidationError({
            errors: validation.errors,
            warnings: validation.warnings,
            corrections: validation.corrections,
            jsonContent: content // Pass full JSON content for parsing
          });
          return;
        }
        
        // Show warnings if any
        if (validation.warnings.length > 0) {
          setValidationError({
            errors: [],
            warnings: validation.warnings,
            corrections: validation.corrections,
            jsonContent: content // Pass full JSON content for parsing
          });
          // Auto-load after showing warnings
          setTimeout(() => {
            useScenarioStore.getState().loadScenario(validation.correctedData);
          }, 100);
        } else {
          // No warnings, load directly
          useScenarioStore.getState().loadScenario(validation.correctedData || data);
        }
      } catch (error) {
        console.error('Failed to load scenario:', error);
        setValidationError({
          errors: ['シナリオの読み込みに失敗しました。不正なJSONです。', error instanceof Error ? error.message : String(error)],
          warnings: []
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };


  const propertyPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingProperty && propertyPanelRef.current) {
        const newWidth = Math.max(250, Math.min(600, window.innerWidth - e.clientX));
        propertyPanelRef.current.style.width = `${newWidth}px`;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
        if (isResizingProperty) {
            setIsResizingProperty(false);
            setPropertyPanelWidth(Math.max(250, Math.min(600, window.innerWidth - e.clientX)));
        }
        document.body.style.cursor = 'default';
    };

    if (isResizingProperty) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none'; // Prevent text selection
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = ''; 
    };
  }, [isResizingProperty]);

  const closeMenu = useCallback(() => setOpenMenuId(null), []);

  // ... inside Layout ...
const menuActions = {
    onSave: handleSave,
    onLoadClick: () => fileInputRef.current?.click(),
    onLoadSample: (type: 'story' | 'nested') => {
        setConfirmModal({
            isOpen: true,
            title: t('menu.loadSample'),
            message: t('menu.confirmLoadSample'),
            onConfirm: () => {
                // @ts-ignore
                useScenarioStore.getState().loadScenario(type === 'story' ? sampleStory : sampleNestedGroup);
            }
        });
    },
    onExport: (type: 'text' | 'markdown') => {
        const text = generateScenarioText(nodes, edges, gameState.variables, type);
        const blob = new Blob([text], { type: type === 'text' ? 'text/plain' : 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scenario_export_${Date.now()}.${type === 'text' ? 'txt' : 'md'}`;
        a.click();
        URL.revokeObjectURL(url);
    },
    onReset: () => setConfirmModal({ isOpen: true, title: t('common.reset' as any), message: t('common.confirmReset' as any), onConfirm: () => { useScenarioStore.getState().reset(); } }),
    onToggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    onToggleLang: () => setLanguage(language === 'en' ? 'ja' : 'en'),
    onOpenManual: () => setIsManualOpen(true),
    onOpenAbout: () => setIsAboutOpen(true),
    onOpenUpdateHistory: () => setIsHistoryOpen(true),
    onShowAllStickies: () => useScenarioStore.getState().showAllStickies(),
    onHideAllStickies: () => useScenarioStore.getState().hideAllStickies(),
    onDeleteAllStickies: () => useScenarioStore.getState().deleteAllStickiesGlobal(),
    onRevealAll: () => useScenarioStore.getState().revealAll(),
    onUnrevealAll: () => useScenarioStore.getState().unrevealAll(),
    mode,
    toggleMode
  };

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Header */}
      {/* Header */}
      <header 
         className="h-16 border-b border-border bg-card flex items-center justify-between px-4 shrink-0 z-50 shadow-sm"
         onClick={() => setSelectedNode(null)}
      >
        <div className="flex items-center gap-4">
             <div className="flex flex-col items-center mr-4">
                <h1 className={`text-2xl sm:text-3xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-green-800 drop-shadow-sm tracking-wider transition-opacity duration-300 ${fontsLoaded ? 'opacity-100' : 'opacity-0'}`} style={{ fontFamily: '"Cinzel Decorative", cursive', lineHeight: '0.8' }}>ARKHAM</h1>
                <span className="text-[0.6rem] tracking-widest mt-1 text-muted-foreground hidden lg:block"><span className="text-purple-500 font-bold">A</span>dventure <span className="text-purple-500 font-bold">R</span>outing & <span className="text-purple-500 font-bold">K</span>eeper <span className="text-purple-500 font-bold">H</span>andling <span className="text-purple-500 font-bold">A</span>ssistant <span className="text-purple-500 font-bold">M</span>anager</span>
             </div>

            {/* Desktop Menu */}
            <div className={`${isMobile ? 'hidden' : 'flex'} items-center gap-1`}>
                <MenuDropdown label={t('menu.file')} isOpen={openMenuId === 'file'} onToggle={() => setOpenMenuId(openMenuId === 'file' ? null : 'file')} onClose={closeMenu} icon={FileText}>
                    <MenuItem onClick={handleSave} label={t('common.save')} icon={Save} />
                    <MenuItem onClick={() => fileInputRef.current?.click()} label={t('common.load')} icon={Upload} />
                    <SubMenu label={t('menu.loadSample')} icon={Book}>
                        <MenuItem 
                            onClick={() => menuActions.onLoadSample('story')} 
                            label={t('menu.loadStory')}
                            icon={Book}
                        />
                         <MenuItem 
                            onClick={() => menuActions.onLoadSample('nested')} 
                            label={t('menu.loadNestedGroup')} 
                            icon={Folder}
                        />
                    </SubMenu>
                    <div className="my-1 border-t border-border" />
                    <SubMenu label={t('menu.export')} icon={Download}>
                        <MenuItem onClick={() => menuActions.onExport('text')} label={t('menu.exportSimple')} icon={Download} />
                        <MenuItem onClick={() => menuActions.onExport('markdown')} label={t('menu.exportMarkdown')} icon={Download} />
                    </SubMenu>
                    <div className="my-1 border-t border-border" />
                    <MenuItem 
                        onClick={() => setConfirmModal({ 
                            isOpen: true, 
                            title: '消去', 
                            message: 'すべてのノード、キャラクター、リソース、変数、ゲーム状態、履歴を削除して初期状態に戻します。設定は保持されます。よろしいですか？', 
                            onConfirm: () => {
                                useScenarioStore.getState().resetToInitialState();
                                setTimeout(() => {
                                    canvasRef.current?.fitView();
                                    const zoom = canvasRef.current?.getZoom();
                                    if (zoom) setCurrentZoom(Math.round(zoom * 100));
                                }, 100);
                            } 
                        })} 
                        label="消去" 
                        danger 
                        icon={Trash2} 
                    />

                </MenuDropdown>

                <MenuDropdown label={t('menu.edit')} isOpen={openMenuId === 'edit'} onToggle={() => setOpenMenuId(openMenuId === 'edit' ? null : 'edit')} onClose={closeMenu} icon={Edit}>
                     <SubMenu label={t('menu.stickyNotes' as any) || "Sticky Notes"} icon={StickyNote}>
                        <MenuItem onClick={menuActions.onShowAllStickies} label={t('menu.showAllStickies')} icon={Eye} />
                        <MenuItem onClick={menuActions.onHideAllStickies} label={t('menu.hideAllStickies')} icon={EyeOff} />
                        <MenuItem onClick={() => setConfirmModal({ isOpen: true, title: t('menu.deleteAllStickies'), message: t('menu.deleteAllStickies') + '?', onConfirm: menuActions.onDeleteAllStickies })} label={t('menu.deleteAllStickies')} danger icon={Trash2} />
                        <div className="my-1 border-t border-border" />
                        <MenuItem onClick={() => useScenarioStore.getState().showAllFreeStickies()} label={t('menu.showFreeStickies' as any)} icon={Eye} />
                        <MenuItem onClick={() => useScenarioStore.getState().hideAllFreeStickies()} label={t('menu.hideFreeStickies' as any)} icon={EyeOff} />
                        <MenuItem onClick={() => setConfirmModal({ isOpen: true, title: t('menu.deleteFreeStickies' as any), message: t('menu.confirmDeleteFreeStickies' as any), onConfirm: () => useScenarioStore.getState().deleteAllFreeStickies() })} label={t('menu.deleteFreeStickies' as any)} danger icon={Trash2} />
                        <div className="my-1 border-t border-border" />
                        <MenuItem onClick={() => useScenarioStore.getState().showAllNodeStickies()} label={t('menu.showNodeStickies' as any)} icon={Eye} />
                        <MenuItem onClick={() => useScenarioStore.getState().hideAllNodeStickies()} label={t('menu.hideNodeStickies' as any)} icon={EyeOff} />
                        <MenuItem onClick={() => setConfirmModal({ isOpen: true, title: t('menu.deleteNodeStickies' as any), message: t('menu.confirmDeleteNodeStickies' as any), onConfirm: () => useScenarioStore.getState().deleteAllNodeStickies() })} label={t('menu.deleteNodeStickies' as any)} danger icon={Trash2} />
                    </SubMenu>
                    <SubMenu label={t('menu.bulkRevealOperations')} icon={Sun}>
                        <MenuItem onClick={() => setConfirmModal({ isOpen: true, title: t('common.revealAll'), message: t('common.confirmRevealAll'), onConfirm: menuActions.onRevealAll })} label={t('common.revealAll')} icon={Sun} />
                        <MenuItem onClick={() => setConfirmModal({ isOpen: true, title: t('common.unrevealAll'), message: t('common.confirmUnrevealAll'), onConfirm: menuActions.onUnrevealAll })} label={t('common.unrevealAll')} icon={Moon} />
                    </SubMenu>
                </MenuDropdown>

                <MenuDropdown label={t('menu.view')} isOpen={openMenuId === 'view'} onToggle={() => setOpenMenuId(openMenuId === 'view' ? null : 'view')} onClose={closeMenu} icon={Eye}>
                    <div className="px-4 py-2">
                        <div className="text-xs font-semibold text-muted-foreground mb-2">{t('menu.zoomLevel')}</div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => {
                                    canvasRef.current?.zoomOut();
                                    setTimeout(() => {
                                        const zoom = canvasRef.current?.getZoom();
                                        if (zoom) setCurrentZoom(Math.round(zoom * 100));
                                    }, 50);
                                }}
                                className="p-2 hover:bg-accent rounded flex items-center justify-center transition-colors"
                                title={t('menu.zoomOut')}
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
                                onClick={() => {
                                    canvasRef.current?.zoomIn();
                                    setTimeout(() => {
                                        const zoom = canvasRef.current?.getZoom();
                                        if (zoom) setCurrentZoom(Math.round(zoom * 100));
                                    }, 50);
                                }}
                                className="p-2 hover:bg-accent rounded flex items-center justify-center transition-colors"
                                title={t('menu.zoomIn')}
                            >
                                <Plus size={16}/>
                            </button>
                        </div>
                    </div>
                    <div className="h-px bg-border my-1 mx-2" />
                    <MenuItem 
                        onClick={() => {
                            canvasRef.current?.fitView();
                            setTimeout(() => {
                                const zoom = canvasRef.current?.getZoom();
                                if (zoom) setCurrentZoom(Math.round(zoom * 100));
                            }, 350);
                        }}
                        label={t('menu.fitView')}
                        icon={Maximize}
                    />
                </MenuDropdown>

                <MenuDropdown label={String(t('menu.setting') || 'Settings')} isOpen={openMenuId === 'setting'} onToggle={() => setOpenMenuId(openMenuId === 'setting' ? null : 'setting')} onClose={closeMenu} icon={Settings}>
                    <MenuItem onClick={menuActions.onToggleTheme} label={theme === 'dark' ? t('menu.switchToLight' as any) : t('menu.switchToDark' as any)} icon={theme === 'dark' ? Sun : Moon} />
                    <MenuItem onClick={menuActions.onToggleLang} label={language === 'en' ? t('menu.switchToJa' as any) : t('menu.switchToEn' as any)} icon={Languages} />
                     <SubMenu label={t('menu.changeEdgeStyle')} icon={Activity}>
                        <MenuItem onClick={() => setEdgeType('default')} label={t('menu.edgeStyle.default' as any)} checked={edgeType === 'default'} icon={Spline} />
                        <MenuItem onClick={() => setEdgeType('straight')} label={t('menu.edgeStyle.straight' as any)} checked={edgeType === 'straight'} icon={Minus} />
                        <MenuItem onClick={() => setEdgeType('step')} label={t('menu.edgeStyle.step' as any)} checked={edgeType === 'step'} icon={CornerDownRight} />
                        <MenuItem onClick={() => setEdgeType('smoothstep')} label={t('menu.edgeStyle.smoothstep' as any)} checked={edgeType === 'smoothstep'} icon={Route} />
                    </SubMenu>
                </MenuDropdown>

                <MenuDropdown label={t('menu.help')} isOpen={openMenuId === 'help'} onToggle={() => setOpenMenuId(openMenuId === 'help' ? null : 'help')} onClose={closeMenu} icon={HelpCircle}>
                    <MenuItem onClick={menuActions.onOpenManual} label={t('common.manual')} icon={Book} />
                    <MenuItem onClick={menuActions.onOpenUpdateHistory} label={t('menu.updateHistory')} icon={History} />
                    <MenuItem onClick={menuActions.onOpenAbout} label={t('menu.about')} icon={Info} />
                </MenuDropdown>
            </div>
        </div>
        
        {/* Right Side Controls */}
        <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <div className="flex items-center gap-1 border-r border-border pr-2 mr-2">
                <button onClick={undo} disabled={past.length === 0} className="p-2 rounded hover:bg-accent disabled:opacity-50" title={t('menu.undo' as any)}>
                    <Undo size={18} />
                </button>
                <button onClick={redo} disabled={future.length === 0} className="p-2 rounded hover:bg-accent disabled:opacity-50" title={t('menu.redo' as any)}>
                    <Redo size={18} />
                </button>
            </div>

            {/* Mode Toggle */}
             <button
                onClick={() => setMode(mode === 'edit' ? 'play' : 'edit')}
                className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded font-medium transition-colors text-sm md:text-base ${
                  mode === 'play' 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {mode === 'edit' ? <Play size={16} /> : <Edit size={16} />}
                
                {/* Large screens: Full text */}
                <span className="hidden lg:inline">
                    {mode === 'edit' ? t('common.playMode') : t('common.editMode')}
                </span>
                
                {/* Medium screens: Short text */}
                <span className="hidden md:inline lg:hidden">
                    {mode === 'edit' ? t('common.playModeShort') : t('common.editModeShort')}
                </span>
            </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Content Area */}
        <div className={`h-full`} style={{ display: 'flex', flexDirection: 'column' }}>
        <Sidebar 
            width={320} 
            isOpen={isSidebarOpen} 
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
            isMobile={isMobile}
            menuActions={menuActions}
            onOpenPropertyPanel={() => setMobilePropertyPanelOpen(true)}
            canvasRef={canvasRef}
            currentZoom={currentZoom}
            setCurrentZoom={setCurrentZoom}
        />
        </div>
        
        {isMobile && isSidebarOpen && (
            <div 
                className="absolute inset-0 bg-black/50 z-30"
                onClick={() => setIsSidebarOpen(false)}
            />
        )}

        <Canvas 
            ref={canvasRef}
            onCanvasClick={() => {
                if (isMobile && isSidebarOpen) setIsSidebarOpen(false);
                if (isMobile && mobilePropertyPanelOpen) setMobilePropertyPanelOpen(false);
            }}
            isMobile={isMobile}
            onOpenPropertyPanel={() => setMobilePropertyPanelOpen(true)}
        />
        
        {/* Helper for property resizing (Desktop) */}
        {!isMobile && selectedNodeId && (mode === 'edit' || nodes.find(n => n.id === selectedNodeId)?.type === 'sticky') && (
            <div 
                className="w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10"
                onMouseDown={() => setIsResizingProperty(true)}
            />
        )}

        {(isMobile ? mobilePropertyPanelOpen : (selectedNodeId && (mode === 'edit' || nodes.find(n => n.id === selectedNodeId)?.type === 'sticky'))) && (
           <PropertyPanel 
                width={propertyPanelWidth} 
                isMobile={isMobile}
                onClose={() => setMobilePropertyPanelOpen(false)}
            />
        )}
      </div>

       {/* Hidden File Input */}
       <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleLoad} 
            className="hidden" 
            accept=".json"
       />

      {confirmModal && (
        <ConfirmationModal 
            isOpen={confirmModal.isOpen}
            title={confirmModal.title}
            message={confirmModal.message}
            onConfirm={confirmModal.onConfirm}
            onClose={() => setConfirmModal(null)}
        />
      )}
      <UpdateHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <ManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <ValidationErrorModal
        isOpen={validationError !== null}
        errors={validationError?.errors || []}
        warnings={validationError?.warnings || []}
        corrections={validationError?.corrections || []}
        jsonContent={validationError?.jsonContent}
        onClose={() => setValidationError(null)}
      />

      </div>
    </ReactFlowProvider>
  );
};
