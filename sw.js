const CACHE = 'cope-v32';
const ASSETS = ['./','./index.html','./manifest.json','./lead-capture.js','./access-gate.js','./logo-192.png','./logo-512.png','./splash-logo.png'];

const CHAT_CONTRAST = `<style id="cope-chat-contrast">
.bottom-nav .nav-btn[onclick*="talk"] { -webkit-appearance:none !important; appearance:none !important; background:rgba(184,159,216,0.10) !important; border:1px solid rgba(184,159,216,0.32) !important; color:#d4bff5 !important; box-shadow:0 0 14px rgba(184,159,216,0.10) !important; }
.bottom-nav .nav-btn[onclick*="talk"]:hover,.bottom-nav .nav-btn[onclick*="talk"]:focus,.bottom-nav .nav-btn[onclick*="talk"]:active,.bottom-nav .nav-btn[onclick*="talk"].active { background:rgba(184,159,216,0.18) !important; border-color:rgba(184,159,216,0.50) !important; color:#d4bff5 !important; }
.bottom-nav .nav-btn[onclick*="talk"] .nav-icon { color:#d4bff5 !important; filter:drop-shadow(0 0 6px rgba(184,159,216,0.55)) !important; }
.bottom-nav .nav-btn[onclick*="talk"] .nav-label { color:#c7b7df !important; }
#screen-talk, #screen-talk .screen-content { color:#c8c8e0 !important; background:#08080f !important; }
#screen-talk input#chatInput { background:rgba(184,159,216,0.08) !important; color:#f0eeff !important; caret-color:#d4bff5 !important; }
#screen-talk input#chatInput::placeholder { color:#7a6a9a !important; }
#screen-talk button#sendBtn { color:#d4bff5 !important; background:rgba(184,159,216,0.30) !important; border-color:rgba(184,159,216,0.40) !important; }
</style>`;

function enhanceHtml(response) {
  if (!response || !response.ok) return response;
  const type=response.headers.get('content-type')||'';
  if (!type.includes('text/html')) return response;
  return response.text().then(html=>{
    html=html.replace(/<script id="cope-open-week-fix">[\s\S]*?<\/script>/g,'');
    html=html.replace(/<style id="cope-open-week-lock-css">[\s\S]*?<\/style>/g,'');
    html=html.replace(/<script[^>]+src=["'][^"']*labor-day-promo\.js[^"']*["'][^>]*><\/script>/gi,'');
    if(!html.includes('id="cope-chat-contrast"'))html=html.replace('</head',`${CHAT_CONTRAST}\n</head`);
    if(!html.includes('access-gate.js'))html=html.replace('</body','  <script src="./access-gate.js?v=2" defer></script>\n</body');
    if(!html.includes('lead-capture.js'))html=html.replace('</body','  <script src="./lead-capture.js?v=5" defer></script>\n</body');
    return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
  });
}

self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(async cache=>{for(const asset of ASSETS){try{const response=await fetch(asset,{cache:'no-store'});const enhanced=asset.endsWith('.html')||asset==='./'?await enhanceHtml(response):response;if(enhanced&&enhanced.ok)await cache.put(asset,enhanced.clone())}catch(_) {}}}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const url=e.request.url;if(url.includes('/api/')||url.includes('fonts.googleapis.com')||url.includes('square.link')||url.includes('youtube.com')||url.includes('img.youtube.com')){e.respondWith(fetch(e.request));return}if(e.request.mode==='navigate'||url.endsWith('/index.html')){e.respondWith(fetch(e.request,{cache:'no-store'}).then(response=>enhanceHtml(response).then(enhanced=>{const copy=enhanced.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return enhanced})).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')));return}e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))) });
