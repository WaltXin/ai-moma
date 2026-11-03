"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { type Wall, wallCss } from "./walls";

const KEYS = ["wall", "ink", "muted", "line"] as const;

/**
 * Paints the page in the colors of the wall in view. Each `[data-wall]`
 * section carries its colors as `--floor-*` custom properties. When a section
 * crosses the middle of the viewport, its colors move onto <body>, so the
 * header, the section and the footer share one wall that eases from one color
 * to the next. Before hydration, `initial` paints the page; without
 * JavaScript, each section simply paints itself.
 *
 * On a client navigation the previous page's colors stay on <body> until this
 * page paints, so the walls ease from one page to the next instead of flashing
 * through the default theme while the page loads.
 */
export function WallRepaint({
  id,
  initial,
  children,
}: {
  /** Unique per page, e.g. "lobby" or "floor-pop". */
  id: string;
  initial: Wall;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const body = document.body;
    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-wall]"));
    if (sections.length === 0) return;

    const paint = (section: HTMLElement) => {
      const style = getComputedStyle(section);
      for (const key of KEYS) {
        body.style.setProperty(`--${key}`, style.getPropertyValue(`--floor-${key}`).trim());
      }
    };

    // Going live turns on the color transition: arriving from another painted
    // page, the walls ease over; on a first visit they already match.
    delete root.dataset.away;
    root.dataset.live = "";
    paint(sections[0]);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) paint(entry.target as HTMLElement);
        }
      },
      // A one-pixel band across the middle of the viewport.
      { rootMargin: "-50% 0px -50% 0px" },
    );
    sections.forEach((s) => observer.observe(s));

    return () => {
      observer.disconnect();
      delete root.dataset.live;
      // Next keeps a visited page in the DOM, hidden. Mark it so its wall
      // colors stop applying to the page the visitor moved on to.
      root.dataset.away = "";
      // Keep these colors for the next painted page to ease from. If none
      // arrives, hand the page back to the default theme.
      window.setTimeout(() => {
        if (document.querySelector("[data-walls][data-live]")) return;
        for (const key of KEYS) body.style.removeProperty(`--${key}`);
      }, 3000);
    };
  }, []);

  return (
    <div ref={ref} data-walls={id}>
      <style>{wallCss(id, initial)}</style>
      {children}
    </div>
  );
}
