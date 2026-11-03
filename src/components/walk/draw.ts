import { seedFrom, seededRandom } from "@/lib/museum/placeholder";
import type { PlaceholderPattern } from "@/lib/museum/types";
import {
  FRAME_W,
  ROW,
  TILE,
  Tile,
  type FloorPlan,
  type PlanArtwork,
  type PlanRoom,
  lenticularPosition,
  tileAt,
} from "@/lib/walk/floor-plan";

/** Canvas renderer for a walkable floor: tiles, art on the walls, and the visitor. */

const C = {
  void: "#1b1a20",
  wallTop: "#2b2a33",
  wallEdge: "#3a3946",
  face: "#f4f0e8",
  faceShade: "#e4ddd0",
  baseboard: "#bfb5a2",
  wood: "#dcc7a6",
  woodLine: "#cdb592",
  stone: "#d3cec6",
  stoneAlt: "#cac4bb",
  frame: "#2a2118",
  label: "#f4f0e8",
  labelMuted: "#a9a6b6",
  accent: "#ff2e63",
  steel: "#a9b0b8",
  steelDark: "#7d858e",
  shadow: "rgba(0,0,0,0.18)",
};

export type Camera = { x: number; y: number; zoom: number; dpr: number; w: number; h: number };

export type Visitor = {
  /** Position in tiles (fractional while walking). */
  x: number;
  y: number;
  dir: "up" | "down" | "left" | "right";
  moving: boolean;
};

export type SceneState = {
  visitor: Visitor;
  time: number;
  focusId: string | null;
  hoverId: string | null;
  images: Map<string, HTMLImageElement>;
  font: string;
};

export function drawScene(
  ctx: CanvasRenderingContext2D,
  plan: FloorPlan,
  cam: Camera,
  s: SceneState,
) {
  const k = cam.dpr * cam.zoom;
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, cam.w, cam.h);
  ctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);

  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const x1 = Math.min(plan.cols - 1, Math.ceil((cam.x + cam.w / cam.zoom) / TILE) + 1);

  for (let y = 0; y < plan.rows; y++) {
    for (let x = x0; x <= x1; x++) drawTile(ctx, plan, x, y);
  }

  for (const room of plan.rooms) {
    if (room.x + room.w < x0 || room.x > x1) continue;
    drawRug(ctx, room);
    drawRoomLabel(ctx, room, s.font);
    drawPedestal(ctx, room.pedestal.x, room.pedestal.y, s.focusId === `room:${room.slug}`);
    for (const ex of room.emptySlots) drawEmptySlot(ctx, ex);
  }

  drawElevator(ctx, plan, s.font, s.focusId === "elevator");
  if (plan.lounge.x + plan.lounge.w >= x0 && plan.lounge.x <= x1) drawLounge(ctx, plan, s.font);

  for (const art of plan.artworks) {
    if (art.x + FRAME_W < x0 || art.x > x1) continue;
    const room = plan.rooms[art.room];
    const lit = s.focusId === art.id || s.hoverId === art.id;
    if (art.frames) {
      const imgs = art.frames.map((_, f) => s.images.get(frameKey(art.id, f)));
      drawLenticular(ctx, art, imgs, lenticularPosition(art, art.frames.length, s.visitor.x), lit);
    } else {
      drawArtwork(ctx, art, room, s.images.get(art.id), lit);
    }
  }

  drawVisitor(ctx, s.visitor, s.time, s.font);
}

function drawTile(ctx: CanvasRenderingContext2D, plan: FloorPlan, x: number, y: number) {
  const t = tileAt(plan, x, y);
  const px = x * TILE;
  const py = y * TILE;
  switch (t) {
    case Tile.Face: {
      ctx.fillStyle = C.face;
      ctx.fillRect(px, py, TILE, TILE);
      if (y === ROW.faceBottom) {
        ctx.fillStyle = C.faceShade;
        ctx.fillRect(px, py + TILE - 10, TILE, 6);
        ctx.fillStyle = C.baseboard;
        ctx.fillRect(px, py + TILE - 4, TILE, 4);
      }
      return;
    }
    case Tile.Floor:
    case Tile.Pedestal:
    case Tile.Bench:
    case Tile.Door: {
      ctx.fillStyle = C.wood;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = C.woodLine;
      ctx.fillRect(px, py + (x % 2 ? 10 : 26), TILE, 1);
      ctx.fillRect(px + ((x * 7 + y * 13) % TILE), py, 1, TILE);
      if (t === Tile.Bench) drawBench(ctx, plan, x, y);
      return;
    }
    case Tile.Corridor:
    case Tile.Plant: {
      // Plants in the lounge stand on wood; in the corridor, on stone.
      if (t === Tile.Plant && y <= ROW.roomWall) {
        ctx.fillStyle = C.wood;
      } else {
        ctx.fillStyle = (x + y) % 2 ? C.stone : C.stoneAlt;
      }
      ctx.fillRect(px, py, TILE, TILE);
      if (t === Tile.Plant) drawPlant(ctx, px, py);
      return;
    }
    case Tile.Wall: {
      ctx.fillStyle = C.wallTop;
      ctx.fillRect(px, py, TILE, TILE);
      // A lit edge where a wall meets walkable floor below it.
      const below = tileAt(plan, x, y + 1);
      if (below !== Tile.Wall && below !== Tile.Face && below !== Tile.Void) {
        ctx.fillStyle = C.wallEdge;
        ctx.fillRect(px, py + TILE - 6, TILE, 6);
      }
      return;
    }
    default:
      return;
  }
}

function drawRug(ctx: CanvasRenderingContext2D, room: PlanRoom) {
  const p = room.movement.palette;
  const x = (room.x + 2) * TILE;
  const y = (ROW.roomTop + 2) * TILE + 8;
  const w = (room.w - 4) * TILE;
  const h = 3 * TILE - 16;
  ctx.save();
  ctx.globalAlpha = 0.28;
  const band = w / p.length;
  p.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + i * band, y, Math.ceil(band), h);
  });
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = p[0];
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  ctx.restore();
}

function drawRoomLabel(ctx: CanvasRenderingContext2D, room: PlanRoom, font: string) {
  const x = (room.doorX + 2) * TILE + 10;
  const maxW = (room.x + room.w - room.doorX - 2) * TILE - 20;
  const y = ROW.roomWall * TILE;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, maxW, TILE);
  ctx.clip();
  ctx.textBaseline = "middle";
  ctx.font = `700 9px ${font}`;
  ctx.fillStyle = C.labelMuted;
  const kicker = room.movement.name.toUpperCase();
  ctx.fillText(kicker, x, y + 11);
  ctx.font = `700 12px ${font}`;
  ctx.fillStyle = C.label;
  ctx.fillText(room.title, x, y + 23);
  ctx.restore();
}

function drawPedestal(ctx: CanvasRenderingContext2D, x: number, y: number, focused: boolean) {
  const px = x * TILE;
  const py = y * TILE;
  ctx.fillStyle = C.shadow;
  ctx.beginPath();
  ctx.ellipse(px + 16, py + 27, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3b3a44";
  ctx.fillRect(px + 12, py + 12, 8, 15);
  ctx.fillStyle = focused ? C.accent : "#4a4956";
  ctx.fillRect(px + 5, py + 4, 22, 11);
  ctx.fillStyle = "#f4f0e8";
  for (let i = 0; i < 3; i++) ctx.fillRect(px + 8, py + 6.5 + i * 2.5, 16 - i * 4, 1);
}

function drawBench(ctx: CanvasRenderingContext2D, plan: FloorPlan, x: number, y: number) {
  const left = tileAt(plan, x - 1, y) !== Tile.Bench;
  const px = x * TILE;
  const py = y * TILE;
  ctx.fillStyle = C.shadow;
  ctx.fillRect(px + (left ? 4 : 0), py + 24, TILE - 4, 4);
  ctx.fillStyle = "#7a5a3c";
  ctx.fillRect(px + (left ? 4 : 0), py + 10, left ? TILE - 4 : TILE - 4, 12);
  ctx.fillStyle = "#8f6d4c";
  ctx.fillRect(px + (left ? 4 : 0), py + 10, left ? TILE - 4 : TILE - 4, 4);
}

function drawPlant(ctx: CanvasRenderingContext2D, px: number, py: number) {
  ctx.fillStyle = C.shadow;
  ctx.beginPath();
  ctx.ellipse(px + 16, py + 28, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b5643c";
  ctx.fillRect(px + 9, py + 17, 14, 11);
  ctx.fillStyle = "#4f8a4b";
  for (const [dx, dy, r] of [
    [16, 9, 8],
    [10, 13, 6],
    [22, 13, 6],
    [16, 3, 5],
  ]) {
    ctx.beginPath();
    ctx.arc(px + dx, py + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawElevator(
  ctx: CanvasRenderingContext2D,
  plan: FloorPlan,
  font: string,
  focused: boolean,
) {
  const x = plan.elevator.x * TILE + 6;
  const w = plan.elevator.w * TILE - 12;
  const top = ROW.faceTop * TILE + 22;
  const h = (ROW.faceBottom + 1) * TILE - 4 - top;
  ctx.fillStyle = C.steelDark;
  ctx.fillRect(x - 4, top - 4, w + 8, h + 4);
  ctx.fillStyle = C.steel;
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = C.steelDark;
  ctx.fillRect(x + w / 2 - 1, top, 2, h);
  // Floor indicator
  ctx.fillStyle = "#111";
  ctx.fillRect(x + w / 2 - 14, top - 18, 28, 12);
  ctx.fillStyle = focused ? C.accent : "#f59e0b";
  ctx.font = `700 9px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(plan.floor.level), x + w / 2, top - 12);
  // Call button
  const bx = (plan.elevator.x + plan.elevator.w) * TILE + 6;
  ctx.fillStyle = "#4a4956";
  ctx.fillRect(bx, top + 30, 8, 14);
  ctx.fillStyle = focused ? C.accent : "#f4f0e8";
  ctx.beginPath();
  ctx.arc(bx + 4, top + 37, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Floor plaque
  ctx.fillStyle = C.wallTop;
  ctx.fillRect(bx + 18, top + 4, 34, 26);
  ctx.fillStyle = C.label;
  ctx.font = `800 15px ${font}`;
  ctx.fillText(String(plan.floor.level), bx + 35, top + 15);
  ctx.font = `600 6px ${font}`;
  ctx.fillText("FLOOR", bx + 35, top + 26);
  ctx.textAlign = "left";
}

function drawEmptySlot(ctx: CanvasRenderingContext2D, x: number) {
  const px = x * TILE + 10;
  const py = ROW.faceTop * TILE + 14;
  const w = FRAME_W * TILE - 20;
  const h = 64;
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "#b9b1a0";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px, py, w, h);
  ctx.restore();
  ctx.fillStyle = "#b9b1a0";
  ctx.fillRect(px + w / 2 - 6, py + h / 2 - 1, 12, 2);
  ctx.fillRect(px + w / 2 - 1, py + h / 2 - 6, 2, 12);
}

/** Image-cache key for one view of a lenticular piece. */
export const frameKey = (id: string, frame: number) => `${id}#${frame}`;

/** Where a painting's frame sits on the wall face, fitted to its aspect ratio. */
function frameBox(art: PlanArtwork) {
  const boxW = FRAME_W * TILE - 12;
  const boxH = (ROW.faceBottom - ROW.faceTop + 1) * TILE - 24;
  const aspect = art.image ? art.image.width / art.image.height : 1;
  const scale = Math.min(boxW / aspect, boxH);
  const w = Math.round(scale * aspect);
  const h = Math.round(scale);
  const cx = art.x * TILE + (FRAME_W * TILE) / 2;
  return {
    x: Math.round(cx - w / 2),
    y: Math.round(ROW.faceTop * TILE + 8 + (boxH - h) / 2),
    w,
    h,
  };
}

function drawFrameAndHighlight(
  ctx: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
  phase: "frame" | "highlight",
) {
  const border = 4;
  if (phase === "frame") {
    ctx.fillStyle = C.shadow;
    ctx.fillRect(b.x - border + 3, b.y - border + 4, b.w + border * 2, b.h + border * 2);
    ctx.fillStyle = C.frame;
    ctx.fillRect(b.x - border, b.y - border, b.w + border * 2, b.h + border * 2);
    return;
  }
  ctx.save();
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 2;
  ctx.shadowColor = C.accent;
  ctx.shadowBlur = 8;
  ctx.strokeRect(b.x - border - 3, b.y - border - 3, b.w + border * 2 + 6, b.h + border * 2 + 6);
  ctx.restore();
}

/**
 * An Agamograph: thin vertical strips where the next view slides in as the
 * visitor walks past, like the folds of a real lenticular print.
 */
function drawLenticular(
  ctx: CanvasRenderingContext2D,
  art: PlanArtwork,
  imgs: (HTMLImageElement | undefined)[],
  position: number,
  highlighted: boolean,
) {
  const b = frameBox(art);
  drawFrameAndHighlight(ctx, b, "frame");
  const ready = (img?: HTMLImageElement) => img && img.complete && img.naturalWidth > 0;
  const base = Math.min(imgs.length - 1, Math.floor(position));
  const frac = position - base;
  const a = imgs[base];
  const next = imgs[base + 1];
  if (ready(a)) ctx.drawImage(a!, b.x, b.y, b.w, b.h);
  else {
    ctx.fillStyle = C.faceShade;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  const strips = 12;
  if (ready(next) && frac > 0) {
    const sw = next!.naturalWidth / strips;
    const dw = b.w / strips;
    for (let i = 0; i < strips; i++) {
      ctx.drawImage(
        next!,
        i * sw,
        0,
        sw * frac,
        next!.naturalHeight,
        b.x + i * dw,
        b.y,
        dw * frac,
        b.h,
      );
    }
  }
  // Fold lines
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  for (let i = 1; i < strips; i++) ctx.fillRect(b.x + (i * b.w) / strips, b.y, 0.6, b.h);
  if (highlighted) drawFrameAndHighlight(ctx, b, "highlight");
}

function drawLounge(ctx: CanvasRenderingContext2D, plan: FloorPlan, font: string) {
  const top = ROW.faceTop * TILE + 10;
  const h = (ROW.faceBottom - ROW.faceTop + 1) * TILE - 26;
  const panes = Math.max(1, Math.floor((plan.lounge.w - 1) / 3));
  const paneW = ((plan.lounge.w - 1) * TILE) / panes;
  for (let i = 0; i < panes; i++) {
    const x = plan.lounge.x * TILE + TILE / 2 + i * paneW + 4;
    const w = paneW - 8;
    const sky = ctx.createLinearGradient(0, top, 0, top + h);
    sky.addColorStop(0, "#7fb2e5");
    sky.addColorStop(1, "#d9ecf7");
    ctx.fillStyle = "#5c5a66";
    ctx.fillRect(x - 3, top - 3, w + 6, h + 6);
    ctx.fillStyle = sky;
    ctx.fillRect(x, top, w, h);
    // City skyline
    ctx.fillStyle = "#8a9bb0";
    let bx = x;
    let k = i * 7 + plan.floor.level;
    while (bx < x + w) {
      k = (k * 37 + 11) % 97;
      const bw = Math.min(8 + (k % 10), x + w - bx);
      const bh = 12 + ((k * 3) % 30) - plan.floor.level * 1.5;
      ctx.fillRect(bx, top + h - bh, bw, bh);
      bx += bw + 1;
    }
    ctx.fillStyle = "#5c5a66";
    ctx.fillRect(x + w / 2 - 1, top, 2, h);
  }
  ctx.fillStyle = C.labelMuted;
  ctx.font = `700 9px ${font}`;
  ctx.textBaseline = "middle";
  ctx.fillText("LOUNGE", plan.lounge.x * TILE + 12, (ROW.roomWall + 1) * TILE - 8);
}

function drawArtwork(
  ctx: CanvasRenderingContext2D,
  art: PlanArtwork,
  room: PlanRoom,
  img: HTMLImageElement | undefined,
  highlighted: boolean,
) {
  const box = frameBox(art);
  const { x, y, w, h } = box;
  drawFrameAndHighlight(ctx, box, "frame");

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, w, h);
  } else if (art.image) {
    ctx.fillStyle = C.faceShade;
    ctx.fillRect(x, y, w, h);
  } else {
    drawPlaceholder(
      ctx,
      room.movement.pattern,
      room.movement.palette,
      seedFrom(art.id),
      x,
      y,
      w,
      h,
    );
  }

  if (highlighted) drawFrameAndHighlight(ctx, box, "highlight");
}

/** Canvas twin of the SVG placeholders in `artwork-frame.tsx`. */
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  pattern: PlaceholderPattern,
  palette: string[],
  s: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const pick = (n: number) => palette[(s + n) % palette.length];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  switch (pattern) {
    case "stripes": {
      const count = 10 + (s % 8);
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = i % 2 ? pick(0) : pick(1);
        ctx.fillRect(x + (i * w) / count, y, w / count + 1, h);
      }
      ctx.fillStyle = pick(2);
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * (0.22 + (s % 12) / 100), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "grid": {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = pick(i);
        ctx.fillRect(x + (i % 2) * (w / 2), y + Math.floor(i / 2) * (h / 2), w / 2 + 1, h / 2 + 1);
      }
      break;
    }
    case "field": {
      ctx.fillStyle = pick(0);
      ctx.fillRect(x, y, w, h);
      const bands = 2 + (s % 2);
      for (let i = 0; i < bands; i++) {
        ctx.fillStyle = pick(i + 1);
        const bh = (h - 8) / bands - 4;
        ctx.fillRect(x + 5, y + 6 + i * (bh + 4), w - 10, bh);
      }
      break;
    }
    case "gesture": {
      ctx.fillStyle = palette[palette.length - 1];
      ctx.fillRect(x, y, w, h);
      const rand = seededRandom(s);
      ctx.lineCap = "round";
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = pick(i);
        ctx.lineWidth = 2 + rand() * 4;
        ctx.beginPath();
        ctx.moveTo(x + rand() * w, y + rand() * h);
        ctx.bezierCurveTo(
          x + rand() * w,
          y + rand() * h,
          x + rand() * w,
          y + rand() * h,
          x + rand() * w,
          y + rand() * h,
        );
        ctx.stroke();
      }
      break;
    }
    default: {
      // ben-day
      ctx.fillStyle = pick(1);
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = pick(0);
      for (let dy = 3; dy < h; dy += 5) {
        for (let dx = 3; dx < w; dx += 5) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = pick(2);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + w * (0.35 + (s % 30) / 100), y + h * 0.45, Math.min(w, h) * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawVisitor(ctx: CanvasRenderingContext2D, v: Visitor, time: number, font: string) {
  const cx = v.x * TILE + TILE / 2;
  const base = v.y * TILE + TILE - 4;
  const bob = v.moving ? Math.abs(Math.sin(time * 14)) * 2 : 0;

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(cx, base, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.fillStyle = "#2b2a33";
  const step = v.moving ? Math.sin(time * 14) * 2 : 0;
  ctx.fillRect(cx - 5, base - 8 + step * 0.3, 4, 7);
  ctx.fillRect(cx + 1, base - 8 - step * 0.3, 4, 7);

  // Body
  const top = base - 22 - bob;
  ctx.fillStyle = C.accent;
  roundRect(ctx, cx - 8, top + 6, 16, 12, 5);
  ctx.fill();

  // Head
  ctx.fillStyle = "#f1c9a5";
  ctx.beginPath();
  ctx.arc(cx, top, 8, 0, Math.PI * 2);
  ctx.fill();
  // Hair
  ctx.fillStyle = "#3a2a20";
  ctx.beginPath();
  if (v.dir === "up") ctx.arc(cx, top, 8.2, 0, Math.PI * 2);
  else ctx.arc(cx, top - 1, 8.2, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  // Eyes
  if (v.dir !== "up") {
    ctx.fillStyle = "#1b1a20";
    const ex = v.dir === "left" ? -3 : v.dir === "right" ? 3 : 0;
    if (v.dir === "down") {
      ctx.fillRect(cx - 3.5, top + 1, 2, 2.5);
      ctx.fillRect(cx + 1.5, top + 1, 2, 2.5);
    } else {
      ctx.fillRect(cx + ex - 1, top + 1, 2, 2.5);
    }
  }

  // Name tag
  ctx.font = `700 8px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText("You").width + 8;
  ctx.fillStyle = "rgba(17,17,17,0.75)";
  roundRect(ctx, cx - tw / 2, top - 22, tw, 11, 5);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText("You", cx, top - 16.5);
  ctx.textAlign = "left";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
