/*
 * The Wanlly Spin: a four-point spark with soft, rounded sides, cut into four blades by slits
 * that lean the same way, so it reads as turning. One geometry, used by the app (SpinMark), the
 * favicon and the brand files (scripts/brand.mjs), drawn in a 64×64 box around (32, 32).
 */

const R = 2.2; // side curvature: larger is rounder
const LEAN = 40; // degrees the slits lean off the diagonals
const HOLE = 0.17; // centre hole, as a share of the radius
const SLIT = 0.13; // slit width
const SOFT = 0.14; // rounding of the four tips

/** Mark geometry for a spark of radius `r` (tips r away from the centre) centred at (cx, cy). */
export function spinGeometry(r = 21, cx = 32, cy = 32) {
  const f = (v: number) => +v.toFixed(3);
  const rr = f(R * r);
  const star = `M${cx} ${f(cy - r)} A${rr} ${rr} 0 0 0 ${f(cx + r)} ${cy} A${rr} ${rr} 0 0 0 ${cx} ${f(cy + r)} A${rr} ${rr} 0 0 0 ${f(cx - r)} ${cy} A${rr} ${rr} 0 0 0 ${cx} ${f(cy - r)}Z`;
  const cuts = [0, 90, 180, 270].map((a) => {
    const d = ((45 + a) * Math.PI) / 180;
    const t = ((45 + a + LEAN) * Math.PI) / 180;
    const x0 = cx + HOLE * r * Math.cos(d);
    const y0 = cy + HOLE * r * Math.sin(d);
    return { x1: f(x0), y1: f(y0), x2: f(x0 + 1.3 * r * Math.cos(t)), y2: f(y0 + 1.3 * r * Math.sin(t)) };
  });
  return { star, cuts, hole: f(HOLE * r), slit: f(SLIT * r), soft: f(SOFT * r) };
}

/** The mark as SVG markup (no outer <svg>), for static files. `id` names its mask. */
export function spinMarkup({ id = "spin", color = "#ff5a1f", r = 21, cx = 32, cy = 32 } = {}) {
  const g = spinGeometry(r, cx, cy);
  const cuts = g.cuts.map((c) => `<line x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}" stroke="#000" stroke-width="${g.slit}" stroke-linecap="round"/>`).join("");
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="${cx - 2 * r}" y="${cy - 2 * r}" width="${4 * r}" height="${4 * r}"><rect x="${cx - 2 * r}" y="${cy - 2 * r}" width="${4 * r}" height="${4 * r}" fill="#fff"/>${cuts}<circle cx="${cx}" cy="${cy}" r="${g.hole}" fill="#000"/></mask></defs><path d="${g.star}" fill="${color}" stroke="${color}" stroke-width="${g.soft}" stroke-linejoin="round" mask="url(#${id})"/>`;
}
