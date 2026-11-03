"use client";

import { type ReactNode, useEffect, useRef } from "react";

const KEYS = ["wall", "ink", "muted", "line"] as const;

/**
 * Repaints the page as visitors move through the lobby. Each `[data-wall]`
 * section carries its colors as `--floor-*` custom properties. When a section
 * crosses the middle of the viewport, its colors move onto <body>, so the
 * header, the section and the footer share one wall that eases from floor to floor.
 * Without JavaScript, each section simply paints itself.
 */
export function WallRepaint({ children }: { children: ReactNode }) {
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

    // Paint the first wall before going live, so nothing flashes.
    paint(sections[0]);
    delete root.dataset.away;
    root.dataset.live = "";

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
      for (const key of KEYS) body.style.removeProperty(`--${key}`);
    };
  }, []);

  return (
    <div ref={ref} data-lobby="">
      {children}
    </div>
  );
}
