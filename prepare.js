const fs = require("fs");

const file = "index.html";
let html = fs.readFileSync(file, "utf8");

html = html.replace(
  /const CLOUDFLARE_WORKER_URL = '[^']*';\s*const PWA_API_KEY = '[^']*';/,
  "const COPE_AI_URL = '/api/cope-ai';"
);

html = html.replace(
  /function callCopeAI\(userMessage, onSuccess, onError\) \{[\s\S]*?\n  \}\n  \s*\/\/ Enter key to send/,
  `function callCopeAI(userMessage, onSuccess, onError) {
    var messages = [
      { role: 'user', content: userMessage }
    ];

    if (chatHistory.length > 0) {
      messages = chatHistory.slice(-10).concat(messages);
    }

    var payload = {
      model: 'claude-opus-4-8',
      max_tokens: 500,
      system: 'You are Cope, a compassionate AI companion created to support mental health and wellbeing. Be warm, empathetic, and supportive. Keep responses concise (2-3 sentences). Never provide professional medical advice—encourage them to seek professional help for serious concerns.',
      messages: messages
    };

    fetch(COPE_AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      if (!res.ok) throw new Error('Server error: ' + res.status);
      return res.json();
    })
    .then(function(data) {
      if (data.content && data.content[0] && data.content[0].text) {
        var responseText = data.content[0].text;
        chatHistory.push({ role: 'user', content: userMessage });
        chatHistory.push({ role: 'assistant', content: responseText });
        onSuccess(responseText);
      } else if (data.error) {
        throw new Error('API Error: ' + data.error);
      } else {
        throw new Error('Invalid response format');
      }
    })
    .catch(function(err) {
      console.error('Cope AI error:', err);
      onError('⚠️ ' + err.message + '\\n\\nPlease try again in a moment.');
    });
  }
  
  // Enter key to send`
);

html = html.replace(
  "navigator.serviceWorker.register('/Cope/sw.js')",
  "navigator.serviceWorker.register('./sw.js')"
);

const chatStyles = `<style id="cope-chat-contrast">
#screen-talk h2 { color: var(--lav-bright) !important; text-shadow: 0 0 12px rgba(212,191,245,0.18); }
#screen-talk input, #screen-talk textarea { color: var(--white) !important; background: var(--card) !important; border-color: rgba(184,159,216,0.28) !important; }
#screen-talk input::placeholder, #screen-talk textarea::placeholder { color: #8585a8 !important; opacity: 1; }
#screen-talk button { color: var(--lav-bright); }
#screen-talk button[onclick*="send"], #screen-talk button[type="submit"] { background: rgba(184,159,216,0.18) !important; border-color: rgba(184,159,216,0.42) !important; color: var(--white) !important; }
.bottom-nav .nav-btn .nav-label { color: #a9a9c7 !important; }
.bottom-nav .nav-btn.active .nav-label { color: var(--lav-bright) !important; text-shadow: 0 0 8px rgba(212,191,245,0.22); }
.bottom-nav .nav-btn[onclick*="talk"] { background: rgba(184,159,216,0.10) !important; border: 1px solid rgba(184,159,216,0.32) !important; color: var(--lav-bright) !important; box-shadow: 0 0 14px rgba(184,159,216,0.10); }
.bottom-nav .nav-btn[onclick*="talk"]:hover,
.bottom-nav .nav-btn[onclick*="talk"]:focus,
.bottom-nav .nav-btn[onclick*="talk"]:active,
.bottom-nav .nav-btn[onclick*="talk"].active { background: rgba(184,159,216,0.18) !important; border-color: rgba(184,159,216,0.50) !important; color: var(--lav-bright) !important; }
.bottom-nav .nav-btn[onclick*="talk"] .nav-icon { color: var(--lav-bright) !important; filter: drop-shadow(0 0 6px rgba(184,159,216,0.55)); }
.bottom-nav .nav-btn[onclick*="talk"] .nav-label { color: #c7b7df !important; }
</style>`;

if (html.includes('id="cope-chat-contrast"')) {
  html = html.replace(/<style id="cope-chat-contrast">[\s\S]*?<\/style>/, chatStyles);
} else {
  html = html.replace('</head>', `${chatStyles}\n</head>`);
}

const accessScript = '<script src="./access-gate.js?v=1" defer></script>';
if (!html.includes('access-gate.js')) {
  html = html.replace('</body>', `  ${accessScript}\n</body>`);
}

const leadScript = '<script src="./lead-capture.js?v=4" defer></script>';
if (!html.includes('lead-capture.js')) {
  html = html.replace('</body>', `  ${leadScript}\n</body>`);
}

fs.writeFileSync(file, html);

const manifestFile = "manifest.json";
let manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
manifest.start_url = "./";
manifest.scope = "./";
manifest.display = "standalone";
manifest.display_override = ["standalone"];
manifest.orientation = "portrait-primary";
manifest.icons = (manifest.icons || []).map(icon => ({
  ...icon,
  src: icon.src.replace(/^\/Cope\//, "./")
}));
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

console.log("Cope frontend prepared for AWS /api/cope-ai and seven-day promo access");
