import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { PropertyPanel } from './PropertyPanel';
import { Canvas } from './Canvas';
import { ManualModal } from './ManualModal';
import { AboutModal } from './AboutModal';
import { useScenarioStore } from '../store/scenarioStore';
import { Play, Edit, Save, Upload, Languages, Book, Sun, Moon, Undo, Redo, Eye, EyeOff, ChevronDown, Info, Check, ChevronRight, Spline, Download, StickyNote, Layers } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { generateScenarioText } from '../utils/exportUtils';
import sampleStory from '../../sample_Story.json';
import sampleNestedGroup from '../../sample_NestedGroupNodes.json';

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
    
    return (
        <div 
            className="relative"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <button 
                className="w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors hover:bg-accent hover:text-accent-foreground whitespace-nowrap"
            >
                <div className="flex items-center gap-2">
                    {Icon && <Icon size={14} />}
                    {label}
                </div>
                <ChevronRight size={12} />
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

const MenuDropdown = ({ label, children, isOpen, onToggle, onClose }: { label: string, children: React.ReactNode, isOpen: boolean, onToggle: () => void, onClose: () => void }) => {
    const ref = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    return (
        <div className="relative" ref={ref}>
            <button 
                onClick={onToggle}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${isOpen ? 'bg-accent text-accent-foreground' : ''}`}
            >
                {label} <ChevronDown size={12} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-max min-w-[14rem] rounded-md shadow-lg border border-border py-1 z-50 bg-popover text-popover-foreground">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
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
  const { mode, setMode, nodes, edges, gameState, language, setLanguage, theme, setTheme, undo, redo, past, future, setEdgeType, edgeType, selectedNodeId, characters, resources } = useScenarioStore();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
      if (theme === 'dark') {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  }, [theme]);

  const handleSave = () => {
    const data = {
      nodes,
      edges,
      gameState,
      characters,
      resources,
      edgeType
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
        useScenarioStore.getState().loadScenario(data);
      } catch (error) {
        console.error('Failed to load scenario:', error);
        alert('Failed to load scenario. Invalid JSON.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [propertyPanelWidth, setPropertyPanelWidth] = useState(320);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isResizingProperty, setIsResizingProperty] = useState(false);

  // const sidebarRef = useRef<HTMLElement>(null); // No longer needed for resizing, but Sidebar has forwardRef. We can just omit passing ref if not needed, or keep it if we want to query it later.
  // Actually, we don't need the ref in Layout anymore for resizing.
  
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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
      <header className="h-20 border-b border-border flex items-center justify-between px-4 bg-card">
        <div className="flex items-center gap-4">
            <div className="flex flex-col items-center mr-4">
                <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-green-800 drop-shadow-sm tracking-wider" style={{ fontFamily: '"Cinzel Decorative", cursive', lineHeight: '0.8' }}>
                    ARKHAM
                </h1>
                <span className="text-[0.6rem] tracking-widest mt-1 text-muted-foreground">
                    <span className="text-purple-500 font-bold">A</span>dventure <span className="text-purple-500 font-bold">R</span>outing & <span className="text-purple-500 font-bold">K</span>eeper <span className="text-purple-500 font-bold">H</span>andling <span className="text-purple-500 font-bold">A</span>ssistant <span className="text-purple-500 font-bold">M</span>anager
                </span>
            </div>

            <div className="w-px h-10 mx-2 bg-border"></div>
            
            <div className="flex items-center gap-1">
                <button 
                    onClick={undo} 
                    disabled={past.length === 0}
                    className={`p-1.5 rounded transition-colors hover:bg-accent hover:text-accent-foreground ${past.length === 0 ? 'text-muted-foreground cursor-not-allowed' : ''}`}
                    title="Undo (Ctrl+Z)"
                >
                    <Undo size={16} />
                </button>
                <button 
                    onClick={redo} 
                    disabled={future.length === 0}
                    className={`p-1.5 rounded transition-colors hover:bg-accent hover:text-accent-foreground ${future.length === 0 ? 'text-muted-foreground cursor-not-allowed' : ''}`}
                    title="Redo (Ctrl+Y)"
                >
                    <Redo size={16} />
                </button>
            </div>

            <div className="w-px h-10 mx-2 bg-border"></div>

            <div className="flex items-center gap-1">
                <MenuDropdown 
                    label={t('menu.file')}
                    isOpen={openMenuId === 'file'}
                    onToggle={() => setOpenMenuId(openMenuId === 'file' ? null : 'file')}
                    onClose={closeMenu}
                >
                    <MenuItem onClick={handleSave} icon={Save} label={t('common.save')} />
                    <MenuItem onClick={() => fileInputRef.current?.click()} icon={Upload} label={t('common.load')} />
                    <SubMenu label={t('menu.loadSample')} icon={Upload}>
                        <MenuItem 
                            onClick={() => {
                                setConfirmModal({
                                    isOpen: true,
                                    title: t('menu.loadSample'),
                                    message: t('menu.confirmLoadSample'),
                                    onConfirm: () => {
                                        // @ts-ignore
                                        useScenarioStore.getState().loadScenario(sampleStory);
                                    }
                                });
                            }} 
                            label={t('menu.loadStory')}
                            icon={Book}
                        />
                        <MenuItem 
                            onClick={() => {
                                setConfirmModal({
                                    isOpen: true,
                                    title: t('menu.loadSample'),
                                    message: t('menu.confirmLoadSample'),
                                    onConfirm: () => {
                                        // @ts-ignore
                                        useScenarioStore.getState().loadScenario(sampleNestedGroup);
                                    }
                                });
                            }} 
                            label={t('menu.loadNestedGroup')} 
                            icon={Layers}
                        />
                    </SubMenu>
                    <div className="my-1 border-t border-border" />
                    <SubMenu label={t('menu.export')} icon={Download}>
                        <MenuItem 
                            onClick={() => {
                                const text = generateScenarioText(nodes, edges, gameState.variables, 'text');
                                const blob = new Blob([text], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `scenario_export_${Date.now()}.txt`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }} 
                            label={t('menu.exportSimple')} 
                        />
                        <MenuItem 
                            onClick={() => {
                                const text = generateScenarioText(nodes, edges, gameState.variables, 'markdown');
                                const blob = new Blob([text], { type: 'text/markdown' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `scenario_export_${Date.now()}.md`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }} 
                            label={t('menu.exportMarkdown')} 
                        />
                    </SubMenu>
                </MenuDropdown>

                <MenuDropdown 
                    label={t('menu.edit')}
                    isOpen={openMenuId === 'edit'}
                    onToggle={() => setOpenMenuId(openMenuId === 'edit' ? null : 'edit')}
                    onClose={closeMenu}
                >
                    <SubMenu label={t('menu.bulkStickyOperations')} icon={StickyNote}>
                        <MenuItem 
                            onClick={() => {
                                useScenarioStore.getState().showAllStickies();
                            }} 
                            label={t('menu.showAllStickies')} 
                        />
                        <MenuItem 
                            onClick={() => {
                                useScenarioStore.getState().hideAllStickies();
                            }} 
                            label={t('menu.hideAllStickies')} 
                        />
                        <MenuItem 
                            onClick={() => {
                                setConfirmModal({
                                    isOpen: true,
                                    title: t('menu.deleteAllStickies'),
                                    message: t('menu.deleteAllStickies') + '?',
                                    onConfirm: () => useScenarioStore.getState().deleteAllStickiesGlobal()
                                });
                            }} 
                            label={t('menu.deleteAllStickies')} 
                            danger 
                        />
                        <div className="my-1 border-t border-border" />
                        <MenuItem 
                            onClick={() => {
                                useScenarioStore.getState().showAllFreeStickies();
                            }} 
                            label={t('menu.showAllFreeStickies')} 
                        />
                        <MenuItem 
                            onClick={() => {
                                useScenarioStore.getState().hideAllFreeStickies();
                            }} 
                            label={t('menu.hideAllFreeStickies')} 
                        />
                        <MenuItem 
                            onClick={() => {
                                setConfirmModal({
                                    isOpen: true,
                                    title: t('menu.deleteAllFreeStickies'),
                                    message: t('menu.deleteAllFreeStickies') + '?',
                                    onConfirm: () => useScenarioStore.getState().deleteAllFreeStickies()
                                });
                            }} 
                            label={t('menu.deleteAllFreeStickies')} 
                            danger 
                        />
                        <div className="my-1 border-t border-border" />
                        <MenuItem 
                            onClick={() => {
                                useScenarioStore.getState().showAllNodeStickies();
                            }} 
                            label={t('menu.showAllNodeStickies')} 
                        />
                        <MenuItem 
                            onClick={() => {
                                useScenarioStore.getState().hideAllNodeStickies();
                            }} 
                            label={t('menu.hideAllNodeStickies')} 
                        />
                        <MenuItem 
                            onClick={() => {
                                setConfirmModal({
                                    isOpen: true,
                                    title: t('menu.deleteAllNodeStickies'),
                                    message: t('menu.deleteAllNodeStickies') + '?',
                                    onConfirm: () => useScenarioStore.getState().deleteAllNodeStickies()
                                });
                            }} 
                            label={t('menu.deleteAllNodeStickies')} 
                            danger 
                        />
                    </SubMenu>

                    <SubMenu label={t('menu.bulkRevealOperations')} icon={Eye}>
                        <MenuItem 
                            onClick={() => {
                                setConfirmModal({
                                    isOpen: true,
                                    title: t('common.revealAll'),
                                    message: t('common.confirmRevealAll'),
                                    onConfirm: () => useScenarioStore.getState().revealAll()
                                });
                            }} 
                            icon={Eye} 
                            label={t('common.revealAll')} 
                        />
                        <MenuItem 
                            onClick={() => {
                                setConfirmModal({
                                    isOpen: true,
                                    title: t('common.unrevealAll'),
                                    message: t('common.confirmUnrevealAll'),
                                    onConfirm: () => useScenarioStore.getState().unrevealAll()
                                });
                            }} 
                            icon={EyeOff} 
                            label={t('common.unrevealAll')} 
                        />
                    </SubMenu>
                </MenuDropdown>

                <MenuDropdown 
                    label={t('menu.setting')}
                    isOpen={openMenuId === 'setting'}
                    onToggle={() => setOpenMenuId(openMenuId === 'setting' ? null : 'setting')}
                    onClose={closeMenu}
                >
                    <MenuItem 
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                        icon={theme === 'dark' ? Sun : Moon} 
                        label={theme === 'dark' ? t('menu.switchToLight') : t('menu.switchToDark')} 
                    />
                    <MenuItem 
                        onClick={() => setLanguage(language === 'en' ? 'ja' : 'en')} 
                        icon={Languages} 
                        label={language === 'en' ? t('menu.switchToJa') : t('menu.switchToEn')} 
                    />
                    <div className="my-1 border-t border-border" />
                    <SubMenu label={t('menu.changeEdgeStyle')} icon={Spline}>
                        <MenuItem onClick={() => setEdgeType('default')} label={t('menu.edgeStyle.default')} checked={edgeType === 'default'} />
                        <MenuItem onClick={() => setEdgeType('straight')} label={t('menu.edgeStyle.straight')} checked={edgeType === 'straight'} />
                        <MenuItem onClick={() => setEdgeType('step')} label={t('menu.edgeStyle.step')} checked={edgeType === 'step'} />
                        <MenuItem onClick={() => setEdgeType('smoothstep')} label={t('menu.edgeStyle.smoothstep')} checked={edgeType === 'smoothstep'} />
                        <MenuItem onClick={() => setEdgeType('simplebezier')} label={t('menu.edgeStyle.simplebezier')} checked={edgeType === 'simplebezier'} />
                    </SubMenu>
                </MenuDropdown>

                <MenuDropdown 
                    label={t('menu.help')}
                    isOpen={openMenuId === 'help'}
                    onToggle={() => setOpenMenuId(openMenuId === 'help' ? null : 'help')}
                    onClose={closeMenu}
                >
                    <MenuItem onClick={() => setIsManualOpen(true)} icon={Book} label={t('common.manual')} />
                    <MenuItem onClick={() => setIsAboutOpen(true)} icon={Info} label={t('menu.about')} />
                </MenuDropdown>
            </div>
        </div>

        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleLoad} 
            className="hidden" 
            accept=".json"
          />
          
          <button
            onClick={() => setMode(mode === 'edit' ? 'play' : 'edit')}
            className={`flex items-center gap-2 px-4 py-2 rounded font-medium transition-colors ${
              mode === 'play' 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {mode === 'edit' ? <Play size={16} /> : <Edit size={16} />}
            {mode === 'edit' ? t('common.playMode') : t('common.editMode')}
          </button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar width={sidebarWidth} isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
        <Canvas onCanvasClick={closeMenu} />
        {(mode === 'edit' || (mode === 'play' && nodes.find(n => n.id === selectedNodeId)?.type === 'sticky')) && (
            <>
                <div 
                    className="w-1 cursor-col-resize hover:bg-primary transition-colors bg-border"
                    onMouseDown={() => setIsResizingProperty(true)}
                />
                <PropertyPanel ref={propertyPanelRef} width={propertyPanelWidth} />
            </>
        )}
      </div>
      <ManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      {confirmModal && (
          <ConfirmationModal 
            isOpen={confirmModal.isOpen} 
            title={confirmModal.title} 
            message={confirmModal.message} 
            onConfirm={confirmModal.onConfirm} 
            onClose={() => setConfirmModal(null)} 
          />
      )}
    </div>
  );
};
