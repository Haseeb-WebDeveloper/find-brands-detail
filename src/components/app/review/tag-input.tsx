"use client";

import { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/design/cn";

const MAX_SUGGESTIONS = 8;

/**
 * Words from a fixed list, as chips (owner, 2026-10-21: quick, and no misspelling, stray comma or
 * repeat). Typing filters the list; ↑ ↓ and Enter, or a click, add; Backspace on an empty box removes
 * the last. `allowNew` offers "Add … as new" when nothing matches, for a list the DB still grows.
 */
export function TagInput({
  label,
  value,
  options,
  allowNew = false,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string[];
  options: readonly string[];
  allowNew?: boolean;
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const free = options.filter((o) => !value.includes(o));
    if (!q) return free.slice(0, MAX_SUGGESTIONS);
    // Words that start with what was typed first, then words that contain it.
    const starts = free.filter((o) => o.startsWith(q));
    const contains = free.filter((o) => !o.startsWith(q) && o.includes(q));
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [options, value, q]);
  const fresh = allowNew && q && !options.includes(q) && !value.includes(q) ? q.replace(/[|,]/g, " ").replace(/\s+/g, "-") : null;
  const items = fresh ? [...matches, `+${fresh}`] : matches;

  const add = (word: string) => {
    const w = word.startsWith("+") ? word.slice(1) : word;
    if (!w || value.includes(w)) return;
    onChange([...value, w]);
    setQuery("");
    setActive(0);
    input.current?.focus();
  };
  const remove = (word: string) => onChange(value.filter((v) => v !== word));

  return (
    <div className="relative">
      <div
        className={cn(
          "-mx-2 flex min-h-9 flex-wrap items-center gap-1.5 rounded-field border border-transparent px-2 py-1",
          !disabled && "cursor-text hover:bg-fill/60 focus-within:border-tint focus-within:bg-surface",
        )}
        onClick={() => input.current?.focus()}
      >
        {value.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-full bg-fill py-0.5 pr-1 pl-2.5 text-callout text-label">
            {v}
            {!disabled ? (
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(v);
                }}
                className="grid size-5 place-items-center rounded-full text-label-secondary hover:bg-fill-strong hover:text-label"
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
        {!disabled ? (
          <input
            ref={input}
            aria-label={label}
            role="combobox"
            aria-expanded={open && items.length > 0}
            aria-controls={listId}
            value={query}
            placeholder={value.length === 0 ? "Choose…" : ""}
            onChange={(e) => {
              setQuery(e.currentTarget.value.replace(/,/g, ""));
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            // Late enough that a click on a suggestion lands first.
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((i) => Math.min(items.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter" || e.key === "Tab") {
                if (open && items[active] && q) {
                  e.preventDefault();
                  add(items[active]);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                }
              } else if (e.key === "Escape") {
                setOpen(false);
              } else if (e.key === "Backspace" && !query && value.length > 0) {
                remove(value[value.length - 1]);
              }
            }}
            className="min-w-24 flex-1 bg-transparent py-1 text-body text-label placeholder:text-label-tertiary focus-visible:outline-none"
          />
        ) : value.length === 0 ? (
          <span className="py-1 text-body text-label-tertiary">—</span>
        ) : null}
      </div>

      {open && !disabled && items.length > 0 ? (
        <ul id={listId} role="listbox" className="absolute top-full left-0 z-30 mt-1 w-64 rounded-card bg-surface py-1 shadow-lg ring-1 ring-separator">
          {items.map((item, i) => (
            <li
              key={item}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                add(item);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer px-3 py-1.5 text-callout", i === active ? "bg-fill text-label" : "text-label")}
            >
              {item.startsWith("+") ? (
                <span>
                  Add <span className="font-medium">“{item.slice(1)}”</span> as new
                </span>
              ) : (
                item
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
