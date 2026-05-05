import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { ChevronDown, X } from 'lucide-react';

/**
 * An item displayable in SearchableSelect.
 *
 * @property id            - Unique identifier; used as the selection value.
 * @property label         - Displayed text and primary search target.
 * @property searchableText - Optional auxiliary text included in search but not displayed.
 *                            Useful when you want to allow searching by a raw enum value or
 *                            alternative spelling that differs from the display label.
 */
export interface SearchableSelectItem {
  id: string;
  label: string;
  searchableText?: string;
}

interface SearchableSelectProps {
  /** Full set of selectable items. */
  items: SearchableSelectItem[];
  /** Currently selected item id, or null when nothing is selected. */
  value: string | null;
  /** Called with the newly selected id, or null when the selection is cleared. */
  onChange: (id: string | null) => void;
  /** Placeholder text shown inside the trigger button and search input. */
  placeholder?: string;
  /**
   * Maximum number of items shown in the dropdown.
   * When the unfiltered list exceeds this limit a "please refine" hint is shown.
   * @default 200
   */
  resultLimit?: number;
}

/**
 * Generic searchable combobox that follows the WAI-ARIA combobox pattern.
 *
 * Behaviour mirrors JumpTargetCombobox (keyboard navigation, broken-state display,
 * clear button, result limit hint) but accepts an arbitrary flat list of items
 * instead of being tied to the scenario node graph.
 *
 * Keyboard shortcuts:
 * - ArrowDown / ArrowUp: move focus through the option list
 * - Enter: confirm the focused option
 * - Escape: close the dropdown without changing the selection
 */
export function SearchableSelect({
  items,
  value,
  onChange,
  placeholder,
  resultLimit = 200,
}: SearchableSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate a stable, instance-unique id so multiple SearchableSelect widgets
  // rendered simultaneously each get their own listbox aria-controls target.
  const listboxId = useRef(`searchable-select-${Math.random().toString(36).slice(2, 10)}`);

  // --- Filtered option list ---

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, resultLimit);
    return items
      .filter((it) => {
        const haystack = `${it.label} ${it.searchableText ?? ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, resultLimit);
  }, [items, query, resultLimit]);

  // True only when the unfiltered list itself exceeds the limit (no query active).
  const tooMany = !query.trim() && items.length > resultLimit;

  // --- Current selection display ---

  const currentItem = useMemo(
    () => (value ? items.find((it) => it.id === value) : undefined),
    [items, value],
  );

  // A non-null, non-empty value that has no matching item in the list is "broken".
  const isBroken = value !== null && value !== '' && !currentItem;
  const displayLabel = currentItem?.label ?? '';

  // --- Dismiss on outside click ---

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const placeholderText = placeholder ?? t('jumpTarget.search');

  return (
    <div ref={containerRef} className="relative">
      {/* WAI-ARIA combobox trigger button */}
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId.current}
        aria-activedescendant={
          open && filtered[activeIdx]
            ? `${listboxId.current}-option-${activeIdx}`
            : undefined
        }
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left border border-input rounded px-2 py-1 bg-background flex items-center justify-between gap-2 min-h-[36px]"
      >
        <span className={`truncate text-sm ${isBroken ? 'text-destructive' : ''}`}>
          {isBroken ? t('jumpTarget.broken') : displayLabel || placeholderText}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="hover:bg-destructive/20 rounded p-0.5"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown size={14} />
        </div>
      </button>

      {open && (
        <div
          role="listbox"
          id={listboxId.current}
          className="absolute left-0 right-0 mt-1 bg-popover border border-border rounded shadow-lg z-50 max-h-80 overflow-hidden flex flex-col"
        >
          <input
            autoFocus
            aria-label={placeholderText}
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
                  onChange(c.id);
                  setOpen(false);
                  setQuery('');
                }
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            placeholder={placeholderText}
            className="border-b border-border px-2 py-1 outline-none bg-background text-sm"
          />
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-sm text-muted-foreground">
                {t('jumpTarget.noResults')}
              </div>
            ) : (
              filtered.map((c, i) => (
                <div
                  key={c.id}
                  role="option"
                  id={`${listboxId.current}-option-${i}`}
                  aria-selected={i === activeIdx}
                  className={`px-2 py-1 text-sm cursor-pointer truncate ${
                    i === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                  }`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    onChange(c.id);
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
