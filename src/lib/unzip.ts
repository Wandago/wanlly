/*
 * A small zip reader for GitHub's repository downloads: the files are listed at the end of the
 * zip, and each is stored as-is or deflated, which DecompressionStream (built into Workers and
 * browsers) undoes. Only what a repository download uses is supported.
 */

export type ZipEntry = { path: string; size: number; read: () => Promise<Uint8Array> };

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The files in a zip (folders left out), each read only when asked. */
export function listZip(zip: Uint8Array): ZipEntry[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // The end-of-directory record sits in the last 64 KB (after an optional comment).
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Not a zip file");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const names = new TextDecoder();
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) break;
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const path = names.decode(zip.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
    if (path.endsWith("/")) continue;
    out.push({
      path,
      size,
      read: async () => {
        const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        const data = zip.subarray(start, start + compressed);
        if (method === 0) return data;
        if (method === 8) return inflate(data);
        throw new Error(`Unsupported zip compression (${method})`);
      },
    });
  }
  return out;
}
