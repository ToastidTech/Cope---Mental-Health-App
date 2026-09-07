(() => {
  'use strict';

  const INTRO_KEY = 'copeLeadIntroShown_v4';
  const EXIT_KEY = 'copeLeadExitShown_v4';
  const ENDPOINT = './api/lead';
  const DEVICE_KEY = 'copePromoDeviceId_v1';
  const PROMO_ISSUE_END_MS = Date.parse('2026-09-13T04:59:59.999Z');

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'cope-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function promoStillIssuing() { return Date.now() <= PROMO_ISSUE_END_MS; }

  function injectStyles() {
    if (document.getElementById('copeLeadStyles')) return;
    const style = document.createElement('style');
    style.id = 'copeLeadStyles';
    style.textContent = `
      .bottom-nav .nav-btn[onclick*="goTo('talk')"],.bottom-nav .nav-btn[onclick*="talk"] { background:rgba(184,159,216,.10)!important; border:1px solid rgba(184,159,216,.32)!important; color:#d4bff5!important; box-shadow:0 0 14px rgba(184,159,216,.10); }
      .bottom-nav .nav-btn[onclick*="goTo('talk')"] .nav-icon,.bottom-nav .nav-btn[onclick*="talk"] .nav-icon { color:#d4bff5!important; filter:drop-shadow(0 0 6px rgba(184,159,216,.55)); }
      .bottom-nav .nav-btn[onclick*="goTo('talk')"] .nav-label,.bottom-nav .nav-btn[onclick*="talk"] .nav-label { color:#c7b7df!important; }
      .bottom-nav .nav-btn[onclick*="goTo('talk')"]:hover,.bottom-nav .nav-btn[onclick*="goTo('talk')"]:focus,.bottom-nav .nav-btn[onclick*="goTo('talk')"]:active,.bottom-nav .nav-btn[onclick*="talk"].active { background:rgba(184,159,216,.18)!important; border-color:rgba(184,159,216,.50)!important; color:#d4bff5!important; }
      #copeLeadOverlay { position:fixed; inset:0; display:none; align-items:flex-end; justify-content:center; padding:16px; background:rgba(4,4,10,.84); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); z-index:9999; }
      #copeLeadOverlay.open { display:flex; }
      .cope-lead-card { width:min(100%,440px); max-height:calc(100dvh - 32px); overflow-y:auto; background:#10101e; border:1px solid rgba(184,159,216,.35); border-radius:24px; padding:22px; box-shadow:0 24px 80px rgba(0,0,0,.55); animation:copeLeadUp .25s ease-out; }
      @keyframes copeLeadUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
      .cope-lead-handle { width:42px; height:4px; border-radius:99px; background:#3a3850; margin:0 auto 18px; }
      .cope-lead-card h2 { font-family:'Cormorant Garamond',serif; color:#f0eeff; font-size:1.9rem; line-height:1.1; margin-bottom:7px; }
      .cope-lead-card p { color:#9694ad; font-size:.8rem; line-height:1.55; margin-bottom:17px; }
      .cope-lead-card label { display:block; color:#c8c8e0; font-size:.7rem; margin:12px 0 6px; }
      .cope-lead-card input,.cope-lead-card textarea { width:100%; border:1px solid #2b2940; background:#0b0b14; color:#f0eeff; border-radius:12px; padding:12px; font:inherit; font-size:.9rem; outline:none; }
      .cope-lead-card input:focus,.cope-lead-card textarea:focus { border-color:#b89fd8; box-shadow:0 0 0 2px rgba(184,159,216,.10); }
      .cope-lead-card textarea { min-height:90px; resize:vertical; }
      .cope-lead-actions { display:flex; gap:10px; margin-top:18px; }
      .cope-lead-actions button { flex:1; min-height:46px; border-radius:12px; padding:12px 14px; font:inherit; cursor:pointer; }
      .cope-lead-skip { background:transparent; border:1px solid #2b2940; color:#9694ad; }
      .cope-lead-submit { background:#b89fd8; border:1px solid #b89fd8; color:#08080f; font-weight:600; }
      .cope-lead-submit:disabled { opacity:.6; cursor:wait; }
      .cope-lead-status { min-height:18px; margin-top:10px; font-size:.72rem; line-height:1.4; color:#7abfa0; }
      .cope-promo-result { display:none; margin-top:14px; padding:14px; border:1px solid rgba(122,191,160,.28); border-radius:14px; background:rgba(122,191,160,.06); text-align:center; }
      .cope-promo-result.open { display:block; }
      .cope-promo-code { display:block; margin:7px 0 4px; color:#f0eeff; font-size:1.35rem; font-weight:600; letter-spacing:2px; }
      .cope-promo-expiry { color:#9694ad; font-size:.7rem; }
      @media (min-width:700px) { #copeLeadOverlay { align-items:center; } }
    `;
    document.head.appendChild(style);
  }

  function injectMarkup() {
    if (document.getElementById('copeLeadOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'copeLeadOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="cope-lead-card" role="dialog" aria-modal="true" aria-labelledby="copeLeadTitle">
        <div class="cope-lead-handle" aria-hidden="true"></div>
        <h2 id="copeLeadTitle">Welcome to Cope</h2>
        <p id="copeLeadIntro"></p>
        <form id="copeLeadForm" novalidate>
          <label for="copeLeadName">Name</label>
          <input id="copeLeadName" name="name" type="text" autocomplete="name" maxlength="120" required>
          <label for="copeLeadEmail">Email</label>
          <input id="copeLeadEmail" name="email" type="email" autocomplete="email" maxlength="254" required>
          <label for="copeLeadComment">Anything you'd like us to know? <span style="opacity:.65">(optional)</span></label>
          <textarea id="copeLeadComment" name="comment" maxlength="2000" placeholder="Tell us what brought you to Cope..."></textarea>
          <div class="cope-lead-actions">
            <button type="button" class="cope-lead-skip" id="copeLeadSkip">Continue without sharing</button>
            <button type="submit" class="cope-lead-submit" id="copeLeadSubmit"></button>
          </div>
          <div class="cope-lead-status" id="copeLeadStatus" aria-live="polite"></div>
          <div class="cope-promo-result" id="copePromoResult" aria-live="polite">
            <span>Your 7-day promo code</span>
            <strong class="cope-promo-code" id="copePromoCode"></strong>
            <span class="cope-promo-expiry" id="copePromoExpiry"></span>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('copeLeadSkip').addEventListener('click', () => closePrompt());
    overlay.addEventListener('click', event => { if (event.target === overlay) closePrompt(); });

    document.getElementById('copeLeadForm').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      const comment = form.elements.comment.value.trim();
      const status = document.getElementById('copeLeadStatus');
      const submit = document.getElementById('copeLeadSubmit');
      const promoResult = document.getElementById('copePromoResult');

      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status.textContent = 'Please enter your name and a valid email.';
        status.style.color = '#c97a8a';
        return;
      }

      submit.disabled = true;
      status.textContent = 'Saving your information…';
      status.style.color = '#9694ad';
      try {
        const response = await fetch(ENDPOINT, {
          method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, credentials:'same-origin',
          body:JSON.stringify({name,email,comment,deviceId:getDeviceId()})
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);

        if (data.promoAvailable && data.expiresAt) {
          localStorage.setItem('copePromoAccess_v1','true');
          localStorage.setItem('copePromoExpiresAt_v1', String(Number(data.expiresAt)));
          if (typeof window.copeSetPromoAccess === 'function') window.copeSetPromoAccess(data.expiresAt);
          document.getElementById('copePromoCode').textContent = data.promoCode || 'COPEFREE7';
          const expiry = new Date(Number(data.expiresAt));
          document.getElementById('copePromoExpiry').textContent = `Free access is active until ${expiry.toLocaleString([], {dateStyle:'medium', timeStyle:'short'})}.`;
          promoResult.classList.add('open');
          status.textContent = 'You’re in. Cope and CopeAI are unlocked for 7 days. 💜';
          status.style.color = '#7abfa0';
          submit.style.display = 'none';
          document.getElementById('copeLeadSkip').textContent = 'Start Cope';
          localStorage.setItem('copeLeadCaptured_v1','true');
          setTimeout(() => closePrompt(), 1800);
        } else {
          status.textContent = 'Thanks. Your information has been saved. The Labor Day free-week promotion has ended.';
          status.style.color = '#9694ad';
          submit.style.display = 'none';
          document.getElementById('copeLeadSkip').textContent = 'Continue to Cope';
          localStorage.setItem('copeLeadCaptured_v1','true');
        }
      } catch (error) {
        console.error('Cope lead capture error:', error);
        status.textContent = 'Could not save your information right now. Please try again.';
        status.style.color = '#c97a8a';
        submit.disabled = false;
      }
    });
  }

  function closePrompt() {
    const overlay = document.getElementById('copeLeadOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
  }

  function showPrompt(mode, force) {
    const key = mode === 'intro' ? INTRO_KEY : EXIT_KEY;
    if (!force && sessionStorage.getItem(key)) return;
    const overlay = document.getElementById('copeLeadOverlay');
    if (!overlay || overlay.classList.contains('open')) return;
    if (!force) sessionStorage.setItem(key,'1');

    const title = document.getElementById('copeLeadTitle');
    const intro = document.getElementById('copeLeadIntro');
    const skip = document.getElementById('copeLeadSkip');
    const submit = document.getElementById('copeLeadSubmit');
    const promoResult = document.getElementById('copePromoResult');
    const status = document.getElementById('copeLeadStatus');
    const promoActive = promoStillIssuing();

    title.textContent = mode === 'gate' ? (promoActive ? 'Unlock 7 Free Days' : 'Stay Connected with Cope') : 'Welcome to Cope';
    intro.textContent = mode === 'gate'
      ? (promoActive ? 'This feature is part of Cope Premium. Share your name and email and we\'ll unlock Cope + CopeAI for 7 days. No card required. Labor Day special ends Saturday.' : 'Share your name and email to stay connected with Cope. The Labor Day free-week promotion has ended.')
      : (promoActive ? 'Share your name and email and we\'ll give you 7 days of free access to Cope, including CopeAI. No card required. Labor Day special ends Saturday.' : 'Share your name and email to stay connected with Cope. The Labor Day free-week promotion has ended.');
    skip.textContent = mode === 'gate' ? 'Not now' : 'Continue without sharing';
    submit.textContent = promoActive ? 'Get My 7 Days' : 'Save My Information';
    submit.style.display = '';
    submit.disabled = false;
    promoResult.classList.remove('open');
    status.textContent = '';
    document.getElementById('copeLeadForm').reset();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    setTimeout(() => document.getElementById('copeLeadName')?.focus(),50);
  }

  window.copeShowLeadPrompt = function(mode) { showPrompt(mode || 'gate', true); };

  function init() {
    injectStyles();
    injectMarkup();
    setTimeout(() => {
      if (!localStorage.getItem('copePromoAccess_v1') || Number(localStorage.getItem('copePromoExpiresAt_v1') || 0) <= Date.now()) showPrompt('intro');
    }, 900);
    document.addEventListener('mouseout', event => { if (event.clientY <= 4 && event.relatedTarget === null) showPrompt('exit'); });
    let wasHidden = false;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') wasHidden = true;
      else if (wasHidden) { wasHidden = false; setTimeout(() => showPrompt('exit'), 150); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
