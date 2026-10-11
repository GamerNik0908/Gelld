/* AIOptim – Dashboard (nur für angemeldete Benutzer, siehe assets/auth.js). */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const user = window.AIOptimAuth.currentUser();
  if (!user) return; // requireAuth() im <head> leitet bereits um

  const SETTINGS_KEY = `aioptim_settings_${user.email}`;
  const VIEW_TITLES = { inbox: 'Posteingang', stats: 'Statistik', ranking: 'Ranking-Report', settings: 'Einstellungen' };

  function loadSettings() {
    const defaults = { business: user.business, industry: 'friseur', tone: 'herzlich', signature: '', phone: '', autoApprove5: false, alertCritical: true };
    try { return Object.assign(defaults, JSON.parse(localStorage.getItem(SETTINGS_KEY))); } catch (_) { return defaults; }
  }

  let settings = loadSettings();

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('opacity-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('opacity-0'), 3000);
  }

  function renderUser() {
    $$('[data-business-name]').forEach((el) => { el.textContent = settings.business; });
    $$('[data-user-email]').forEach((el) => { el.textContent = user.email; });
    $$('[data-user-plan]').forEach((el) => { el.textContent = user.plan; });
    $('#welcome').textContent = `Willkommen, ${user.name}!`;
  }

  function setView(view) {
    $$('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== view));
    $('#viewTitle').textContent = VIEW_TITLES[view];
    $$('.nav-btn').forEach((b) => {
      const active = b.dataset.view === view;
      b.setAttribute('aria-current', active ? 'page' : 'false');
      b.classList.toggle('text-brand-700', active);
      b.classList.toggle('text-slate-600', !active);
      if (b.closest('aside')) b.classList.toggle('bg-brand-50', active);
    });
    if (view === 'settings') fillSettingsForm();
    window.scrollTo({ top: 0 });
  }

  function fillSettingsForm() {
    const f = $('#settingsForm');
    f.business.value = settings.business;
    f.industry.value = settings.industry;
    f.signature.value = settings.signature;
    f.phone.value = settings.phone;
    f.tone.value = settings.tone;
    f.autoApprove5.checked = settings.autoApprove5;
    f.alertCritical.checked = settings.alertCritical;
  }

  function init() {
    renderUser();
    $$('.nav-btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $$('[data-logout]').forEach((b) => b.addEventListener('click', () => window.AIOptimAuth.logout()));

    $('#connectGoogle').addEventListener('click', () => {
      toast('Die Google-Anbindung ist noch nicht eingerichtet – sie folgt mit dem Backend.');
    });

    $('#settingsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const business = f.business.value.trim();
      if (business.length < 2) { toast('Bitte geben Sie den Namen Ihres Betriebs ein.'); f.business.focus(); return; }
      settings = {
        business, industry: f.industry.value, signature: f.signature.value.trim(), phone: f.phone.value.trim(),
        tone: f.tone.value, autoApprove5: f.autoApprove5.checked, alertCritical: f.alertCritical.checked,
      };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) { /* privater Modus */ }
      renderUser();
      toast('Einstellungen gespeichert.');
    });

    setView('inbox');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
