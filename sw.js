const CACHE = 'cope-v29';
const ASSETS = ['./','./index.html','./manifest.json','./lead-capture.js','./logo-192.png','./logo-512.png','./splash-logo.png'];

const CHAT_CONTRAST = `<style id="cope-chat-contrast">
.bottom-nav .nav-btn[onclick*="talk"] { -webkit-appearance:none !important; appearance:none !important; background:rgba(184,159,216,0.10) !important; border:1px solid rgba(184,159,216,0.32) !important; color:#d4bff5 !important; box-shadow:0 0 14px rgba(184,159,216,0.10) !important; }
.bottom-nav .nav-btn[onclick*="talk"]:hover,.bottom-nav .nav-btn[onclick*="talk"]:focus,.bottom-nav .nav-btn[onclick*="talk"]:active,.bottom-nav .nav-btn[onclick*="talk"].active { background:rgba(184,159,216,0.18) !important; border-color:rgba(184,159,216,0.50) !important; color:#d4bff5 !important; }
.bottom-nav .nav-btn[onclick*="talk"] .nav-icon { color:#d4bff5 !important; filter:drop-shadow(0 0 6px rgba(184,159,216,0.55)) !important; }
.bottom-nav .nav-btn[onclick*="talk"] .nav-label { color:#c7b7df !important; }
</style>`;

const OPEN_WEEK_FIX = `<script id="cope-open-week-fix">
(function(){
  function isOpenWeek(){var now=new Date();return now>=new Date('2026-09-06T00:00:00-05:00')&&now<new Date('2026-09-14T00:00:00-05:00');}
  function apply(){
    if(!isOpenWeek())return;
    window.hasAccess=function(){return true;};
    window.openPaywall=function(){};
    document.querySelectorAll('.quick-card.locked').forEach(function(c){c.classList.remove('locked');});
    document.querySelectorAll('[onclick]').forEach(function(el){
      var click=el.getAttribute('onclick')||'';
      var m=click.match(/hasAccess\(\)\s*\?\s*goTo\((['\"])([^'\"]+)\1\)\s*:\s*openPaywall\(\)/);
      if(m)el.setAttribute('onclick','goTo(\''+m[2]+'\')');
    });
  }
  function start(){apply();setInterval(apply,250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
</script>`;

function enhanceHtml(response) {
  if (!response || !response.ok) return response;
  const type=response.headers.get('content-type')||'';
  if (!type.includes('text/html')) return response;
  return response.text().then(html=>{
    if(new Date()>=new Date('2026-09-06T00:00:00-05:00')&&new Date()<new Date('2026-09-14T00:00:00-05:00')){
      html=html.replace(/class="quick-card locked"/g,'class="quick-card"');
      html=html.replace(/onclick="hasAccess\(\)\s*\?\s*goTo\((['\"])([^'\"]+)\1\)\s*:\s*openPaywall\(\)"/g,'onclick="goTo(\'$2\')"');
      html=html.replace(/<head([^>]*)>/i,'<head$1><style id="cope-open-week-lock-css">.quick-card.locked::after{content:none!important}.quick-card.locked{opacity:1!important}</style>');
    }
    if(!html.includes('id="cope-chat-contrast"'))html=html.replace('</head',`${CHAT_CONTRAST}\n</head`);
    if(!html.includes('cope-open-week-fix'))html=html.replace('</body',`${OPEN_WEEK_FIX}\n</body`);
    if(!html.includes('lead-capture.js'))html=html.replace('</body','  <script src="./lead-capture.js?v=3" defer></script>\n</body');
    return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
  });
}

self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(async cache=>{for(const asset of ASSETS){try{const response=await fetch(asset,{cache:'no-store'});const enhanced=asset.endsWith('.html')||asset==='./'?await enhanceHtml(response):response;if(enhanced&&enhanced.ok)await cache.put(asset,enhanced.clone())}catch(_) {}}}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const url=e.request.url;if(url.includes('/api/')||url.includes('fonts.googleapis.com')||url.includes('square.link')||url.includes('youtube.com')||url.includes('img.youtube.com')){e.respondWith(fetch(e.request));return}if(e.request.mode==='navigate'||url.endsWith('/index.html')){e.respondWith(fetch(e.request,{cache:'no-store'}).then(response=>enhanceHtml(response).then(enhanced=>{const copy=enhanced.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return enhanced})).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')));return}e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))) });
