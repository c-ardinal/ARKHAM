import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useScenarioStore } from '../store/scenarioStore';
import type { ScenarioNodeData } from '../types';
import { MoveToTabSubmenu } from './MoveToTabSubmenu';

export interface ContextMenuState {
  id: string;
  type: 'node' | 'edge' | 'pane';
  top: number;
  left: number;
  data?: ScenarioNodeData;
  nodeType?: string;
  parentNode?: string;
  hasSticky?: boolean;
  stickiesHidden?: boolean;
}

interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    danger?: boolean;
}

const MenuButton = ({ children, onClick, danger, className = "", ...props }: MenuButtonProps) => (
  <button
    role="menuitem"
    onClick={onClick}
    onTouchEnd={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onClick) onClick(e as any);
    }}
    className={`min-h-[44px] px-4 py-2.5 text-left w-full transition-colors flex items-center focus-visible:outline-none ${
        danger
        ? 'hover:bg-destructive/20 text-red-600 dark:text-red-400 active:bg-destructive/30 focus-visible:bg-destructive/20'
        : 'text-popover-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent focus-visible:bg-accent focus-visible:text-accent-foreground'
    } ${className}`}
    style={{ touchAction: 'manipulation' }}
    {...props}
  >
    {children}
  </button>
);

export const ContextMenu = ({
  menu,
  onClose,
  onDelete,
  onDuplicate,
  onReduplicate,
  onCopyText,
  onToggleState,
  onUngroup,
  onDetachFromGroup,
  onAddSticky,
  onToggleStickies,
  onDeleteStickies,
  onHideSticky,
  onMoveToTab,
  selectedCount = 1,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onReduplicate?: () => void;
  onCopyText?: (type: 'all' | 'label' | 'description' | 'value' | 'condition' | 'cases') => void;
  onToggleState?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onDetachFromGroup?: () => void;
  onAddSticky?: (targetId?: string) => void;
  onToggleStickies?: (targetId: string) => void;
  onDeleteStickies?: (targetId: string) => void;
  onHideSticky?: (stickyId: string) => void;
  /** Callback invoked when the user picks a tab to move the selected node(s) to */
  onMoveToTab?: (targetTabId: string) => void;
  /** Number of selected nodes; controls plural/singular label in MoveToTabSubmenu */
  selectedCount?: number;
  isRevealed?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
        document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const { mode } = useScenarioStore();
  
  const [safePos, setSafePos] = useState({ top: menu.top, left: menu.left });
  const [subMenuDirection, setSubMenuDirection] = useState<'right' | 'left'>('right');
  const [isCopySubOpen, setIsCopySubOpen] = useState(false);

  useLayoutEffect(() => {
     if (ref.current) {
         const { width, height } = ref.current.getBoundingClientRect();
         const screenW = window.innerWidth;
         const screenH = window.innerHeight;
         
         let newLeft = menu.left;
         let newTop = menu.top;

         if (newLeft + width > screenW) newLeft = screenW - width - 10;
         if (newTop + height > screenH) newTop = screenH - height - 10;

         setSafePos({ top: Math.max(0, newTop), left: Math.max(0, newLeft) });

         // Check if there is space for submenu on the right
         // Assuming submenu width is approx 150px
         if (newLeft + width + 150 > screenW) {
             setSubMenuDirection('left');
         } else {
             setSubMenuDirection('right');
         }
     }
  }, [menu.top, menu.left]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Context menu"
      style={{ top: safePos.top, left: safePos.left }}
      className="fixed z-50 bg-popover border border-border shadow-lg rounded-md py-1 min-w-[160px] flex flex-col text-sm text-popover-foreground transition-opacity animate-in fade-in zoom-in-95 duration-75"
    >
      {menu.type === 'node' && (
        <>
            {mode === 'edit' && menu.nodeType !== 'sticky' && (
                <MenuButton onClick={onDuplicate}>
                  {t('contextMenu.duplicate')}
                </MenuButton>
            )}

            <div
                className="relative"
                onMouseEnter={() => setIsCopySubOpen(true)}
                onMouseLeave={() => setIsCopySubOpen(false)}
            >
                <MenuButton
                    className="justify-between"
                    aria-haspopup="menu"
                    aria-expanded={isCopySubOpen}
                    onClick={(e) => { e.stopPropagation(); setIsCopySubOpen(prev => !prev); }}
                >
                  <span>{t('contextMenu.copyText')}</span>
                  {subMenuDirection === 'right'
                    ? <ChevronRight size={14} aria-hidden="true" />
                    : <ChevronLeft size={14} aria-hidden="true" />
                  }
                </MenuButton>

                {isCopySubOpen && (
                    <div
                        role="menu"
                        className={`absolute top-0 bg-popover border border-border shadow-lg rounded-md py-1 min-w-[140px] flex flex-col ${
                            subMenuDirection === 'right' ? 'left-full' : 'right-full'
                        }`}
                    >
                        <MenuButton onClick={() => { onCopyText?.('all'); onClose(); }}>{t('contextMenu.all')}</MenuButton>
                        <MenuButton onClick={() => { onCopyText?.('label'); onClose(); }}>{t('contextMenu.label')}</MenuButton>
                        <MenuButton onClick={() => { onCopyText?.('description'); onClose(); }}>{t('contextMenu.description')}</MenuButton>
                        {['element', 'variable'].includes(menu.nodeType || '') && (
                            <MenuButton onClick={() => { onCopyText?.('value'); onClose(); }}>{t('contextMenu.value')}</MenuButton>
                        )}
                        {menu.nodeType === 'branch' && (
                            <>
                                <MenuButton onClick={() => { onCopyText?.('condition'); onClose(); }}>{t('contextMenu.condition')}</MenuButton>
                                <MenuButton onClick={() => { onCopyText?.('cases'); onClose(); }}>{t('contextMenu.cases')}</MenuButton>
                            </>
                        )}
                    </div>
                )}
            </div>

            {menu.nodeType !== 'sticky' && (
                <MenuButton onClick={onToggleState}>
                    {menu.data?.revealed ? t('contextMenu.markUnrevealed') : t('contextMenu.markRevealed')}
                </MenuButton>
            )}

            {menu.nodeType === 'sticky' && menu.data?.targetNodeId && (
                <MenuButton onClick={() => onHideSticky?.(menu.id)}>
                  {t('contextMenu.hideSticky')}
                </MenuButton>
            )}

            {menu.nodeType !== 'sticky' && (
                <>
                    <div className="h-px bg-border my-1" />
                    <MenuButton onClick={() => onAddSticky?.(menu.id)}>
                        {t('contextMenu.addSticky')}
                    </MenuButton>
                    {menu.hasSticky && (
                        <>
                            <MenuButton onClick={() => onToggleStickies?.(menu.id)}>
                                {menu.stickiesHidden ? t('contextMenu.showStickies') : t('contextMenu.hideStickies')}
                            </MenuButton>
                            <MenuButton onClick={() => onDeleteStickies?.(menu.id)} danger>
                                {t('contextMenu.deleteStickies')}
                            </MenuButton>
                        </>
                    )}
                 </>
            )}
            
            {mode === 'edit' && menu.nodeType !== 'sticky' && (
                <>
                    {menu.nodeType === 'group' && (
                      <>
                        <div className="h-px bg-border my-1" />
                        <MenuButton onClick={onUngroup}>
                            {t('contextMenu.ungroup')}
                        </MenuButton>
                      </>
                    )}

                    {menu.parentNode && (
                        <MenuButton onClick={onDetachFromGroup}>
                            {t('contextMenu.detachFromGroup')}
                        </MenuButton>
                    )}
                </>
            )}

            {/* [SPEC-TAB-MV-003] Move to tab submenu — edit mode only, not for sticky nodes */}
            {mode === 'edit' && menu.nodeType !== 'sticky' && onMoveToTab && (
                <>
                    <div className="h-px bg-border my-1" />
                    <MoveToTabSubmenu
                        selectedCount={selectedCount}
                        onMove={onMoveToTab}
                        direction={subMenuDirection}
                    />
                </>
            )}

            {(mode === 'edit' || (menu.nodeType === 'sticky')) && (
                <>
                    <div className="h-px bg-border my-1" />
                    <MenuButton onClick={onDelete} danger>
                        {menu.nodeType === 'sticky' ? t('contextMenu.deleteSticky') : t('contextMenu.delete')}
                    </MenuButton>
                </>
            )}
        </>
      )}

      {menu.type === 'pane' && (
          <>
            <MenuButton onClick={() => onAddSticky?.()}>
                {t('contextMenu.addFreeSticky')}
            </MenuButton>
            
            {mode === 'edit' && (
                <MenuButton onClick={onReduplicate}>
                    {t('contextMenu.reduplicate')}
                </MenuButton>
            )}
          </>
      )}

      {mode === 'edit' && menu.type === 'edge' && (
          <MenuButton onClick={onDelete} danger>
            {t('contextMenu.delete')}
          </MenuButton>
      )}
    </div>
  );
};
