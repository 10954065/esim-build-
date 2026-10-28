"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Flag } from "@/components/common/flag";
import { suggest, type SuggestOption } from "@/lib/suggest";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  options: readonly SuggestOption[];
  placeholder: string;
  /** Accessible name of the suggestion list, e.g. "Destinations". */
  listLabel: string;
  className?: string;
  defaultValue?: string;
  name?: string;
};

/**
 * Search input with type-ahead suggestions (WAI-ARIA combobox). Picking a suggestion opens its
 * page; Enter with nothing highlighted submits the surrounding GET form as before, so search
 * still works without JavaScript. The parent must be `position: relative`.
 */
export function SearchCombobox({ id, options, placeholder, listLabel, className, defaultValue, name = "q" }: Props) {
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const results = useMemo(() => suggest(options, value), [options, value]);
  const expanded = open && results.length > 0;
  const optionId = (i: number) => `${listId}-option-${i}`;

  const choose = (option: SuggestOption) => {
    setValue(option.label);
    setOpen(false);
    router.push(option.href);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const last = results.length - 1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (results.length === 0) return;
      e.preventDefault();
      setOpen(true);
      if (e.key === "ArrowDown") setActive((i) => (i >= last ? 0 : i + 1));
      else setActive((i) => (i <= 0 ? last : i - 1));
    } else if (e.key === "Enter" && expanded && active >= 0) {
      e.preventDefault();
      choose(results[active]!);
    } else if (e.key === "Escape" && expanded) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  const countMessage = open && value.trim() ? `${results.length} suggestion${results.length === 1 ? "" : "s"}` : "";

  return (
    <>
      <input
        id={id}
        name={name}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={80}
        className={className}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={listLabel}
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border bg-popover p-1.5 text-left text-popover-foreground shadow-float"
      >
        {results.map((option, i) => (
          <li
            key={option.href}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            // Keep focus in the input so blur does not close the list before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(option)}
            onMouseEnter={() => setActive(i)}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
              i === active ? "bg-accent text-accent-foreground" : "text-foreground",
            )}
          >
            <Flag code={option.code} kind={option.kind} />
            <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
            {option.hint && <span className="shrink-0 text-xs text-muted-foreground">{option.hint}</span>}
          </li>
        ))}
      </ul>
      <span className="sr-only" aria-live="polite">
        {countMessage}
      </span>
    </>
  );
}
