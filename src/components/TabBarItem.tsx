// src/components/TabBarItem.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Tab } from '../types/tab';
import { useTranslation } from '../hooks/useTranslation';

interface TabBarItemProps {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  startInRenameMode?: boolean;
}

export function TabBarItem({
  tab,
  isActive,
  onActivate,
  onDelete,
  onRename,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  startInRenameMode = false,
}: TabBarItemProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(startInRenameMode);
  const [draft, setDraft] = useState(tab.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(tab.name);
  }, [tab.name]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commit = () => {
    setIsEditing(false);
    if (draft.trim() && draft.trim() !== tab.name) {
      onRename(draft.trim());
    } else {
      setDraft(tab.name);
    }
  };

  return (
    <div
      role="tab"
      aria-selected={isActive}
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onActivate}
      onDoubleClick={() => setIsEditing(true)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e);
      }}
      className={`group inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] border-r border-border cursor-pointer select-none ${
        isActive ? 'bg-card text-foreground border-b-2 border-b-primary' : 'bg-muted text-muted-foreground hover:bg-accent'
      }`}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 50))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setIsEditing(false);
              setDraft(tab.name);
            }
          }}
          className="bg-transparent border-b border-primary outline-none text-sm w-32"
          maxLength={50}
        />
      ) : (
        <span className="text-sm whitespace-nowrap max-w-[160px] truncate">{tab.name}</span>
      )}
      <button
        type="button"
        aria-label={t('tab.delete')}
        className="opacity-50 hover:opacity-100 hover:bg-destructive/20 rounded p-0.5 ml-1"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
