import { useState, useMemo, useRef, useEffect } from 'react';
import { useScenarioStore } from '../store/scenarioStore';
import { useTranslation } from '../hooks/useTranslation';
import { ChevronDown, X } from 'lucide-react';
import type { ScenarioNode } from '../types';

interface JumpTargetComboboxProps {
  value: { tabId: string; nodeId: string } | null;
  onChange: (target: { tabId: string; nodeId: string } | null) => void;
  excludeNodeId?: string;
}

const RESULT_LIMIT = 200;

interface Candidate {
  tabId: string;
  tabName: string;
  node: ScenarioNode;
  key: string;
  label: string;
}

export function JumpTargetCombobox({ value, onChange, excludeNodeId }: JumpTargetComboboxProps) {
  const { t } = useTranslation();
  const tabs = useScenarioStore((s) => s.tabs);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const candidates = useMemo<Candidate[]>(() => {
    const items: Candidate[] = [];
    for (const tab of tabs) {
      for (const n of tab.nodes) {
        if (n.id === excludeNodeId) continue;
        if (n.type === 'sticky' || n.type === 'character' || n.type === 'resource') continue;
        items.push({
          tabId: tab.id,
          tabName: tab.name,
          node: n,
          key: `${tab.id}::${n.id}`,
          label: `${tab.name} / ${n.data?.label ?? n.id} (${n.type})`,
        });
      }
    }
    return items;
  }, [tabs, excludeNodeId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates.slice(0, RESULT_LIMIT);
    return candidates
      .filter((c) => c.label.toLowerCase().includes(q))
      .slice(0, RESULT_LIMIT);
  }, [candidates, query]);

  const tooMany = !query.trim() && candidates.length > RESULT_LIMIT;

  const currentLabel = useMemo(() => {
    if (!value) return '';
    const cand = candidates.find((c) => c.tabId === value.tabId && c.node.id === value.nodeId);
    return cand?.label ?? '';
  }, [value, candidates]);

  const isBroken = value !== null && currentLabel === '';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left border border-input rounded px-2 py-1 bg-background flex items-center justify-between gap-2 min-h-[36px]"
      >
        <span className={`truncate text-sm ${isBroken ? 'text-destructive' : ''}`}>
          {isBroken ? t('jumpTarget.broken') : (currentLabel || t('jumpTarget.search'))}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              aria-label={t('common.close')}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="hover:bg-destructive/20 rounded p-0.5 cursor-pointer"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-popover border border-border rounded shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIdx((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const c = filtered[activeIdx];
                if (c) {
                  onChange({ tabId: c.tabId, nodeId: c.node.id });
                  setOpen(false);
                  setQuery('');
                }
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            placeholder={t('jumpTarget.search')}
            className="border-b border-border px-2 py-1 outline-none bg-background text-sm"
          />
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-sm text-muted-foreground">{t('jumpTarget.noResults')}</div>
            ) : (
              filtered.map((c, i) => (
                <div
                  key={c.key}
                  className={`px-2 py-1 text-sm cursor-pointer truncate ${i === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    onChange({ tabId: c.tabId, nodeId: c.node.id });
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {c.label}
                </div>
              ))
            )}
            {tooMany && (
              <div className="px-2 py-1 text-xs text-muted-foreground border-t border-border">
                {t('jumpTarget.tooMany')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
