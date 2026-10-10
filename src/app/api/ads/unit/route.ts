import { NETWORK_SIZES, sizeOf, type NetworkSize } from "@/lib/ad-network";
import { loadNetworks } from "@/lib/ad-network-server";

/**
 * One network banner as its own small page, loaded in an iframe by the ad slot. The sandbox
 * policy below gives it an opaque origin even if opened directly, so the network's script can't
 * read Wanlly's cookies or storage, and can't navigate the app; clicks open in a new tab.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const size = params.get("size") as NetworkSize | null;
  if (!size || !NETWORK_SIZES.includes(size)) return new Response(null, { status: 400 });
  // Which network's banner: the one named, or the first that has this size.
  const { list } = await loadNetworks();
  const network = list.find((n) => n.name === params.get("net") && n.units[size]) ?? list.find((n) => n.audience !== "off" && n.units[size]);
  const code = !network || network.audience === "off" ? undefined : network.units[size];
  if (!code) return new Response(null, { status: 404 });
  const { w, h } = sizeOf(size);
  // After the network's code, a check tells the slot whether an ad actually appeared, so an
  // empty answer (no ad to show, or a site still in review) can hand the slot back to sponsors.
  // Problems are reported too, so the team can see them in Admin: a network script that didn't
  // load (often an ad blocker) or that failed to run.
  const watch = `<script>addEventListener("error",function(e){var t=e.target;parent.postMessage(t&&t.tagName==="SCRIPT"?{wanllyAd:"blocked",detail:String(t.src).slice(0,120)}:{wanllyAd:"error",detail:String(e.message).slice(0,200)},"*")},true)</script>`;
  const report = `<script>(function(){var n=0;function seen(){var ok=false;document.querySelectorAll("iframe,img,canvas,video,object,embed").forEach(function(e){var r=e.getBoundingClientRect();if(r.width>=40&&r.height>=20)ok=true});return ok}function check(){if(seen()){parent.postMessage({wanllyAd:"filled"},"*");return}if(++n<8)setTimeout(check,1000);else parent.postMessage({wanllyAd:"empty"},"*")}setTimeout(check,800)})()</script>`;
  const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${w}"><meta name="referrer" content="origin"><meta name="color-scheme" content="light dark"><style>html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}</style>${watch}</head><body>${code}${report}</body></html>`;
  return new Response(page, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "content-security-policy": "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms",
      "x-content-type-options": "nosniff",
    },
  });
}
