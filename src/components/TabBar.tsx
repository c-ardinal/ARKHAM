// src/components/TabBar.tsx
import { useState } from 'react';
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

  const handleAdd = () => {
    const id = addTab();
    setActiveTab(id);
    setNewlyAddedTabId(id);
  };

  return (
    <div
      role="tablist"
      className="flex items-center bg-background border-b border-border h-9 overflow-x-auto tab-bar-scroll"
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
