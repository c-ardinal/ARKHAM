import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';

interface MoveToTabSubmenuProps {
  /** Number of nodes selected for the move operation */
  selectedCount: number;
  /** Callback invoked with the target tab ID when the user selects a tab */
  onMove: (targetTabId: string) => void;
  /** Direction the submenu panel expands; defaults to 'right' */
  direction?: 'right' | 'left';
}

/**
 * Submenu component that renders a "Move to tab" option inside a context menu.
 *
 * When only one other tab exists, the user can click and immediately trigger the
 * move. When multiple tabs exist the submenu expands on hover/click to list all
 * candidate tabs.  If no other tab is available the button is rendered disabled.
 */
export function MoveToTabSubmenu({ selectedCount, onMove, direction = 'right' }: MoveToTabSubmenuProps) {
  const { t } = useTranslation();
  const tabs = useScenarioStore((s) => s.tabs);
  const activeTabId = useScenarioStore((s) => s.activeTabId);
  const otherTabs = tabs.filter((tab) => tab.id !== activeTabId);
  const [isOpen, setIsOpen] = useState(false);

  // [SPEC-TAB-MV-001] Label changes to show the node count when multiple nodes are selected.
  const label =
    selectedCount > 1
      ? t('tab.moveNodesToWithCount').replace('{n}', String(selectedCount))
      : t('tab.moveNodesTo');

  // [SPEC-TAB-MV-002] Disabled state when no other tabs are available.
  if (otherTabs.length === 0) {
    return (
      <button
        role="menuitem"
        disabled
        className="min-h-[44px] px-4 py-2.5 text-left w-full flex items-center justify-between text-muted-foreground cursor-not-allowed"
        title={t('tab.noOtherTabs')}
      >
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((v) => !v);
        }}
        className="min-h-[44px] px-4 py-2.5 text-left w-full flex items-center justify-between transition-colors hover:bg-accent hover:text-accent-foreground active:bg-accent focus-visible:outline-none focus-visible:bg-accent focus-visible:text-accent-foreground"
      >
        <span>{label}</span>
        {direction === 'right' ? (
          <ChevronRight size={14} aria-hidden="true" />
        ) : (
          <ChevronLeft size={14} aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute top-0 bg-popover border border-border shadow-lg rounded-md py-1 min-w-[160px] flex flex-col z-50 ${
            direction === 'right' ? 'left-full' : 'right-full'
          }`}
        >
          {otherTabs.map((tab) => (
            <button
              key={tab.id}
              role="menuitem"
              onClick={() => onMove(tab.id)}
              className="min-h-[44px] px-4 py-2.5 text-left w-full text-sm transition-colors hover:bg-accent hover:text-accent-foreground active:bg-accent focus-visible:outline-none focus-visible:bg-accent focus-visible:text-accent-foreground truncate"
              title={tab.name}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
