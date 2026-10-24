/*
 * Pictures for ads, made in the browser: sized, compressed to WebP under 200 KB, as data URLs.
 * Animated GIFs are kept exactly as they are (resizing them in the browser would freeze them),
 * up to 1.2 MB, wherever their shape matches the space.
 */

/** The most an animated GIF may weigh. */
export const GIF_MAX_BYTES = 1_200_000;

const isGif = (file: File) => file.type === "image/gif";

function asDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** A GIF unchanged, if it's light enough. */
async function gifAsIs(file: File): Promise<string> {
  if (file.size > GIF_MAX_BYTES) throw new Error(`GIFs can be up to 1.2 MB; this one is ${(file.size / 1_000_000).toFixed(1)} MB. Fewer frames, fewer colours or a smaller size will bring it down.`);
  return asDataUrl(file);
}

/** Whether a picture has the same shape as a banner size (within 4%). */
export function sameShape(w: number, h: number, size: string) {
  const [bw, bh] = size.split("x").map(Number);
  return Math.abs(w / h - bw / bh) / (bw / bh) < 0.04;
}

/**
 * A banner picture at exactly one size: the upload is scaled to cover it and centred (twice the
 * pixels when that stays small, so it's sharp on good screens), as WebP under 200 KB. An animated
 * GIF in the banner's shape is kept as it is; one in another shape is refused when `strict`, or
 * else becomes a still of its first frame.
 */
export async function bannerFrom(file: File, size: string, strict = false): Promise<string> {
  const [w, h] = size.split("x").map(Number);
  const bmp = await createImageBitmap(file);
  if (isGif(file)) {
    if (sameShape(bmp.width, bmp.height, size)) return gifAsIs(file);
    if (strict) throw new Error(`This GIF is ${bmp.width}×${bmp.height}. The ${size} banner needs a GIF of the same shape: ${w}×${h}, or ${w * 2}×${h * 2} for sharp screens.`);
  }
  for (const scale of [2, 1]) {
    const c = document.createElement("canvas");
    c.width = w * scale;
    c.height = h * scale;
    const k = Math.max(c.width / bmp.width, c.height / bmp.height);
    const dw = bmp.width * k;
    const dh = bmp.height * k;
    c.getContext("2d")!.drawImage(bmp, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    for (const q of [0.88, 0.75, 0.6]) {
      const url = c.toDataURL("image/webp", q);
      if (url.length < 270_000) return url;
    }
  }
  throw new Error("That banner is too detailed. Try a simpler picture.");
}

/** Shrinks a picture to at most 800 px wide and under 200 KB, as a data URL. GIFs stay animated. */
export async function pictureFrom(file: File): Promise<string> {
  if (isGif(file)) return gifAsIs(file);
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 800 / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    const url = c.toDataURL("image/webp", q);
    if (url.length < 270_000) return url;
  }
  throw new Error("That picture is too detailed. Try a smaller one.");
}
