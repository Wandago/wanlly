// Map geometry shared by the browser (prediction, drawing, tap-to-move) and the server
// (validation, bots). Positions are in tile units; a tile's centre is (x + 0.5, y + 0.5).
//
// Tiles: "#" wall, " " outside, "." path, ":" door, A–Z a place's floor,
// a–z a clue spot in that place, 1–9 an errand spot.

export const SPEED = 4; // tiles per second
export const RADIUS = 0.3; // a walker's collision radius
export const REACH = 1.3; // how close you must be to search a spot or do an errand

export const isWalkTile = (ch) => ch !== undefined && ch !== "#" && ch !== " ";
export const tileAt = (rows, x, y) => rows[Math.floor(y)]?.[Math.floor(x)];

/** Can a walker stand here? Checks the four corners of its collision box. */
export function canStand(rows, x, y) {
  for (const [dx, dy] of [[-RADIUS, -RADIUS], [RADIUS, -RADIUS], [-RADIUS, RADIUS], [RADIUS, RADIUS]]) {
    if (!isWalkTile(tileAt(rows, x + dx, y + dy))) return false;
  }
  return true;
}

/** Moves by (dx, dy), sliding along walls. Returns the new position. */
export function slide(rows, x, y, dx, dy) {
  let nx = x, ny = y;
  if (canStand(rows, x + dx, y)) nx = x + dx;
  if (canStand(rows, nx, y + dy)) ny = y + dy;
  return [nx, ny];
}

/** Is the straight segment between two points free of walls? (Checked at quarter-tile steps.) */
export function clearLine(rows, x0, y0, x1, y1) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4));
  for (let i = 0; i <= steps; i++) {
    if (!canStand(rows, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps)) return false;
  }
  return true;
}

/** Breadth-first path over walkable tiles, as a list of tile centres (excluding the start). */
export function findPath(rows, fromX, fromY, toX, toY) {
  const sx = Math.floor(fromX), sy = Math.floor(fromY), tx = Math.floor(toX), ty = Math.floor(toY);
  if (!isWalkTile(tileAt(rows, tx, ty))) return null;
  const key = (x, y) => y * 1000 + x;
  const prev = new Map([[key(sx, sy), null]]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === tx && y === ty) {
      const out = [];
      for (let k = key(x, y); k !== key(sx, sy); k = prev.get(k)) out.unshift([(k % 1000) + 0.5, Math.floor(k / 1000) + 0.5]);
      return out;
    }
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (!prev.has(key(nx, ny)) && isWalkTile(tileAt(rows, nx, ny))) {
        prev.set(key(nx, ny), key(x, y));
        queue.push([nx, ny]);
      }
    }
  }
  return null;
}

/** Parses a scenario's map into places, clue spots, errands and spawn tiles. */
export function parseMap(map) {
  const rows = map.tiles;
  const placeOf = {};
  for (const [letter, id] of Object.entries(map.legend)) placeOf[letter] = id;
  const placeAtTile = (x, y) => {
    const ch = tileAt(rows, x, y);
    if (!ch) return null;
    if (/[A-Z]/.test(ch)) return placeOf[ch] ?? null;
    if (/[a-z]/.test(ch)) return placeOf[ch.toUpperCase()] ?? null;
    if (/[1-9]/.test(ch)) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const p = /[A-Z]/.test(tileAt(rows, x + dx, y + dy) ?? "") ? placeOf[tileAt(rows, x + dx, y + dy)] : null;
        if (p) return p;
      }
    }
    return null;
  };
  const spots = [];
  const errands = [];
  const floors = {};
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      const place = placeAtTile(x, y);
      if (place) (floors[place] ??= []).push([x, y]);
      if (/[a-z]/.test(ch)) spots.push({ place, x: x + 0.5, y: y + 0.5 });
      if (/[1-9]/.test(ch)) errands.push({ index: Number(ch) - 1, place, x: x + 0.5, y: y + 0.5 });
    }
  }
  errands.sort((a, b) => a.index - b.index);
  const labels = {};
  for (const [place, tiles] of Object.entries(floors)) {
    const cx = tiles.reduce((n, t) => n + t[0], 0) / tiles.length, cy = tiles.reduce((n, t) => n + t[1], 0) / tiles.length;
    labels[place] = { x: cx + 0.5, y: cy + 0.5 };
  }
  return { rows, width: Math.max(...rows.map((r) => r.length)), height: rows.length, placeAtTile, spots, errands, floors, labels };
}
