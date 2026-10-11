/* AIOptim – Anmeldung (nur Frontend).
 *
 * ACHTUNG: Ohne Backend ist das keine echte Absicherung. Benutzer und Passwort
 * stehen hier im Quelltext und sind für jeden lesbar. Vor dem Livegang muss die
 * Anmeldung serverseitig erfolgen (Passwort-Hash in einer Datenbank, Session-Cookie).
 */
(function () {
  'use strict';

  const SESSION_KEY = 'aioptim_session';

  // Vorab angelegter Benutzer zum Reinkommen.
  const USERS = [
    {
      email: 'demo@aioptim.de',
      password: 'Demo1234!',
      name: 'Demo Benutzer',
      business: 'Demo Betrieb',
      plan: 'Pro / Booster',
    },
  ];

  function readSession() {
    for (const store of [sessionStorage, localStorage]) {
      try {
        const s = JSON.parse(store.getItem(SESSION_KEY));
        if (s && s.email && USERS.some((u) => u.email === s.email)) return s;
      } catch (_) { /* nicht verfügbar */ }
    }
    return null;
  }

  function currentUser() {
    const s = readSession();
    if (!s) return null;
    const { password, ...user } = USERS.find((u) => u.email === s.email);
    return user;
  }

  function login(email, password, remember) {
    const user = USERS.find((u) => u.email === email.trim().toLowerCase() && u.password === password);
    if (!user) return false;
    const session = JSON.stringify({ email: user.email, since: Date.now() });
    try {
      (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, session);
    } catch (_) { return false; }
    return true;
  }

  function logout() {
    try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch (_) { /* egal */ }
    location.href = 'login.html';
  }

  // Auf geschützten Seiten aufrufen: leitet ohne Anmeldung zum Login um.
  function requireAuth() {
    const user = currentUser();
    if (!user) location.replace('login.html');
    return user;
  }

  window.AIOptimAuth = { login, logout, currentUser, requireAuth };
})();
