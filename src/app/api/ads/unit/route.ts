import { NETWORK_SIZES, sizeOf, type NetworkSize } from "@/lib/ad-network";
import { loadNetwork } from "@/lib/ad-network-server";

/**
 * One network banner as its own small page, loaded in an iframe by the ad slot. The sandbox
 * policy below gives it an opaque origin even if opened directly, so the network's script can't
 * read Wanlly's cookies or storage, and can't navigate the app; clicks open in a new tab.
 */
export async function GET(req: Request) {
  const size = new URL(req.url).searchParams.get("size") as NetworkSize | null;
  if (!size || !NETWORK_SIZES.includes(size)) return new Response(null, { status: 400 });
  const network = await loadNetwork();
  const code = network.audience === "off" ? undefined : network.units[size];
  if (!code) return new Response(null, { status: 404 });
  const { w, h } = sizeOf(size);
  const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${w}"><meta name="referrer" content="origin"><style>html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}</style></head><body>${code}</body></html>`;
  return new Response(page, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "content-security-policy": "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms",
      "x-content-type-options": "nosniff",
    },
  });
}
