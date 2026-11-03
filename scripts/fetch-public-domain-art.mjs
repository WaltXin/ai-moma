#!/usr/bin/env node
/**
 * Downloads the public-domain artworks hung in the museum.
 *
 *   pnpm art:fetch            # fetch anything missing
 *   pnpm art:fetch --force    # re-download every image
 *
 * Curators list works in `src/content/exhibitions.ts` as `pd("aic", 27992)` or
 * `pd("cma", 143278)`. This script finds those calls, asks the holding museum's
 * open-access API for metadata, checks that the work is really public domain,
 * saves the image to `public/art/`, and writes `src/content/collection.generated.ts`.
 *
 * Sources (both release public-domain images and data under CC0):
 *   aic  Art Institute of Chicago   https://api.artic.edu/docs/
 *   cma  Cleveland Museum of Art    https://openaccess-api.clevelandart.org/
 *
 * Public-domain rule: the museum marks the object public domain / CC0 AND every
 * artist died more than 70 years ago, so the work is free in the US and in
 * life+70 countries. Anything else is refused.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXHIBITIONS = path.join(ROOT, "src/content/exhibitions.ts");
const OUT_DIR = path.join(ROOT, "public/art");
const OUT_TS = path.join(ROOT, "src/content/collection.generated.ts");
const USER_AGENT = "ai-moma (https://github.com/WaltXin/ai-moma)";
const LATEST_DEATH_YEAR = new Date().getFullYear() - 71;
const force = process.argv.includes("--force");

/** Matches `pd("aic", 123)` calls in the exhibitions file. */
const PD_CALL = /\bpd\(\s*"(aic|cma)"\s*,\s*(\d+)\s*\)/g;

async function getJson(url) {
  const res = await fetch(url, { headers: { "AIC-User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** Collapses the stray double spaces and newlines some records contain. */
const clean = (s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : s);

function lastYear(text) {
  const years = String(text ?? "").match(/\b1\d{3}\b|\b20\d{2}\b/g);
  return years ? Number(years.at(-1)) : undefined;
}

async function fromAic(id) {
  const fields = [
    "id",
    "title",
    "artist_title",
    "artist_display",
    "date_display",
    "date_start",
    "medium_display",
    "image_id",
    "is_public_domain",
    "credit_line",
  ].join(",");
  const { data: d } = await getJson(`https://api.artic.edu/api/v1/artworks/${id}?fields=${fields}`);
  if (!d.is_public_domain) throw new Error("not marked public domain by the museum");
  if (!d.image_id) throw new Error("no image");
  // artist_display looks like "Claude Monet\nFrench, 1840–1926".
  const died = lastYear(d.artist_display?.split("\n").slice(1).join(" "));
  return {
    title: d.title,
    artist: d.artist_title ?? d.artist_display?.split("\n")[0] ?? "Unknown artist",
    died: [died],
    year: d.date_start,
    dateLabel: d.date_display,
    medium: d.medium_display,
    imageUrl: `https://www.artic.edu/iiif/2/${d.image_id}/full/843,/0/default.jpg`,
    credit: {
      institution: "Art Institute of Chicago",
      line: d.credit_line ?? undefined,
      url: `https://www.artic.edu/artworks/${d.id}`,
      license: "CC0",
    },
  };
}

async function fromCma(id) {
  const { data: d } = await getJson(`https://openaccess-api.clevelandart.org/api/artworks/${id}`);
  if (d.share_license_status !== "CC0") throw new Error("not CC0 at the museum");
  if (!d.images?.web?.url) throw new Error("no image");
  const creators = d.creators ?? [];
  // A creator like "Piet Mondrian (Dutch, 1872–1944)"; printers and publishers are dropped.
  const artists = creators.filter((c) => !/printer|publisher/i.test(c.role ?? ""));
  return {
    title: d.title,
    artist: (artists[0]?.description ?? "Unknown artist").replace(/\s*\(.*\)\s*$/, ""),
    died: creators.map((c) => Number(c.death_year) || lastYear(c.description)),
    year: d.creation_date_earliest ?? lastYear(d.creation_date),
    dateLabel: d.creation_date,
    medium: capitalize(d.technique),
    imageUrl: d.images.web.url,
    credit: {
      institution: "Cleveland Museum of Art",
      line: d.creditline ?? undefined,
      url: d.url,
      license: "CC0",
    },
  };
}

/** Reads width/height from a JPEG's SOF marker. */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error("not a JPEG");
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error("JPEG size not found");
}

async function main() {
  const source = await readFile(EXHIBITIONS, "utf8");
  const wanted = [
    ...new Map([...source.matchAll(PD_CALL)].map((m) => [`${m[1]}-${m[2]}`, m])).values(),
  ];
  console.log(`Found ${wanted.length} public-domain works in exhibitions.ts`);
  await mkdir(OUT_DIR, { recursive: true });

  const works = {};
  const failures = [];
  for (const [, src, id] of wanted) {
    const key = `${src}-${id}`;
    try {
      const meta = src === "aic" ? await fromAic(id) : await fromCma(id);
      const lateDeath = meta.died.find((y) => !y || y > LATEST_DEATH_YEAR);
      if (meta.died.length === 0 || lateDeath !== undefined) {
        throw new Error(
          `artist death year ${lateDeath ?? "unknown"} is after ${LATEST_DEATH_YEAR}; may still be in copyright`,
        );
      }

      const file = path.join(OUT_DIR, `${key}.jpg`);
      let buf;
      if (existsSync(file) && !force) {
        buf = await readFile(file);
      } else {
        const res = await fetch(meta.imageUrl, { headers: { "AIC-User-Agent": USER_AGENT } });
        if (!res.ok) throw new Error(`image ${res.status}`);
        buf = Buffer.from(await res.arrayBuffer());
        await writeFile(file, buf);
      }
      const { width, height } = jpegSize(buf);

      works[key] = {
        title: clean(meta.title),
        artist: clean(meta.artist),
        year: meta.year,
        dateLabel: clean(meta.dateLabel),
        medium: clean(meta.medium) || "Unknown medium",
        source: { kind: "image", src: `/art/${key}.jpg`, width, height },
        credit: { ...meta.credit, line: clean(meta.credit.line) },
      };
      console.log(`  ✓ ${key}  ${meta.artist}, ${meta.title}`);
    } catch (err) {
      failures.push(`${key}: ${err.message}`);
      console.error(`  ✗ ${key}  ${err.message}`);
    }
  }

  const sorted = Object.fromEntries(Object.entries(works).sort(([a], [b]) => a.localeCompare(b)));
  const ts = `// Generated by scripts/fetch-public-domain-art.mjs. Do not edit by hand:
// add \`pd("aic" | "cma", id)\` to src/content/exhibitions.ts and run \`pnpm art:fetch\`.
import type { Artwork } from "@/lib/museum/types";

export const collection: Record<string, Omit<Artwork, "id">> = ${JSON.stringify(sorted, null, 2)};
`;
  await writeFile(OUT_TS, ts);
  console.log(`Wrote ${Object.keys(works).length} works to ${path.relative(ROOT, OUT_TS)}`);

  if (failures.length) {
    console.error(`\n${failures.length} work(s) refused or failed:\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  }
}

await main();
