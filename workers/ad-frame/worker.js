/*
 * Wanlly ad frame: shows ad-network banners from their own address, separate from the app.
 *
 * Why: banners served by Wanlly itself run with no origin at all, and some networks' scripts
 * need storage to show an ad. Shown from here, a banner keeps this Worker's origin, a different
 * site from Wanlly, so it still can't read Wanlly's cookies, storage or pages.
 *
 * Wanlly puts the banner's code in the address after "#", so this Worker never has to call
 * Wanlly (Cloudflare doesn't let one workers.dev Worker fetch another on the same account).
 * The page only runs inside a frame on Wanlly; opened directly, or framed elsewhere, it does nothing.
 *
 * Set up (Cloudflare → Workers & Pages → Create → Worker): name it e.g. "wanlly-ads", paste this
 * file, Deploy. Then put its address in Admin → Ads → Setup → Banner host.
 */

// The Wanlly addresses allowed to show these banners. When you add a domain, add it here (keep
// the old one until everyone has moved), then Deploy.
const APPS = ["https://wanlly.africa", "https://www.wanlly.africa", "https://wanlly.louiswandago.workers.dev"];

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="origin">
<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style>
<script>
(function(){
  if (window.top === window) { document.write("<!--"); return; }
  addEventListener("error", function (e) {
    var t = e.target;
    parent.postMessage(t && t.tagName === "SCRIPT" ? { wanllyAd: "blocked", detail: String(t.src).slice(0, 120) } : { wanllyAd: "error", detail: String(e.message).slice(0, 200) }, "*");
  }, true);
})();
</script></head><body>
<script>
(function(){
  if (window.top === window) return;
  try {
    var b = location.hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
    document.write(decodeURIComponent(escape(atob(b))));
  } catch (e) { parent.postMessage({ wanllyAd: "error", detail: "Bad banner code" }, "*"); }
})();
</script>
<script>
(function(){
  if (window.top === window) return;
  var n = 0;
  function seen() {
    var ok = false;
    document.querySelectorAll("iframe,img,canvas,video,object,embed").forEach(function (e) { var r = e.getBoundingClientRect(); if (r.width >= 40 && r.height >= 20) ok = true; });
    return ok;
  }
  function check() {
    if (seen()) { parent.postMessage({ wanllyAd: "filled" }, "*"); return; }
    if (++n < 8) setTimeout(check, 1000); else parent.postMessage({ wanllyAd: "empty" }, "*");
  }
  setTimeout(check, 800);
})();
</script></body></html>`;

const worker = {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/frame") return new Response("Not found", { status: 404 });
    return new Response(PAGE, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=86400",
        "x-content-type-options": "nosniff",
        // Only Wanlly may show this page in a frame.
        "content-security-policy": `frame-ancestors ${APPS.join(" ")}`,
      },
    });
  },
};

export default worker;
