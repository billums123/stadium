import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { haptic } from "../lib/haptics";

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function AthleteName({ value, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }, [editing, value]);

  const commit = () => {
    const next = draft.trim().slice(0, 24) || "THE ATHLETE";
    onChange(next.toUpperCase());
    setEditing(false);
    haptic("tap");
  };

  return (
    <motion.button
      type="button"
      onClick={() => {
        if (!editing) {
          setEditing(true);
          haptic("tap");
        }
      }}
      layout
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink-2)]/60 px-4 py-3 text-left transition active:scale-[0.99] hover:border-[var(--color-chalk)]/50"
    >
      <div className="min-w-0 flex-1">
        <div className="font-display text-[10px] uppercase tracking-[0.3em] text-[var(--color-volt)]">
          tonight's athlete
        </div>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setEditing(false);
              }
            }}
            maxLength={24}
            spellCheck={false}
            autoCapitalize="characters"
            className="w-full min-w-0 truncate border-0 bg-transparent p-0 font-display text-[clamp(1.4rem,6vw,2rem)] uppercase tracking-wider text-[var(--color-chalk)] outline-none"
          />
        ) : (
          <div className="font-display text-[clamp(1.4rem,6vw,2rem)] leading-none text-[var(--color-chalk)] truncate">
            {value || "THE ATHLETE"}
          </div>
        )}
      </div>
      {!editing && (
        <span className="shrink-0 rounded-md border border-[var(--color-line)] px-2.5 py-1 font-display text-[11px] uppercase tracking-[0.25em] text-[var(--color-chalk)]/75">
          tap to rename
        </span>
      )}
    </motion.button>
  );
}
