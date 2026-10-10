/* Pictures for ads, made in the browser: sized, compressed to WebP under 200 KB, as data URLs. */

/**
 * A banner picture at exactly one size: the upload is scaled to cover it and centred (twice the
 * pixels when that stays small, so it's sharp on good screens), as WebP under 200 KB.
 */
export async function bannerFrom(file: File, size: string): Promise<string> {
  const [w, h] = size.split("x").map(Number);
  const bmp = await createImageBitmap(file);
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

/** Shrinks a picture to at most 800 px wide and under 200 KB, as a data URL. */
export async function pictureFrom(file: File): Promise<string> {
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

