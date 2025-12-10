import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useScenarioStore } from '../store/scenarioStore';
import type { ScenarioNodeData } from '../types';

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
    onClick={onClick}
    onTouchEnd={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onClick) onClick(e as any);
    }}
    className={`px-4 py-2 text-left w-full transition-colors flex items-center ${
        danger 
        ? 'hover:bg-destructive/20 text-red-600 dark:text-red-400 active:bg-destructive/30' 
        : 'text-popover-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent'
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
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  const { mode } = useScenarioStore();
  
  const [safePos, setSafePos] = useState({ top: menu.top, left: menu.left });

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
     }
  }, [menu.top, menu.left]);

  return (
    <div 
      ref={ref}
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

            <div className="relative group">
                <MenuButton className="justify-between group">
                  {t('contextMenu.copyText')} <span>▶</span>
                </MenuButton>
                
                <div className="absolute left-full top-0 bg-popover border border-border shadow-lg rounded-md py-1 min-w-[140px] hidden group-hover:flex flex-col">
                    <MenuButton onClick={() => onCopyText?.('all')}>{t('contextMenu.all')}</MenuButton>
                    <MenuButton onClick={() => onCopyText?.('label')}>{t('contextMenu.label')}</MenuButton>
                    <MenuButton onClick={() => onCopyText?.('description')}>{t('contextMenu.description')}</MenuButton>
                    {['element', 'variable'].includes(menu.nodeType || '') && (
                        <MenuButton onClick={() => onCopyText?.('value')}>{t('contextMenu.value')}</MenuButton>
                    )}
                    {menu.nodeType === 'branch' && (
                        <>
                            <MenuButton onClick={() => onCopyText?.('condition')}>{t('contextMenu.condition')}</MenuButton>
                            <MenuButton onClick={() => onCopyText?.('cases')}>{t('contextMenu.cases')}</MenuButton>
                        </>
                    )}
                </div>
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
