(() => {
  'use strict';

  const DEVICE_KEY = 'copePromoDeviceId_v1';
  const ACCESS_KEY = 'copePromoAccess_v1';
  const EXPIRES_KEY = 'copePromoExpiresAt_v1';

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'cope-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function isLocallyActive() {
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

  function syncLocks(active) {
    document.querySelectorAll('.quick-card.locked').forEach(card => {
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
    syncLocks(active);
    notifyAccessChanged();
    return active;
  };

  // Both the normal premium gates and the Talk/CopeAI gate use the same
  // individual seven-day entitlement during this promo.
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
      const active = data.active && setAccess(data.expiresAt);
      if (!active) setAccess(null);
      syncLocks(Boolean(active));
      notifyAccessChanged();
    } catch (error) {
      const active = isLocallyActive();
      syncLocks(active);
      console.warn('Cope access check unavailable:', error);
    }
  }

  function init() {
    syncLocks(isLocallyActive());
    refreshAccess();
    setInterval(refreshAccess, 5 * 60 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
