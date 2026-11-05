#!/usr/bin/env node
/**
 * Downloads the public-domain artworks hung in the museum.
 *
 *   pnpm art:fetch            # fetch anything missing
 *   pnpm art:fetch --force    # re-download every image
 *
 * Curators list works in `src/content/exhibitions.ts` as `pd("aic", 27992)`,
 * `pd("met", 436535)` and so on. This script finds those calls, asks the holding
 * museum's open-access API for metadata, checks that the work is really public domain,
 * saves the image to `public/art/` and a large copy for zooming in to
 * `public/art/zoom/`, and writes `src/content/collection.generated.ts`.
 *
 * Sources (all release public-domain images and data under CC0):
 *   aic  Art Institute of Chicago          https://api.artic.edu/docs/
 *   cma  Cleveland Museum of Art           https://openaccess-api.clevelandart.org/
 *   met  The Metropolitan Museum of Art    https://metmuseum.github.io/
 *   nga  National Gallery of Art           https://github.com/NationalGalleryOfArt/opendata
 *
 * NGA has no object API, only daily CSV exports (about 215 MB). They are downloaded
 * once into `node_modules/.cache/ai-moma/nga/` and refreshed after a week.
 *
 * Public-domain rule: the museum marks the object public domain / CC0 AND every
 * artist died more than 70 years ago, so the work is free in the US and in
 * life+70 countries. Anything else is refused.
 */
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXHIBITIONS = path.join(ROOT, "src/content/exhibitions.ts");
const OUT_DIR = path.join(ROOT, "public/art");
const ZOOM_DIR = path.join(OUT_DIR, "zoom");
/** Width of the wall image. */
const WALL_WIDTH = 843;
/** Long edge of the zoom copy: brushstrokes up close, about a megabyte a picture. */
const ZOOM_EDGE = 3000;
const OUT_TS = path.join(ROOT, "src/content/collection.generated.ts");
const USER_AGENT = "ai-moma (https://github.com/WaltXin/ai-moma)";
const HEADERS = { "User-Agent": USER_AGENT, "AIC-User-Agent": USER_AGENT };
const NGA_CACHE = path.join(ROOT, "node_modules/.cache/ai-moma/nga");
const NGA_DATA = "https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data";
const NGA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LATEST_DEATH_YEAR = new Date().getFullYear() - 71;
const force = process.argv.includes("--force");

/** Matches `pd("aic", 123)` calls in the exhibitions file. */
const PD_CALL = /\bpd\(\s*"(aic|cma|met|nga)"\s*,\s*(\d+)\s*\)/g;
/** Files this script owns in public/art/ and public/art/zoom/. */
const ART_FILE = /^(aic|cma|met|nga)-\d+\.jpg$/;

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
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
    // The largest size the museum serves for anyone: the whole picture within 3000 × 3000.
    zoomUrl: `https://www.artic.edu/iiif/2/${d.image_id}/full/!${ZOOM_EDGE},${ZOOM_EDGE}/0/default.jpg`,
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
    zoomUrl: d.images.print?.url,
    credit: {
      institution: "Cleveland Museum of Art",
      line: d.creditline ?? undefined,
      url: d.url,
      license: "CC0",
    },
  };
}

async function fromMet(id) {
  const d = await getJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
  if (!d.isPublicDomain) throw new Error("not marked public domain by the museum");
  if (!d.primaryImage) throw new Error("no image");
  // Death years are "|"-separated when a work has several makers; a maker
  // listed without one counts as unknown, and the work is refused.
  const died = String(d.artistEndDate ?? "")
    .split("|")
    .map((y) => Number(y) || undefined);
  const makers = (d.constituents ?? []).filter((c) => /artist|maker|author/i.test(c.role ?? ""));
  while (died.length < makers.length) died.push(undefined);
  return {
    title: d.title,
    artist: d.artistDisplayName || "Unknown artist",
    died,
    year: d.objectBeginDate,
    dateLabel: d.objectDate,
    medium: d.medium,
    // The Met's "web-large" image is only about 600 px wide, so both copies are
    // cut from the original.
    imageUrl: d.primaryImage,
    resizeWall: true,
    zoomUrl: d.primaryImage,
    credit: {
      institution: "The Metropolitan Museum of Art",
      line: d.creditLine || undefined,
      url: d.objectURL || `https://www.metmuseum.org/art/collection/search/${id}`,
      license: "CC0",
    },
  };
}

/** Downloads one NGA open-data CSV into the cache unless a fresh copy is there. */
async function ngaFile(name) {
  const file = path.join(NGA_CACHE, `${name}.csv`);
  const fresh = existsSync(file) && Date.now() - (await stat(file)).mtimeMs < NGA_MAX_AGE_MS;
  if (fresh && !force) return file;
  console.log(`  … downloading NGA ${name}.csv`);
  const res = await fetch(`${NGA_DATA}/${name}.csv`, { headers: HEADERS });
  if (!res.ok || !res.body) throw new Error(`NGA ${name}.csv: ${res.status}`);
  await mkdir(NGA_CACHE, { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(`${file}.part`));
  await rename(`${file}.part`, file);
  return file;
}

/**
 * Streams a CSV file (RFC 4180: quoted fields may hold commas, quotes and
 * newlines) and returns the rows `keep` accepts, as objects keyed by header.
 */
async function readCsv(file, keep) {
  const rows = [];
  let header;
  let row = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  const endRow = () => {
    row.push(field);
    field = "";
    if (!header) header = row;
    else {
      const obj = Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""]));
      if (keep(obj)) rows.push(obj);
    }
    row = [];
  };
  for await (const chunk of createReadStream(file, { encoding: "utf8" })) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (quoted) {
        if (c === '"') {
          quoted = false;
          afterQuote = true;
        } else field += c;
      } else if (c === '"') {
        // A quote straight after a closing quote is an escaped quote.
        if (afterQuote) field += '"';
        quoted = true;
        afterQuote = false;
      } else {
        afterQuote = false;
        if (c === ",") {
          row.push(field);
          field = "";
        } else if (c === "\n") endRow();
        else if (c !== "\r") field += c;
      }
    }
  }
  if (field || row.length) endRow();
  return rows;
}

/** Looks up every wanted NGA object in one pass over the open-data CSVs. */
async function loadNga(ids) {
  const want = new Set(ids.map(String));
  const objects = await readCsv(await ngaFile("objects"), (r) => want.has(r.objectid));
  const images = await readCsv(
    await ngaFile("published_images"),
    (r) => want.has(r.depictstmsobjectid) && r.viewtype === "primary",
  );
  const roles = await readCsv(
    await ngaFile("objects_constituents"),
    (r) => want.has(r.objectid) && r.roletype === "artist",
  );
  const people = new Set(roles.map((r) => r.constituentid));
  const constituents = await readCsv(await ngaFile("constituents"), (r) =>
    people.has(r.constituentid),
  );
  const deathOf = new Map(
    constituents.map((c) => [c.constituentid, Number(c.endyear) || undefined]),
  );
  const byId = new Map();
  for (const o of objects) {
    byId.set(o.objectid, {
      object: o,
      image: images.find((i) => i.depictstmsobjectid === o.objectid),
      died: roles.filter((r) => r.objectid === o.objectid).map((r) => deathOf.get(r.constituentid)),
    });
  }
  return byId;
}

function fromNga(id, nga) {
  const found = nga.get(String(id));
  if (!found) throw new Error("not in the NGA open data");
  const { object: o, image, died } = found;
  if (!image) throw new Error("no image");
  if (image.openaccess !== "1") throw new Error("not open access at the museum");
  return {
    title: o.title,
    artist: o.attribution || "Unknown artist",
    died,
    year: Number(o.beginyear) || lastYear(o.displaydate),
    dateLabel: o.displaydate,
    medium: capitalize(o.medium),
    imageUrl: `${image.iiifurl}/full/${WALL_WIDTH},/0/default.jpg`,
    zoomUrl: `${image.iiifurl}/full/!${ZOOM_EDGE},${ZOOM_EDGE}/0/default.jpg`,
    credit: {
      institution: "National Gallery of Art",
      line: o.creditline || undefined,
      url: `https://www.nga.gov/collection/art-object-page.${o.objectid}.html`,
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

/** The last download, kept so a Met original serves both the wall and the zoom copy. */
let lastDownload = { url: "", buf: Buffer.alloc(0) };

async function download(url) {
  if (lastDownload.url === url) return lastDownload.buf;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`image ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  lastDownload = { url, buf };
  return buf;
}

/** Shrinks an original to the wall image's width. */
const wallCopy = (buf) =>
  sharp(buf)
    .resize(WALL_WIDTH, undefined, { withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .toBuffer();

/**
 * The large copy for zooming in, re-encoded to keep the repository small.
 * Skipped (undefined) when the museum has nothing much bigger than the wall image.
 */
async function zoomCopy(key, url, base) {
  const file = path.join(ZOOM_DIR, `${key}.jpg`);
  let buf;
  if (existsSync(file) && !force) {
    buf = await readFile(file);
  } else {
    if (!url) return undefined;
    const big = await download(url);
    buf = await sharp(big)
      .resize(ZOOM_EDGE, ZOOM_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true, progressive: true })
      .toBuffer();
    const { width } = jpegSize(buf);
    if (width < base.width * 1.5) return undefined;
    await writeFile(file, buf);
  }
  const { width, height } = jpegSize(buf);
  return { src: `/art/zoom/${key}.jpg`, width, height };
}

async function main() {
  const source = await readFile(EXHIBITIONS, "utf8");
  const wanted = [
    ...new Map([...source.matchAll(PD_CALL)].map((m) => [`${m[1]}-${m[2]}`, m])).values(),
  ];
  console.log(`Found ${wanted.length} public-domain works in exhibitions.ts`);
  await mkdir(ZOOM_DIR, { recursive: true });

  const works = {};
  const failures = [];
  const ngaIds = wanted.filter(([, src]) => src === "nga").map(([, , id]) => id);
  const nga = ngaIds.length ? await loadNga(ngaIds) : new Map();
  const readers = { aic: fromAic, cma: fromCma, met: fromMet, nga: (id) => fromNga(id, nga) };
  for (const [, src, id] of wanted) {
    const key = `${src}-${id}`;
    try {
      const meta = await readers[src](id);
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
        buf = await download(meta.imageUrl);
        if (meta.resizeWall) buf = await wallCopy(buf);
        await writeFile(file, buf);
      }
      const { width, height } = jpegSize(buf);
      const zoom = await zoomCopy(key, meta.zoomUrl, { width, height }).catch((err) => {
        console.warn(`  ! ${key}  no zoom copy: ${err.message}`);
        return undefined;
      });

      works[key] = {
        title: clean(meta.title),
        artist: clean(meta.artist),
        year: meta.year,
        dateLabel: clean(meta.dateLabel),
        medium: clean(meta.medium) || "Unknown medium",
        source: { kind: "image", src: `/art/${key}.jpg`, width, height, ...(zoom && { zoom }) },
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
// add \`pd("aic" | "cma" | "met" | "nga", id)\` to src/content/exhibitions.ts and run \`pnpm art:fetch\`.
import type { Artwork } from "@/lib/museum/types";

export const collection: Record<string, Omit<Artwork, "id">> = ${JSON.stringify(sorted, null, 2)};
`;
  // Formatted like the rest of the repo, so a re-fetch only diffs what changed.
  const options = await prettier.resolveConfig(OUT_TS);
  await writeFile(OUT_TS, await prettier.format(ts, { ...options, filepath: OUT_TS }));
  console.log(`Wrote ${Object.keys(works).length} works to ${path.relative(ROOT, OUT_TS)}`);

  if (failures.length) {
    console.error(`\n${failures.length} work(s) refused or failed:\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }

  // Images of works no longer hung anywhere.
  for (const dir of [OUT_DIR, ZOOM_DIR]) {
    for (const name of await readdir(dir)) {
      if (ART_FILE.test(name) && !works[name.replace(/\.jpg$/, "")]) {
        await unlink(path.join(dir, name));
        console.log(`  - removed ${path.relative(ROOT, path.join(dir, name))}`);
      }
    }
  }
}

await main();
