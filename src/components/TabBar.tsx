// src/components/TabBar.tsx
import { useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { TabBarItem } from './TabBarItem';

interface TabBarProps {
  onRequestDeleteConfirm: (tabId: string) => void;
}

export function TabBar({ onRequestDeleteConfirm }: TabBarProps) {
  const { t } = useTranslation();
  const tabs = useScenarioStore((s) => s.tabs);
  const activeTabId = useScenarioStore((s) => s.activeTabId);
  const setActiveTab = useScenarioStore((s) => s.setActiveTab);
  const renameTab = useScenarioStore((s) => s.renameTab);
  const reorderTabs = useScenarioStore((s) => s.reorderTabs);
  const addTab = useScenarioStore((s) => s.addTab);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [newlyAddedTabId, setNewlyAddedTabId] = useState<string | null>(null);

  // Touch drag-reorder state: track start index and X positions for mobile
  const [touchStartIdx, setTouchStartIdx] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (idx: number) => (e: React.TouchEvent) => {
      setTouchStartIdx(idx);
      setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      // Prevent scroll only while a tab drag is in progress to avoid
      // interfering with normal horizontal scroll of the tab bar
      if (touchStartIdx !== null) {
          e.preventDefault();
      }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (touchStartIdx === null || touchStartX === null) {
          setTouchStartIdx(null);
          setTouchStartX(null);
          return;
      }
      const dropX = e.changedTouches[0].clientX;
      // Skip reorder when finger movement is smaller than 10px (treat as tap)
      if (Math.abs(dropX - touchStartX) >= 10 && containerRef.current) {
          const tabElements = Array.from(
              containerRef.current.querySelectorAll('[role="tab"]')
          );
          let dropIdx = touchStartIdx;
          for (let i = 0; i < tabElements.length; i++) {
              const rect = (tabElements[i] as HTMLElement).getBoundingClientRect();
              if (dropX >= rect.left && dropX <= rect.right) {
                  dropIdx = i;
                  break;
              }
          }
          if (dropIdx !== touchStartIdx) {
              reorderTabs(touchStartIdx, dropIdx);
          }
      }
      setTouchStartIdx(null);
      setTouchStartX(null);
  };

  const handleAdd = () => {
    const id = addTab();
    setActiveTab(id);
    setNewlyAddedTabId(id);
  };

  return (
    <div
      ref={containerRef}
      role="tablist"
      className="relative z-40 flex items-stretch bg-background border-b border-border h-9 overflow-x-auto overflow-y-hidden tab-bar-scroll"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {tabs.map((tab, idx) => (
        <TabBarItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          startInRenameMode={tab.id === newlyAddedTabId}
          onActivate={() => {
            setActiveTab(tab.id);
            if (newlyAddedTabId === tab.id) setNewlyAddedTabId(null);
          }}
          onDelete={() => onRequestDeleteConfirm(tab.id)}
          onRename={(newName) => {
            renameTab(tab.id, newName);
            if (newlyAddedTabId === tab.id) setNewlyAddedTabId(null);
          }}
          onContextMenu={() => {
            // Context menu for tabs is deferred to a future task
          }}
          onDragStart={(e) => {
            setDraggedIdx(idx);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedIdx !== null && draggedIdx !== idx) {
              reorderTabs(draggedIdx, idx);
            }
            setDraggedIdx(null);
          }}
          onTouchStart={handleTouchStart(idx)}
        />
      ))}
      <button
        type="button"
        onClick={handleAdd}
        aria-label={t('tab.add')}
        className="inline-flex items-center justify-center min-w-[36px] min-h-[36px] hover:bg-accent text-muted-foreground"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
