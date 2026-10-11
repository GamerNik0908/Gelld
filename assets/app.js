/* AIOptim – Landingpage- und Web-App-Logik (ohne Abhängigkeiten).
 *
 * Optionale Backend-Anbindung: vor dem Laden dieses Skripts setzen, z. B.
 *   <script>window.AIOPTIM_CONFIG = { leadEndpoint: '/api/leads', replyEndpoint: '/api/reply' };</script>
 * Ohne Endpoints läuft alles lokal (Leads in localStorage, Antworten aus Vorlagen).
 */
(function () {
  'use strict';

  const CONFIG = Object.assign({ leadEndpoint: null, replyEndpoint: null, storageKey: 'aioptim_leads' }, window.AIOPTIM_CONFIG || {});

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // Deterministischer Zufallsgenerator: gleiche Eingabe -> gleiche Analyse
  function seededRandom(seed) {
    let s = seed || 1;
    return () => { s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) >>> 0; return ((s ^ (s >>> 14)) >>> 0) / 4294967296; };
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('opacity-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('opacity-0'), 2600);
  }

  /* ---------------- Navigation ---------------- */
  function initNav() {
    const btn = $('#menuToggle');
    const menu = $('#mobileMenu');
    btn.addEventListener('click', () => {
      const open = menu.classList.toggle('hidden') === false;
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    });
    $$('a', menu).forEach((a) => a.addEventListener('click', () => {
      menu.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
    }));

    // Mobile Sticky-CTA erst nach dem Hero einblenden, am Seitenende wieder ausblenden
    const sticky = $('#stickyCta');
    const hero = $('#analysisForm');
    const finalCta = $('#start');
    if ('IntersectionObserver' in window) {
      let heroVisible = true, finalVisible = false;
      const update = () => sticky.classList.toggle('translate-y-full', heroVisible || finalVisible);
      new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; update(); }).observe(hero);
      new IntersectionObserver(([e]) => { finalVisible = e.isIntersecting; update(); }).observe(finalCta);
    }

    $('#year').textContent = new Date().getFullYear();
  }

  /* ---------------- Modals ---------------- */
  let lastFocused = null;

  function openModal(id) {
    const modal = document.getElementById(id);
    lastFocused = document.activeElement;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    const focusable = modal.querySelector('input:not([type=radio]), button[type=submit], button');
    if (focusable) setTimeout(() => focusable.focus(), 30);
  }

  function closeModal(modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (!$$('[role=dialog].flex').length) document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function initModals() {
    $$('[role=dialog]').forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('[data-close-modal]')) closeModal(modal);
      });
      modal.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const items = $$('a[href], button:not([disabled]), input:not([disabled]):not(.sr-only), textarea, select', modal)
          .filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') $$('[role=dialog].flex').forEach(closeModal);
    });
  }

  /* ---------------- Interaktive Demo ---------------- */
  const REVIEWS = [
    {
      author: 'Sandra K.', initial: 'S', color: 'bg-amber-100 text-amber-700', stars: 5, time: 'vor 12 Min.',
      text: 'Super Termin heute! Lisa hat sich richtig Zeit genommen, mich toll beraten und der neue Schnitt sitzt perfekt. Komme definitiv wieder!',
      firstName: 'Sandra', mention: 'Lisa', topic: 'den neuen Schnitt',
    },
    {
      author: 'Thomas W.', initial: 'T', color: 'bg-sky-100 text-sky-700', stars: 3, time: 'vor 2 Std.',
      text: 'Ergebnis war gut, aber ich musste trotz Termin fast 25 Minuten warten. Eine kurze Info vorab wäre nett gewesen.',
      firstName: 'Thomas', issue: 'die Wartezeit', topic: 'das Ergebnis',
    },
    {
      author: 'Michael R.', initial: 'M', color: 'bg-rose-100 text-rose-700', stars: 1, time: 'gestern',
      text: 'Telefonisch nie jemand erreichbar, auf meine E-Mail kam keine Antwort. So gewinnt man keine Kunden.',
      firstName: 'Michael', issue: 'die schlechte Erreichbarkeit',
    },
  ];

  // Vorlagen-Engine als lokaler Fallback für die KI. Je Bewertung x Tonfall mehrere Varianten.
  const REPLY_TEMPLATES = {
    positive: {
      herzlich: [
        (r) => `Liebe ${r.firstName},\n\nvielen herzlichen Dank für Ihre wunderbaren Worte! Es freut uns riesig, dass Sie mit ${r.topic} so zufrieden sind – das Lob geben wir sehr gerne an ${r.mention} weiter.\n\nWir freuen uns schon auf Ihren nächsten Besuch!\n\nHerzliche Grüße\nIhr Team vom Salon Haarmonie`,
        (r) => `Hallo ${r.firstName},\n\nwas für eine schöne Bewertung – danke, dass Sie sich die Zeit dafür genommen haben! ${r.mention} hat sich sehr über Ihr Feedback gefreut.\n\nBis ganz bald bei uns!\nIhr Team vom Salon Haarmonie`,
      ],
      professionell: [
        (r) => `Sehr geehrte Frau K.,\n\nvielen Dank für Ihre positive Bewertung. Es freut uns, dass Sie mit der Beratung und ${r.topic} zufrieden waren. Ihr Lob leiten wir gerne an ${r.mention} weiter.\n\nWir freuen uns, Sie bald wieder bei uns begrüßen zu dürfen.\n\nMit freundlichen Grüßen\nSalon Haarmonie`,
        (r) => `Sehr geehrte Frau K.,\n\nherzlichen Dank für Ihr Vertrauen und die ausgezeichnete Bewertung. Gute Beratung ist uns ein zentrales Anliegen – schön, dass das bei Ihnen angekommen ist.\n\nMit freundlichen Grüßen\nSalon Haarmonie`,
      ],
      locker: [
        (r) => `Hey ${r.firstName}! 😊\n\nDanke dir für die mega Bewertung! Freut uns total, dass du mit ${r.topic} happy bist – ${r.mention} strahlt gerade übers ganze Gesicht.\n\nBis zum nächsten Mal!\nDein Haarmonie-Team`,
        (r) => `Hi ${r.firstName},\n\nwie cool, danke dir! 🙌 Genau für solche Rückmeldungen machen wir das. Wir sehen uns beim nächsten Termin!\n\nDein Haarmonie-Team`,
      ],
    },
    neutral: {
      herzlich: [
        (r) => `Lieber ${r.firstName},\n\nvielen Dank für Ihre ehrliche Rückmeldung! Schön, dass Sie mit ${r.topic} zufrieden sind. Für ${r.issue} möchten wir uns aufrichtig entschuldigen – das darf nicht passieren.\n\nAb sofort informieren wir unsere Kundinnen und Kunden per SMS, falls es einmal länger dauert. Beim nächsten Besuch geht der Kaffee auf uns!\n\nHerzliche Grüße\nIhr Team vom Salon Haarmonie`,
        (r) => `Hallo ${r.firstName},\n\ndanke für Ihr offenes Feedback. Es freut uns, dass Ihnen ${r.topic} gefällt – und es tut uns leid, dass ${r.issue} den Besuch getrübt hat. Wir haben unsere Terminplanung bereits angepasst.\n\nWir würden uns freuen, Sie bald wieder zu sehen!\nIhr Team vom Salon Haarmonie`,
      ],
      professionell: [
        (r) => `Sehr geehrter Herr W.,\n\nvielen Dank für Ihre Bewertung. Wir freuen uns, dass Sie mit ${r.topic} zufrieden sind. Für ${r.issue} bitten wir um Entschuldigung. Wir haben unsere Terminplanung überprüft und informieren künftig proaktiv bei Verzögerungen.\n\nMit freundlichen Grüßen\nSalon Haarmonie`,
        (r) => `Sehr geehrter Herr W.,\n\nhaben Sie Dank für Ihre konstruktive Rückmeldung. ${r.issue.charAt(0).toUpperCase() + r.issue.slice(1)} entspricht nicht unserem Anspruch; wir haben intern Maßnahmen ergriffen, um dies künftig zu vermeiden.\n\nMit freundlichen Grüßen\nSalon Haarmonie`,
      ],
      locker: [
        (r) => `Hey ${r.firstName},\n\ndanke dir fürs ehrliche Feedback! Freut uns, dass ${r.topic} passt – und sorry für ${r.issue}, das war echt nicht cool von uns. Ab jetzt gibt's eine kurze SMS, wenn's mal länger dauert. Nächstes Mal geht der Kaffee auf uns! ☕\n\nDein Haarmonie-Team`,
        (r) => `Hi ${r.firstName},\n\nmerci für deine Rückmeldung! ${r.issue.charAt(0).toUpperCase() + r.issue.slice(1)} tut uns leid – haben wir schon im Team besprochen. Hoffentlich bis bald!\n\nDein Haarmonie-Team`,
      ],
    },
    negative: {
      herzlich: [
        (r) => `Lieber ${r.firstName},\n\nes tut uns wirklich leid, dass Sie uns nicht erreicht haben – das ist ärgerlich und entspricht nicht dem, wie wir mit unseren Kundinnen und Kunden umgehen möchten.\n\nBitte melden Sie sich direkt bei mir unter 0221 123 456 oder info@haarmonie.de. Ich kümmere mich persönlich um Ihr Anliegen.\n\nHerzliche Grüße\nAnna Becker, Inhaberin`,
        (r) => `Hallo ${r.firstName},\n\ndanke, dass Sie uns darauf aufmerksam machen. Für ${r.issue} entschuldigen wir uns aufrichtig. Wir haben unsere Telefonzeiten erweitert und beantworten E-Mails ab sofort innerhalb von 24 Stunden.\n\nGeben Sie uns gern eine zweite Chance – ich melde mich persönlich bei Ihnen.\n\nAnna Becker, Inhaberin`,
      ],
      professionell: [
        (r) => `Sehr geehrter Herr R.,\n\nwir bedauern sehr, dass Sie uns nicht erreichen konnten, und entschuldigen uns für die entstandenen Unannehmlichkeiten. Wir haben den Vorfall intern geprüft und unsere Erreichbarkeit verbessert.\n\nGerne klären wir Ihr Anliegen persönlich: 0221 123 456 oder info@haarmonie.de.\n\nMit freundlichen Grüßen\nAnna Becker, Inhaberin`,
        (r) => `Sehr geehrter Herr R.,\n\nvielen Dank für Ihren Hinweis. ${r.issue.charAt(0).toUpperCase() + r.issue.slice(1)} ist nicht akzeptabel. Wir haben die Ursache identifiziert und Abhilfe geschaffen. Bitte kontaktieren Sie mich direkt, damit wir Ihr Anliegen umgehend lösen können.\n\nMit freundlichen Grüßen\nAnna Becker, Inhaberin`,
      ],
      locker: [
        (r) => `Hi ${r.firstName},\n\nautsch – sorry, das hätte nicht passieren dürfen! 🙈 Wir haben unsere Erreichbarkeit inzwischen verbessert. Ruf mich gern direkt an (0221 123 456), dann klären wir das sofort.\n\nAnna vom Haarmonie-Team`,
        (r) => `Hey ${r.firstName},\n\ndanke, dass du's ansprichst – ${r.issue} tut uns echt leid. Schreib mir gern direkt an info@haarmonie.de, ich kümmere mich persönlich drum.\n\nAnna vom Haarmonie-Team`,
      ],
    },
  };

  function sentimentOf(stars) { return stars >= 4 ? 'positive' : stars === 3 ? 'neutral' : 'negative'; }

  function localReply(review, tone, variant) {
    const list = REPLY_TEMPLATES[sentimentOf(review.stars)][tone];
    return list[variant % list.length](review);
  }

  // Nutzt einen echten KI-Endpoint, falls konfiguriert; sonst lokale Vorlagen.
  async function generateReply(review, tone, variant) {
    if (CONFIG.replyEndpoint) {
      try {
        const res = await fetch(CONFIG.replyEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ review: { author: review.author, stars: review.stars, text: review.text }, tone }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.reply === 'string' && data.reply.trim()) return data.reply.trim();
        }
      } catch (_) { /* Fallback unten */ }
    }
    return localReply(review, tone, variant);
  }

  function initDemo() {
    const state = { index: 0, tone: 'herzlich', variant: 0, editing: false, published: new Set(), typingToken: 0, current: '' };
    const el = {
      tabs: $$('.demo-tab'), avatar: $('#reviewAvatar'), author: $('#reviewAuthor'), stars: $('#reviewStars'),
      time: $('#reviewTime'), text: $('#reviewText'), reply: $('#replyText'), editor: $('#replyEditor'),
      tone: $('#toneSelect'), publish: $('#publishBtn'), edit: $('#editBtn'), regen: $('#regenBtn'),
      status: $('#publishStatus'), badge: $('#demoBadge'), rate: $('#statRate'),
    };

    function typeOut(text) {
      const token = ++state.typingToken;
      state.current = text;
      if (prefersReducedMotion) { el.reply.textContent = text; return; }
      el.reply.textContent = '';
      el.reply.classList.add('typing-caret');
      let i = 0;
      const step = () => {
        if (token !== state.typingToken) return;
        i = Math.min(text.length, i + 3);
        el.reply.textContent = text.slice(0, i);
        if (i < text.length) setTimeout(step, 12);
        else el.reply.classList.remove('typing-caret');
      };
      step();
    }

    async function refreshReply() {
      const review = REVIEWS[state.index];
      el.reply.classList.add('typing-caret');
      el.reply.textContent = '';
      const text = await generateReply(review, state.tone, state.variant);
      typeOut(text);
    }

    function setEditing(on) {
      state.editing = on;
      el.reply.classList.toggle('hidden', on);
      el.editor.classList.toggle('hidden', !on);
      $('span', el.edit).textContent = on ? 'Übernehmen' : 'Anpassen';
      if (on) {
        state.typingToken++; // laufende Animation stoppen
        el.reply.classList.remove('typing-caret');
        el.editor.value = state.current;
        el.editor.focus();
      } else {
        state.current = el.editor.value.trim() || state.current;
        el.reply.textContent = state.current;
      }
    }

    function renderPublishState() {
      const done = state.published.has(state.index);
      el.publish.disabled = done;
      el.publish.classList.toggle('opacity-60', done);
      el.edit.disabled = done; el.regen.disabled = done; el.tone.disabled = done;
      el.status.classList.toggle('hidden', !done);
      el.status.classList.toggle('flex', done);
      if (done) el.status.textContent = '✓ Antwort wurde auf Google veröffentlicht (Demo).';
      const open = REVIEWS.length - state.published.size;
      el.badge.textContent = open ? `${open} neu` : 'Alles erledigt';
      el.badge.className = `rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${open ? 'bg-brand-700' : 'bg-emerald-600'}`;
      el.rate.textContent = `${Math.min(100, 97 + state.published.size)} %`;
    }

    function showReview(i) {
      state.index = i; state.variant = 0;
      if (state.editing) setEditing(false);
      const r = REVIEWS[i];
      el.tabs.forEach((t, ti) => {
        const active = ti === i;
        t.setAttribute('aria-selected', String(active));
        t.className = `demo-tab whitespace-nowrap border-b-2 px-2 pb-2 text-sm font-semibold ${active ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`;
      });
      el.avatar.textContent = r.initial;
      el.avatar.className = `grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold ${r.color}`;
      el.author.textContent = r.author;
      el.time.textContent = r.time;
      el.stars.textContent = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
      el.stars.setAttribute('aria-label', `${r.stars} von 5 Sternen`);
      el.text.textContent = r.text;
      renderPublishState();
      refreshReply();
    }

    el.tabs.forEach((t) => t.addEventListener('click', () => showReview(Number(t.dataset.review))));
    el.tone.addEventListener('change', () => { state.tone = el.tone.value; state.variant = 0; if (state.editing) setEditing(false); refreshReply(); });
    el.regen.addEventListener('click', () => { state.variant++; if (state.editing) setEditing(false); refreshReply(); });
    el.edit.addEventListener('click', () => setEditing(!state.editing));
    el.publish.addEventListener('click', () => {
      if (state.editing) setEditing(false);
      state.typingToken++;
      el.reply.classList.remove('typing-caret');
      el.reply.textContent = state.current;
      state.published.add(state.index);
      renderPublishState();
      toast('Antwort veröffentlicht – in unter 10 Sekunden. 🎉');
      const next = REVIEWS.findIndex((_, i) => !state.published.has(i));
      if (next !== -1) setTimeout(() => showReview(next), 1600);
    });

    showReview(0);
  }

  /* ---------------- Gratis-Analyse ---------------- */
  function parseBusinessInput(raw) {
    const value = raw.trim();
    if (/^https?:\/\//i.test(value) || /^(www\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(value)) {
      let url;
      try { url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); } catch (_) { return { error: 'Dieser Link scheint ungültig zu sein. Bitte prüfen Sie ihn oder geben Sie einfach Ihren Firmennamen ein.' }; }
      const isMaps = /(^|\.)google\.[a-z.]+$/i.test(url.hostname) && url.pathname.startsWith('/maps')
        || /^(maps\.app\.goo\.gl|goo\.gl)$/i.test(url.hostname);
      if (!isMaps) return { error: 'Bitte nutzen Sie einen Google-Maps-Link – oder geben Sie einfach Ihren Firmennamen ein.' };
      const place = url.pathname.match(/\/maps\/place\/([^/]+)/);
      const name = place ? decodeURIComponent(place[1].replace(/\+/g, ' ')) : 'Ihr Betrieb';
      return { name, source: 'maps', query: value };
    }
    if (value.length < 3) return { error: 'Bitte geben Sie mindestens 3 Zeichen ein, z. B. „Bäckerei Müller Hamburg“.' };
    return { name: value, source: 'name', query: value };
  }

  function buildAnalysis(business) {
    const rnd = seededRandom(hashString(business.query.toLowerCase()));
    const rating = 3.8 + Math.round(rnd() * 9) / 10;            // 3,8 – 4,7
    const reviews = 18 + Math.floor(rnd() * 140);
    const answered = 5 + Math.floor(rnd() * 45);                 // 5 – 49 %
    const unanswered = Math.round(reviews * (1 - answered / 100));
    const rank = 4 + Math.floor(rnd() * 9);                       // Platz 4 – 12
    const lastReplyDays = 14 + Math.floor(rnd() * 120);
    const score = Math.max(28, Math.min(74, Math.round(rating * 10 + answered * 0.5 - rank * 1.5)));
    return { rating, reviews, answered, unanswered, rank, lastReplyDays, score };
  }

  function renderAnalysisLoading(name) {
    const steps = ['Google-Unternehmensprofil wird gesucht …', 'Bewertungen werden ausgewertet …', 'Antwortverhalten wird geprüft …', 'Lokales Ranking wird ermittelt …'];
    $('#analysisBody').innerHTML = `
      <p class="text-sm text-slate-600">Wir analysieren <strong class="text-slate-900">${escapeHtml(name)}</strong></p>
      <ul class="mt-5 space-y-3" id="analysisSteps">
        ${steps.map((s) => `<li class="flex items-center gap-3 text-sm text-slate-400" data-step><span class="grid h-6 w-6 place-items-center rounded-full border-2 border-slate-200" data-icon></span>${s}</li>`).join('')}
      </ul>
      <div class="mt-6 h-2 overflow-hidden rounded-full bg-slate-100"><div id="analysisBar" class="h-full w-0 rounded-full bg-brand-600 transition-all duration-500"></div></div>`;
    return steps.length;
  }

  function renderAnalysisResult(business, a) {
    const fmt = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const scoreColor = a.score < 45 ? 'text-rose-600' : a.score < 60 ? 'text-amber-600' : 'text-emerald-600';
    const ring = a.score < 45 ? '#e11d48' : a.score < 60 ? '#d97706' : '#059669';
    const deg = Math.round(a.score * 3.6);
    $('#analysisBody').innerHTML = `
      <div class="flex items-center gap-5">
        <div class="grid h-24 w-24 shrink-0 place-items-center rounded-full" style="background: conic-gradient(${ring} ${deg}deg, #e2e8f0 0)">
          <div class="grid h-[4.75rem] w-[4.75rem] place-items-center rounded-full bg-white text-center">
            <span><span class="block text-2xl font-extrabold ${scoreColor}">${a.score}</span><span class="block text-[10px] font-medium text-slate-500">von 100</span></span>
          </div>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Sichtbarkeits-Score</p>
          <p class="mt-1 text-lg font-bold text-slate-900">${escapeHtml(business.name)}</p>
          <p class="mt-1 text-sm text-slate-600">Hier verschenken Sie Potenzial – das lässt sich schnell ändern.</p>
        </div>
      </div>

      <dl class="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-xl bg-slate-50 p-3"><dt class="text-slate-500">Ø Bewertung</dt><dd class="mt-1 text-lg font-bold text-slate-900">${fmt(a.rating)} ★ <span class="text-xs font-medium text-slate-500">(${a.reviews})</span></dd></div>
        <div class="rounded-xl bg-rose-50 p-3"><dt class="text-rose-700">Unbeantwortet</dt><dd class="mt-1 text-lg font-bold text-rose-700">${a.unanswered} Bewertungen</dd></div>
        <div class="rounded-xl bg-slate-50 p-3"><dt class="text-slate-500">Antwortquote</dt><dd class="mt-1 text-lg font-bold text-slate-900">${a.answered} %</dd></div>
        <div class="rounded-xl bg-amber-50 p-3"><dt class="text-amber-700">Maps-Platz (lokal)</dt><dd class="mt-1 text-lg font-bold text-amber-700">Platz ${a.rank}</dd></div>
      </dl>

      <div class="mt-6">
        <p class="text-sm font-semibold text-slate-900">Ihre 3 größten Hebel:</p>
        <ol class="mt-3 space-y-2 text-sm text-slate-600">
          <li class="flex gap-2"><span class="font-bold text-brand-700">1.</span>${a.unanswered} offene Bewertungen beantworten – die KI erledigt das in wenigen Minuten.</li>
          <li class="flex gap-2"><span class="font-bold text-brand-700">2.</span>Letzte Antwort vor ca. ${a.lastReplyDays} Tagen: Regelmäßige Aktivität signalisiert Google ein gepflegtes Profil.</li>
          <li class="flex gap-2"><span class="font-bold text-brand-700">3.</span>Ziel: Top 3 bei Google Maps – dort landet der Großteil der Klicks.</li>
        </ol>
      </div>

      <button type="button" id="analysisCta" class="mt-6 h-12 w-full rounded-xl bg-brand-700 text-base font-semibold text-white shadow-sm transition hover:bg-brand-800">Jetzt Potenzial nutzen – 14 Tage gratis</button>
      <p class="mt-3 text-center text-xs text-slate-500">Vorschau auf Basis einer Schnellanalyse. Den vollständigen Bericht mit Live-Daten erhalten Sie nach der Verbindung Ihres Google-Profils.</p>`;

    $('#analysisCta').addEventListener('click', () => {
      closeModal($('#analysisModal'));
      openSignup({ plan: 'pro', business: business.source === 'name' ? business.name : '' });
    });
  }

  function initAnalysis() {
    const form = $('#analysisForm');
    const input = $('#analysisInput');
    const err = $('#analysisError');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const business = parseBusinessInput(input.value);
      if (business.error) {
        err.textContent = business.error;
        err.classList.remove('hidden');
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      err.classList.add('hidden');
      input.removeAttribute('aria-invalid');
      track('analysis_started', { source: business.source });

      const total = renderAnalysisLoading(business.name);
      openModal('analysisModal');
      const stepEls = $$('[data-step]');
      let i = 0;
      const tick = () => {
        if (i > 0) {
          const prev = stepEls[i - 1];
          prev.classList.replace('text-slate-400', 'text-slate-900');
          $('[data-icon]', prev).outerHTML = '<span class="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-xs text-white">✓</span>';
        }
        $('#analysisBar').style.width = `${(i / total) * 100}%`;
        if (i < total) { i++; setTimeout(tick, prefersReducedMotion ? 150 : 650); }
        else setTimeout(() => renderAnalysisResult(business, buildAnalysis(business)), 350);
      };
      tick();
    });
  }

  /* ---------------- Preise ---------------- */
  function initPricing() {
    const toggle = $('#billingToggle');
    const knob = $('span', toggle);
    let yearly = false;
    toggle.addEventListener('click', () => {
      yearly = !yearly;
      toggle.setAttribute('aria-checked', String(yearly));
      toggle.classList.toggle('bg-brand-700', yearly);
      toggle.classList.toggle('bg-slate-300', !yearly);
      knob.style.transform = yearly ? 'translateX(20px)' : '';
      $('#billMonthlyLabel').classList.toggle('text-slate-900', !yearly);
      $('#billMonthlyLabel').classList.toggle('text-slate-500', yearly);
      $('#billYearlyLabel').classList.toggle('text-slate-900', yearly);
      $('#billYearlyLabel').classList.toggle('text-slate-500', !yearly);
      $$('[data-price-monthly]').forEach((p) => { p.textContent = `${yearly ? p.dataset.priceYearly : p.dataset.priceMonthly} €`; });
      $$('[data-billing-note]').forEach((n) => {
        n.textContent = yearly ? `${n.dataset.yearlyTotal} € jährlich · zzgl. MwSt.` : 'zzgl. MwSt. · monatlich kündbar';
      });
      state.billing = yearly ? 'yearly' : 'monthly';
    });
  }

  /* ---------------- FAQ ---------------- */
  const FAQ_ITEMS = [
    { q: 'Brauche ich technische Vorkenntnisse für die Einrichtung?', a: 'Nein. Sie melden sich mit Ihrer E-Mail an und verbinden Ihr Google-Unternehmensprofil mit einem Klick über die offizielle Google-Anmeldung. Das dauert etwa 2 Minuten – danach läuft AIOptim automatisch. Wenn Sie möchten, richten wir alles gemeinsam mit Ihnen am Telefon ein, kostenlos.' },
    { q: 'Wird etwas ohne meine Zustimmung veröffentlicht?', a: 'Nein, niemals. Die KI erstellt nur Vorschläge. Sie entscheiden bei jeder Antwort selbst: mit einem Klick freigeben, kurz anpassen oder verwerfen. Auf Wunsch können Sie später für 5-Sterne-Bewertungen eine automatische Freigabe aktivieren – das ist aber optional.' },
    { q: 'Klingen die Antworten nicht nach Roboter?', a: 'Nein. Die KI geht auf den konkreten Inhalt jeder Bewertung ein – Namen, Lob, Kritikpunkte – und schreibt in dem Tonfall, den Sie festlegen (z. B. herzlich, professionell oder per Du). Jede Antwort ist individuell, Kunden merken keinen Unterschied zu einer selbst geschriebenen Antwort.' },
    { q: 'Wie lange läuft der Vertrag und wie kann ich kündigen?', a: 'Es gibt keine Mindestlaufzeit. Die monatliche Variante ist jederzeit zum Monatsende kündbar – mit einem Klick in Ihrem Konto, ohne Anruf und ohne Formular. Die Testphase endet nach 14 Tagen automatisch und ohne Kosten, wenn Sie kein Abo abschließen.' },
    { q: 'Brauche ich für den Test eine Kreditkarte?', a: 'Nein. Für die 14-tägige Testphase benötigen Sie nur Ihre E-Mail-Adresse. Zahlungsdaten geben Sie erst an, wenn Sie sich nach dem Test für AIOptim entscheiden.' },
    { q: 'Ist AIOptim DSGVO-konform?', a: 'Ja. Unsere Server stehen in der EU (Frankfurt am Main), alle Daten werden verschlüsselt übertragen und gespeichert. Wir verarbeiten ausschließlich öffentlich sichtbare Bewertungen sowie die Daten, die für Ihr Konto nötig sind. Einen Auftragsverarbeitungsvertrag (AVV) stellen wir Ihnen auf Anfrage zur Verfügung. Ihre Daten werden nicht verkauft und nicht zu Werbezwecken genutzt.' },
    { q: 'Funktioniert das auch für mehrere Standorte?', a: 'Ja. Im Pro-Tarif verwalten Sie bis zu 3 Standorte in einem gemeinsamen Posteingang. Für größere Filialbetriebe erstellen wir Ihnen gerne ein individuelles Angebot.' },
    { q: 'Kann ich den Tarif später wechseln?', a: 'Selbstverständlich. Sie können jederzeit zwischen Basis und Pro wechseln. Ein Upgrade gilt sofort, ein Downgrade zum nächsten Abrechnungszeitraum – anteilig und fair abgerechnet.' },
  ];

  function initFaq() {
    const list = $('#faqList');
    list.innerHTML = FAQ_ITEMS.map((item, i) => `
      <div class="faq-item" data-open="false">
        <h3>
          <button type="button" class="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-base font-semibold text-slate-900 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:px-6"
            aria-expanded="false" aria-controls="faq-panel-${i}" id="faq-btn-${i}">
            <span>${escapeHtml(item.q)}</span>
            <span class="faq-icon grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 transition-transform" aria-hidden="true">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>
            </span>
          </button>
        </h3>
        <div class="faq-panel" id="faq-panel-${i}" role="region" aria-labelledby="faq-btn-${i}">
          <div><p class="px-5 pb-5 leading-relaxed text-slate-600 sm:px-6">${escapeHtml(item.a)}</p></div>
        </div>
      </div>`).join('');

    list.addEventListener('click', (e) => {
      const btn = e.target.closest('button[aria-controls]');
      if (!btn) return;
      const item = btn.closest('.faq-item');
      const open = item.dataset.open !== 'true';
      $$('.faq-item', list).forEach((other) => {
        other.dataset.open = 'false';
        $('button', other).setAttribute('aria-expanded', 'false');
      });
      item.dataset.open = String(open);
      btn.setAttribute('aria-expanded', String(open));
    });

    // FAQ-Schema für Google-Rich-Results
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
    document.head.appendChild(ld);
  }

  /* ---------------- Leads & Registrierung ---------------- */
  const state = { billing: 'monthly' };

  function getUtm() {
    const params = new URLSearchParams(location.search);
    const utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'].forEach((k) => { if (params.get(k)) utm[k] = params.get(k); });
    return utm;
  }

  function track(event, data) {
    // Hook für Analytics (z. B. Plausible, Matomo). Nur bei Consent aktivieren.
    if (typeof window.plausible === 'function') window.plausible(event, { props: data });
    document.dispatchEvent(new CustomEvent('aioptim:track', { detail: { event, data } }));
  }

  function readLeads() {
    try { return JSON.parse(localStorage.getItem(CONFIG.storageKey) || '[]'); } catch (_) { return []; }
  }

  async function saveLead(lead) {
    const record = Object.assign({ createdAt: new Date().toISOString(), page: location.pathname, utm: getUtm() }, lead);
    try {
      const leads = readLeads().filter((l) => l.email !== record.email);
      leads.push(record);
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(leads));
    } catch (_) { /* privater Modus o. Ä. – Backend bleibt maßgeblich */ }

    if (CONFIG.leadEndpoint) {
      const res = await fetch(CONFIG.leadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`Lead-Endpoint antwortete mit ${res.status}`);
    }
    track('trial_signup', { plan: record.plan, source: record.source });
    return record;
  }

  function trialEndDate() {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function successHtml(lead) {
    const planName = lead.plan === 'basis' ? 'Basis' : 'Pro / Booster';
    return `
      <div class="text-center">
        <div class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-600">✓</div>
        <h3 class="mt-4 text-xl font-bold text-slate-900">Willkommen bei AIOptim!</h3>
        <p class="mt-2 text-sm text-slate-600">Wir haben Ihren Zugang an <strong class="text-slate-900">${escapeHtml(lead.email)}</strong> geschickt.</p>
        <p class="mt-1 text-xs text-slate-500">Tarif: ${planName} · Gratis bis ${trialEndDate()}</p>
      </div>
      <ol class="mt-6 space-y-3 text-left text-sm">
        <li class="flex gap-3"><span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-white">✓</span><span class="text-slate-600"><strong class="text-slate-900">Konto angelegt</strong></span></li>
        <li class="flex gap-3"><span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">2</span><span class="text-slate-600"><strong class="text-slate-900">E-Mail öffnen</strong> und auf „Zugang bestätigen“ klicken</span></li>
        <li class="flex gap-3"><span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">3</span><span class="text-slate-600"><strong class="text-slate-900">Google-Profil verbinden</strong> – ein Klick, fertig</span></li>
      </ol>
      <p class="mt-5 rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">Keine E-Mail erhalten? Schauen Sie bitte auch im Spam-Ordner nach.</p>`;
  }

  function setError(el, msg) {
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
  }

  function openSignup({ plan, business, email, mode } = {}) {
    const form = $('#signupForm');
    form.classList.remove('hidden');
    $('#signupSuccess').classList.add('hidden');
    setError($('#signupError'), '');
    if (plan) $(`input[name=plan][value="${plan}"]`, form).checked = true;
    if (business) form.business.value = business;
    if (email) form.email.value = email;
    $('#signupTitle').textContent = mode === 'login' ? 'Konto anlegen oder anmelden' : '14 Tage kostenlos testen';
    openModal('signupModal');
    setTimeout(() => (form.business.value ? form.email : form.business).focus(), 40);
  }

  function initSignup() {
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-open-signup]');
      if (!trigger) return;
      e.preventDefault();
      openSignup({ plan: trigger.dataset.plan, mode: trigger.dataset.mode });
      track('signup_opened', { plan: trigger.dataset.plan || null });
    });

    const form = $('#signupForm');
    const err = $('#signupError');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const business = form.business.value.trim();
      const email = form.email.value.trim();
      if (business.length < 2) { setError(err, 'Bitte geben Sie den Namen Ihres Betriebs ein.'); form.business.focus(); return; }
      if (!EMAIL_RE.test(email)) { setError(err, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'); form.email.focus(); return; }
      if (!form.consent.checked) { setError(err, 'Bitte bestätigen Sie AGB und Datenschutzerklärung.'); form.consent.focus(); return; }
      setError(err, '');

      const submit = $('button[type=submit]', form);
      submit.disabled = true;
      $('span', submit).textContent = 'Zugang wird erstellt …';
      try {
        const lead = await saveLead({ email, business, plan: form.plan.value, billing: state.billing, source: 'signup_modal' });
        form.classList.add('hidden');
        const success = $('#signupSuccess');
        success.innerHTML = successHtml(lead);
        success.classList.remove('hidden');
        form.reset();
      } catch (_) {
        setError(err, 'Da ist etwas schiefgelaufen. Bitte versuchen Sie es erneut oder schreiben Sie an hallo@aioptim.de.');
      } finally {
        submit.disabled = false;
        $('span', submit).textContent = 'Kostenlos starten';
      }
    });
  }

  function initLeadForm() {
    const form = $('#leadForm');
    const err = $('#leadError');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      if (!EMAIL_RE.test(email)) { setError(err, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'); form.email.focus(); return; }
      if (!form.consent.checked) { setError(err, 'Bitte stimmen Sie der Datenverarbeitung zu.'); form.consent.focus(); return; }
      setError(err, '');
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      try {
        const lead = await saveLead({ email, plan: 'pro', billing: state.billing, source: 'footer_cta' });
        form.classList.add('hidden');
        const success = $('#leadSuccess');
        success.innerHTML = successHtml(lead);
        success.classList.remove('hidden');
      } catch (_) {
        setError(err, 'Da ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.');
      } finally {
        btn.disabled = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initModals();
    initDemo();
    initAnalysis();
    initPricing();
    initFaq();
    initSignup();
    initLeadForm();
  });
})();
