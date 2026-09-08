(() => {
  'use strict';

  const DEVICE_KEY = 'copePromoDeviceId_v1';
  const ACCESS_KEY = 'copePromoAccess_v1';
  const EXPIRES_KEY = 'copePromoExpiresAt_v1';
  const PROMO_ISSUE_END_MS = Date.parse('2026-09-13T04:59:59.999Z');

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'cope-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function isPromoWeekOpen() {
    return Date.now() <= PROMO_ISSUE_END_MS;
  }

  function isLocallyActive() {
    if (isPromoWeekOpen()) return true;
    const active = localStorage.getItem(ACCESS_KEY) === 'true';
    const expiresAt = Number(localStorage.getItem(EXPIRES_KEY) || 0);
    return active && expiresAt > Date.now();
  }

  function setAccess(expiresAt) {
    const expires = new Date(expiresAt).getTime();
    if (!Number.isFinite(expires) || expires <= Date.now()) {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(EXPIRES_KEY);
      return false;
    }
    localStorage.setItem(ACCESS_KEY, 'true');
    localStorage.setItem(EXPIRES_KEY, String(expires));
    return true;
  }

  function injectTalkContrast() {
    if (document.getElementById('cope-access-talk-contrast')) return;
    const style = document.createElement('style');
    style.id = 'cope-access-talk-contrast';
    style.textContent = `
      .bottom-nav .nav-btn[onclick*="talk"] { -webkit-appearance:none !important; appearance:none !important; background:rgba(184,159,216,.10) !important; border:1px solid rgba(184,159,216,.32) !important; color:#d4bff5 !important; box-shadow:0 0 14px rgba(184,159,216,.10) !important; }
      .bottom-nav .nav-btn[onclick*="talk"] .nav-icon { color:#d4bff5 !important; filter:drop-shadow(0 0 6px rgba(184,159,216,.55)) !important; }
      .bottom-nav .nav-btn[onclick*="talk"] .nav-label { color:#c7b7df !important; }
      #screen-talk, #screen-talk .screen-content { color:#c8c8e0 !important; background:#08080f !important; }
      #screen-talk input#chatInput { background:rgba(184,159,216,.08) !important; color:#f0eeff !important; caret-color:#d4bff5 !important; }
      #screen-talk input#chatInput::placeholder { color:#7a6a9a !important; }
      #screen-talk button#sendBtn { color:#d4bff5 !important; background:rgba(184,159,216,.30) !important; border-color:rgba(184,159,216,.40) !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function syncLocks(active) {
    document.querySelectorAll('.quick-card').forEach(card => {
      card.classList.toggle('locked', !active);
    });
    const talkLock = document.getElementById('talkNavLock');
    if (talkLock) talkLock.style.display = active ? 'none' : '';
  }

  function notifyAccessChanged() {
    window.dispatchEvent(new CustomEvent('copeaccesschange', {
      detail: {
        active: isLocallyActive(),
        expiresAt: localStorage.getItem(EXPIRES_KEY) || null
      }
    }));
  }

  window.copeGetDeviceId = getDeviceId;
  window.copeHasPromoAccess = isLocallyActive;
  window.copeSetPromoAccess = function (expiresAt) {
    const active = setAccess(expiresAt);
    syncLocks(active || isPromoWeekOpen());
    notifyAccessChanged();
    return active;
  };

  window.hasAccess = function () {
    return isLocallyActive();
  };
  window.hasAIAccess = function () {
    return isLocallyActive();
  };

  function showGate(defaultPlan) {
    if (isLocallyActive()) return;
    if (typeof window.copeShowLeadPrompt === 'function') {
      window.copeShowLeadPrompt('gate');
      return;
    }
    const original = window.__copeOriginalOpenPaywall;
    if (typeof original === 'function') original(defaultPlan);
  }

  if (typeof window.openPaywall === 'function' && !window.__copeOriginalOpenPaywall) {
    window.__copeOriginalOpenPaywall = window.openPaywall;
  }
  window.openPaywall = showGate;

  async function refreshAccess() {
    try {
      const response = await fetch('./api/access?deviceId=' + encodeURIComponent(getDeviceId()), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Access check failed: ' + response.status);
      const data = await response.json();
      const storedActive = Boolean(data.active && setAccess(data.expiresAt));
      const active = storedActive || isPromoWeekOpen();
      if (!storedActive && !isPromoWeekOpen()) setAccess(null);
      syncLocks(active);
      notifyAccessChanged();
    } catch (error) {
      const active = isLocallyActive();
      syncLocks(active);
      console.warn('Cope access check unavailable:', error);
    }
  }

  function init() {
    injectTalkContrast();
    syncLocks(isLocallyActive());
    refreshAccess();
    setInterval(refreshAccess, 5 * 60 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
