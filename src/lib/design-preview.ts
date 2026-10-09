/*
 * Turns a generated design into a page that is safe to show. It always runs in an iframe with
 * sandbox="allow-scripts allow-modals" and no same-origin access, so it can't read Wanlly's
 * cookies or page. On top of that, a content security policy stops it loading anything except
 * Tailwind and Google Fonts, sending data anywhere, or submitting forms.
 *
 * A small runtime is added to every page. The editor talks to it with postMessage:
 *   present (slides), edit (type into the page), serialize (send the edited body back),
 *   print (PDF), pptx (measure every slide's shapes and text for PowerPoint).
 * Everything it adds is marked data-wanlly so it can be removed before saving.
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

const BASE_CSS = `html.wanlly-editing body *:hover{outline:1px dashed rgba(255,106,51,.7);outline-offset:2px}
html.wanlly-editing body *:focus{outline:2px solid #ff6a33}
html.wanlly-editing .wanlly-deco{pointer-events:none!important}
html.wanlly-editing body *{-webkit-user-select:text!important;user-select:text!important;cursor:text}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media print{html{zoom:1!important}}`;

/* Slides: the whole page is scaled so any layout fits; Present shows one slide at a time. */
const SLIDES_CSS = `html{overflow-x:hidden}
.slide{width:1280px!important;height:720px!important;box-sizing:border-box!important;overflow:hidden!important;flex-shrink:0!important}
html:not(.wanlly-present) body{background:#16171b}
html:not(.wanlly-present) .slide{margin:24px auto!important;box-shadow:0 8px 30px rgb(0 0 0/.35)}
html.wanlly-present,html.wanlly-present body{overflow:hidden!important;background:#000!important}
html.wanlly-present body{margin:0!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:0!important}
html.wanlly-present .slide{margin:0!important;box-shadow:none!important}
html.wanlly-present .slide:not(.wanlly-on){display:none!important}
@page{size:1280px 720px;margin:0}
@media print{body{margin:0!important;padding:0!important;gap:0!important;display:block!important;height:auto!important;background:none!important}
.slide{margin:0!important;box-shadow:none!important;break-after:page;page-break-after:always}}`;

const RUNTIME = (kind: string) => `(function(){
var KIND=${JSON.stringify(kind)}, present=false, i=0, root=document.documentElement;
function slides(){return Array.prototype.slice.call(document.querySelectorAll('.slide'))}
function send(m){parent.postMessage(m,'*')}
function fit(){
  if(KIND!=='slides') return;
  root.style.zoom='1'; document.body.style.height='';
  root.classList.toggle('wanlly-present',present);
  slides().forEach(function(el,n){el.classList.toggle('wanlly-on',present&&n===i)});
  if(present){var z=Math.min(innerWidth/1280,innerHeight/720); root.style.zoom=String(z); document.body.style.height=(innerHeight/z)+'px';}
  else{var w=Math.max(root.scrollWidth,1328); root.style.zoom=String(Math.min(1,innerWidth/w));}
}
function go(d){var n=slides().length; i=Math.max(0,Math.min(n-1,i+d)); fit(); send({wanlly:'slide',index:i,count:n});}
function rgba(s){var m=(s||'').match(/rgba?\\(([^)]+)\\)/); if(!m) return null; var p=m[1].split(/[ ,\\/]+/).filter(Boolean).map(parseFloat); var a=p.length>3?p[3]:1; if(a<0.04) return null;
  return {hex:p.slice(0,3).map(function(v){return Math.round(v).toString(16).padStart(2,'0')}).join(''),alpha:a};}
function inlineOnly(el){for(var c=el.firstElementChild;c;c=c.nextElementSibling){var d=getComputedStyle(c).display; if(d.indexOf('inline')!==0&&c.innerText.trim()) return false;} return true;}
function measure(){
  var was=present; present=false; fit(); root.style.zoom='1';
  var out=slides().map(function(s){
    var r0=s.getBoundingClientRect(), shapes=[], texts=[], bodyBg=rgba(getComputedStyle(document.body).backgroundColor);
    var sc=getComputedStyle(s), bg=rgba(sc.backgroundColor)||rgba(sc.backgroundImage)||bodyBg||{hex:'ffffff',alpha:1};
    Array.prototype.forEach.call(s.querySelectorAll('*'),function(el){
      var r=el.getBoundingClientRect(); if(r.width<2||r.height<2) return;
      var cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none'||parseFloat(cs.opacity)<0.05) return;
      var x=r.left-r0.left, y=r.top-r0.top;
      // Soft glows and full-slide backdrops don't translate to PowerPoint shapes; leave them out.
      var blurred=/blur[(]/.test(cs.filter);
      if(!blurred&&!(r.width>1270&&r.height>710)){
        var cx=Math.max(0,x), cy=Math.max(0,y), cw=Math.min(1280,x+r.width)-cx, ch=Math.min(720,y+r.height)-cy;
        if(cw>1&&ch>1){
          var fill=rgba(cs.backgroundColor)||rgba(cs.backgroundImage), rad=parseFloat(cs.borderTopLeftRadius)||0;
          var sides=['Top','Right','Bottom','Left'].map(function(k){var w=parseFloat(cs['border'+k+'Width'])||0; return {w:w,c:w?rgba(cs['border'+k+'Color']):null};});
          var same=sides.every(function(d){return d.w===sides[0].w&&(d.c&&d.c.hex)===(sides[0].c&&sides[0].c.hex)});
          var line=same&&sides[0].w?sides[0].c:null;
          if(fill||line) shapes.push({x:cx,y:cy,w:cw,h:ch,fill:fill,line:line,lw:same?sides[0].w:0,radius:rad,round:rad>=Math.min(cw,ch)/2-1});
          // One-sided borders (an accent on top, a divider line) become thin bars on that side.
          if(!same) sides.forEach(function(d,n){ if(!d.w||!d.c) return;
            var bar=n===0?{x:cx,y:cy,w:cw,h:d.w}:n===1?{x:cx+cw-d.w,y:cy,w:d.w,h:ch}:n===2?{x:cx,y:cy+ch-d.w,w:cw,h:d.w}:{x:cx,y:cy,w:d.w,h:ch};
            bar.fill=d.c; bar.line=null; bar.lw=0; bar.radius=0; shapes.push(bar); });
        }
      }
      var t=el.innerText; if(!t||!t.trim()||!inlineOnly(el)) return;
      if(cs.textTransform==='uppercase') t=t.toUpperCase();
      var c=rgba(cs.color)||{hex:'000000',alpha:1};
      texts.push({x:x,y:y,w:r.width,h:r.height,text:t.trim(),size:parseFloat(cs.fontSize),bold:parseInt(cs.fontWeight,10)>=600,italic:cs.fontStyle==='italic',color:c.hex,font:cs.fontFamily.split(',')[0].replace(/["']/g,'').trim(),align:cs.textAlign==='center'?'center':cs.textAlign==='right'||cs.textAlign==='end'?'right':'left'});
    });
    return {bg:bg.hex,shapes:shapes,texts:texts};
  });
  present=was; fit(); return out;
}
function clean(){
  var b=document.body.cloneNode(true);
  Array.prototype.forEach.call(b.querySelectorAll('[data-wanlly]'),function(n){n.remove()});
  Array.prototype.forEach.call(b.querySelectorAll('.wanlly-on'),function(n){n.classList.remove('wanlly-on')});
  Array.prototype.forEach.call(b.querySelectorAll('[contenteditable]'),function(n){n.removeAttribute('contenteditable')});
  Array.prototype.forEach.call(b.querySelectorAll('.wanlly-deco'),function(n){n.classList.remove('wanlly-deco'); if(!n.className) n.removeAttribute('class')});
  return b.innerHTML;
}
// Decorations with no text (glows, overlays, background shapes) often sit on top of the words.
// While editing they let clicks through, so any visible text can be clicked and changed.
// One pass over the page (fast even for big decks): every element that holds text or media,
// and its ancestors, is kept clickable; the rest are decorations.
function decorations(on){
  var all=document.body.getElementsByTagName('*'), i;
  if(!on){ for(i=0;i<all.length;i++){ var e=all[i]; if(e.classList&&e.classList.contains('wanlly-deco')){ e.classList.remove('wanlly-deco'); if(!e.getAttribute('class')) e.removeAttribute('class'); } } return; }
  var keep=new Set();
  function up(p){ while(p&&p!==document.body&&!keep.has(p)){ keep.add(p); p=p.parentElement; } }
  var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT), n;
  while((n=w.nextNode())) if(n.nodeValue.trim()) up(n.parentElement);
  var media=document.body.querySelectorAll('img,svg,video,canvas,input,textarea,select,button,a');
  for(i=0;i<media.length;i++) up(media[i]);
  for(i=0;i<all.length;i++){ var el=all[i]; if(!keep.has(el)&&el.classList&&!el.hasAttribute('data-wanlly')&&!(el.closest&&el.closest('svg'))) el.classList.add('wanlly-deco'); }
}
var editing=false;
function edit(on){
  var problem='';
  try{ editing=on; present=false; fit(); }catch(err){ problem=String(err); }
  try{ decorations(on); }catch(err){ problem=problem||String(err); }
  try{ document.designMode=on?'on':'off'; root.classList.toggle('wanlly-editing',on); }catch(err){ problem=problem||String(err); }
  // Always answer, so the editor never waits forever.
  send({wanlly:'editing',on:on,problem:problem});
}
// While editing, the page's own scripts (slide navigation, click handlers) don't see keys or clicks,
// so typing a space or clicking a heading changes the text instead of moving to another slide.
['keydown','keyup','keypress','click','mousedown','mouseup','pointerdown','pointerup','touchstart','wheel'].forEach(function(t){
  addEventListener(t,function(e){ if(editing) e.stopImmediatePropagation(); },true);
});
addEventListener('resize',fit); addEventListener('load',fit); fit();
addEventListener('message',function(e){var m=e.data||{};
  if(m.wanlly==='present'){present=!!m.on; i=m.index||0; fit(); go(0);}
  if(m.wanlly==='go') go(m.by);
  if(m.wanlly==='edit') edit(!!m.on);
  if(m.wanlly==='serialize') send({wanlly:'html',body:clean()});
  if(m.wanlly==='print'){present=false; fit(); setTimeout(function(){print()},300);}
  if(m.wanlly==='pptx'){ try{ send({wanlly:'pptx',slides:measure()}); }catch(err){ send({wanlly:'pptx',error:String(err)}); } }
});
addEventListener('keydown',function(e){ if(!present) return;
  if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown') go(1);
  if(e.key==='ArrowLeft'||e.key==='PageUp') go(-1);
  if(e.key==='Escape') send({wanlly:'exit'});
});
addEventListener('click',function(){ if(present) go(1); });
send({wanlly:'slide',index:0,count:slides().length});
})();`;

/** The page to put in the iframe's srcdoc. Works on partial HTML too, for live previews. */
export function previewDoc(html: string, kind: string): string {
  const head = `<meta data-wanlly http-equiv="Content-Security-Policy" content="${CSP}"><meta data-wanlly name="viewport" content="width=device-width,initial-scale=1"><style data-wanlly>${BASE_CSS}${kind === "slides" ? SLIDES_CSS : ""}</style>`;
  const tail = `<script data-wanlly>${RUNTIME(kind)}</script>`;
  // Wanlly's policy is the only one: a policy the model wrote could block the editor's runtime.
  let doc = html.replace(/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, "");
  // The policy has to come before anything the model wrote, inside <head>, without breaking the doctype.
  if (/<head(\s[^>]*)?>/i.test(doc)) doc = doc.replace(/<head(\s[^>]*)?>/i, (m) => m + head);
  else if (/<html(\s[^>]*)?>/i.test(doc)) doc = doc.replace(/<html(\s[^>]*)?>/i, (m) => `${m}<head>${head}</head>`);
  else doc = `<!doctype html><html><head>${head}</head><body>${doc}</body></html>`;
  return /<\/body>/i.test(doc) ? doc.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${tail}</body>`) : doc + tail;
}

/** Puts an edited body back into the original page, keeping its <head> exactly as it was. */
export function withBody(original: string, body: string): string {
  const open = original.match(/<body(\s[^>]*)?>/i);
  const close = original.toLowerCase().lastIndexOf("</body>");
  if (!open || open.index === undefined || close < 0) return original;
  return original.slice(0, open.index + open[0].length) + body + original.slice(close);
}
