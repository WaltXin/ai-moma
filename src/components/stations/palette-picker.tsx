"use client";

import { PALETTE } from "@/lib/stations/dots";

/** Pick one of the pure colours (or none, when `allowNone`), as a row of paint chips. */
export function PalettePicker({
  label,
  value,
  onChange,
  allowNone = false,
}: {
  label: string;
  value: number | null;
  onChange: (index: number | null) => void;
  allowNone?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <div role="radiogroup" aria-label={label} className="mt-2 flex flex-wrap gap-1.5">
        {allowNone && (
          <button
            type="button"
            role="radio"
            aria-checked={value === null}
            aria-label="None"
            title="None"
            onClick={() => onChange(null)}
            className="grid size-9 place-items-center border border-line text-xs text-muted outline-offset-2 aria-checked:border-ink aria-checked:outline-2 aria-checked:outline-ink"
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-4"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 13L13 3" />
            </svg>
          </button>
        )}
        {PALETTE.map((c, i) => (
          <button
            key={c.name}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={c.name}
            title={c.name}
            onClick={() => onChange(i)}
            className="size-9 border border-black/15 outline-offset-2 aria-checked:outline-2 aria-checked:outline-ink"
            style={{ background: c.hex }}
          />
        ))}
      </div>
    </div>
  );
}
