"use client";

import { useEffect, useRef, useState } from "react";
import { GUIDE_LANG_NAMES, GUIDE_LANGS, type GuideLang, preferredGuideLang } from "@/lib/museum/guides";
import type { GuideEntry } from "@/lib/museum/registry";

const LANG_KEY = "ai-moma:guide-lang";

function rememberedLang(): GuideLang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v && (GUIDE_LANGS as readonly string[]).includes(v) ? (v as GuideLang) : null;
  } catch {
    return null;
  }
}

function remember(lang: GuideLang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Private windows: the choice just isn't kept.
  }
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * A work's audio guide: pick a language, listen, read along. The voice is a
 * file recorded ahead of time, so playing it costs nothing but the download.
 * Renders nothing for a work without a guide. `onSpeaking` lets the walk
 * lower its music while the guide talks.
 */
export function AudioGuide({ artId, onSpeaking }: { artId: string; onSpeaking?: (on: boolean) => void }) {
  const [guide, setGuide] = useState<Partial<Record<GuideLang, GuideEntry>> | null>(null);
  const [lang, setLang] = useState<GuideLang>("en");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const speaking = useRef(onSpeaking);
  useEffect(() => {
    speaking.current = onSpeaking;
  }, [onSpeaking]);

  useEffect(() => {
    let live = true;
    fetch(`/api/guides/${encodeURIComponent(artId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((g: Partial<Record<GuideLang, GuideEntry>> | null) => {
        if (!live || !g) return;
        const have = GUIDE_LANGS.filter((l) => g[l]);
        if (!have.length) return;
        const wanted = rememberedLang() ?? preferredGuideLang(navigator.languages ?? [navigator.language]);
        setLang(have.includes(wanted) ? wanted : have[0]);
        setGuide(g);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [artId]);

  // Quiet the room while it speaks; restore it when the guide closes.
  useEffect(() => {
    speaking.current?.(playing);
  }, [playing]);
  useEffect(
    () => () => {
      audio.current?.pause();
      speaking.current?.(false);
    },
    [],
  );

  if (!guide) return null;
  const entry = guide[lang];
  const langs = GUIDE_LANGS.filter((l) => guide[l]);
  const length = entry?.audio?.seconds ?? 0;

  const choose = (l: GuideLang) => {
    if (l === lang) return;
    remember(l);
    const wasPlaying = playing;
    setLang(l);
    setTime(0);
    // The new language's file starts from the top, playing if the old one was.
    requestAnimationFrame(() => {
      const a = audio.current;
      if (!a) return;
      a.currentTime = 0;
      if (wasPlaying && guide[l]?.audio) void a.play().catch(() => setPlaying(false));
    });
  };

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  };

  return (
    <section aria-label="Audio guide" className="mt-6 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3 className="text-sm font-semibold">Audio guide</h3>
        {langs.length > 1 && (
          <div role="radiogroup" aria-label="Language" className="flex gap-1">
            {langs.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={l === lang}
                lang={l}
                onClick={() => choose(l)}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  l === lang ? "bg-ink text-wall" : "hover:bg-ink/10"
                }`}
              >
                {GUIDE_LANG_NAMES[l]}
              </button>
            ))}
          </div>
        )}
      </div>

      {entry?.audio ? (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Listen"}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-wall transition-colors hover:bg-accent hover:text-white"
          >
            {playing ? (
              <svg aria-hidden viewBox="0 0 14 14" className="size-3.5" fill="currentColor">
                <rect x="2.5" y="1.5" width="3" height="11" />
                <rect x="8.5" y="1.5" width="3" height="11" />
              </svg>
            ) : (
              <svg aria-hidden viewBox="0 0 14 14" className="ml-0.5 size-3.5" fill="currentColor">
                <path d="M2.5 1.2v11.6L12.5 7z" />
              </svg>
            )}
          </button>
          <input
            type="range"
            aria-label="Position"
            min={0}
            max={length}
            step={0.1}
            value={Math.min(time, length)}
            onChange={(e) => {
              const t = Number(e.target.value);
              setTime(t);
              if (audio.current) audio.current.currentTime = t;
            }}
            className="min-w-0 flex-1 accent-ink"
          />
          <span className="shrink-0 text-xs text-muted tabular-nums">
            {clock(time)} / {clock(length)}
          </span>
          <audio
            ref={audio}
            src={entry.audio.src}
            preload="none"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setTime(0);
            }}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">The recording in this language is on its way. Read along below.</p>
      )}

      {entry && (
        <details className="group mt-3" open={!entry.audio}>
          <summary className="cursor-pointer text-sm underline-offset-4 hover:underline">Read along</summary>
          <p lang={lang} className="mt-2 text-sm leading-relaxed">
            {entry.text}
          </p>
        </details>
      )}
    </section>
  );
}
