/*
 * Turns a generated design into a page that is safe to show. It always runs in an iframe with
 * sandbox="allow-scripts" and no same-origin access, so it can't read Wanlly's cookies or page.
 * On top of that, a content security policy stops it loading anything except Tailwind and
 * Google Fonts, sending data anywhere, or submitting forms.
 */

const CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src data: blob:",
  "script-src 'unsafe-inline' https://cdn.tailwindcss.com",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

/* Slides: stacked and scaled to fit, or one at a time in Present mode (arrows, click, Escape). */
const SLIDES = `<style>
html,body{margin:0!important;background:#16171b!important}
body{padding:24px 0!important}
.slide{position:relative!important;box-sizing:border-box!important;margin:0 auto 24px!important;box-shadow:0 8px 30px rgb(0 0 0/.35);border-radius:6px;overflow:hidden!important}
body.wanlly-present{padding:0!important;overflow:hidden!important;background:#000!important;height:100vh;display:flex!important;align-items:center;justify-content:center}
body.wanlly-present .slide{margin:0!important;border-radius:0;box-shadow:none}
body.wanlly-present .slide:not(.wanlly-on){display:none!important}
</style>
<script>
(function(){
  var present=false, i=0;
  function slides(){return Array.prototype.slice.call(document.querySelectorAll('.slide'))}
  function fit(){
    var s=slides(); if(!s.length) return;
    var z = present ? Math.min(innerWidth/1280, innerHeight/720) : Math.min(1,(innerWidth-48)/1280);
    s.forEach(function(el,n){el.style.width='1280px';el.style.height='720px';el.style.zoom=z;el.classList.toggle('wanlly-on',present&&n===i);});
  }
  function go(d){var n=slides().length; i=Math.max(0,Math.min(n-1,i+d)); fit(); parent.postMessage({wanlly:'slide',index:i,count:n},'*');}
  addEventListener('resize',fit); addEventListener('load',fit); fit();
  addEventListener('message',function(e){var m=e.data||{}; if(m.wanlly==='present'){present=!!m.on; i=m.index||0; document.body.classList.toggle('wanlly-present',present); fit(); go(0);} if(m.wanlly==='go') go(m.by);});
  addEventListener('keydown',function(e){ if(!present) return;
    if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown') go(1);
    if(e.key==='ArrowLeft'||e.key==='PageUp') go(-1);
    if(e.key==='Escape') parent.postMessage({wanlly:'exit'},'*');
  });
  addEventListener('click',function(){ if(present) go(1); });
  parent.postMessage({wanlly:'slide',index:0,count:slides().length},'*');
})();
</script>`;

/** The page to put in the iframe's srcdoc. Works on partial HTML too, for live previews. */
export function previewDoc(html: string, kind: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1">`;
  let doc = html;
  // The policy has to come before anything the model wrote, inside <head>, without breaking the doctype.
  if (/<head(\s[^>]*)?>/i.test(doc)) doc = doc.replace(/<head(\s[^>]*)?>/i, (m) => m + meta);
  else if (/<html(\s[^>]*)?>/i.test(doc)) doc = doc.replace(/<html(\s[^>]*)?>/i, (m) => `${m}<head>${meta}</head>`);
  else doc = `<!doctype html><html><head>${meta}</head><body>${doc}</body></html>`;
  if (kind === "slides") doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, `${SLIDES}</body>`) : doc + SLIDES;
  return doc;
}
