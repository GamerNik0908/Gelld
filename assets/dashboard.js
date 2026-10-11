/* AIOptim – Dashboard-Demo ohne Anmeldung.
 * Simuliert ein Google-Unternehmensprofil ("Test-Google"), auf dem nach und nach
 * Bewertungen eingehen. Antworten erzeugt eine lokale Vorlagen-Engine, alles wird
 * im localStorage gespeichert. Es wird nichts an Google oder einen Server gesendet.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'aioptim_demo_v1';
  const MINUTES_PER_MANUAL_REPLY = 4;
  const SECONDS_PER_APPROVAL = 10;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= Testdaten ================= */

  const INDUSTRIES = {
    friseur: {
      label: 'Friseursalon',
      keywords: ['Friseur in der Nähe', 'Haare färben', 'Herrenhaarschnitt'],
      basePositions: [7, 9, 12],
      competitors: [['Hairstyling Lena', 4.6, 212, 85], ['Salon Schnittpunkt', 4.4, 158, 40], ['Barber Corner', 4.7, 96, 12]],
      reviews: [
        [5, 'Super Termin heute! Ich wurde richtig toll beraten und der neue Schnitt sitzt perfekt. Komme definitiv wieder!'],
        [5, 'Sehr freundliches Team, entspannte Atmosphäre und das Ergebnis ist genau so, wie ich es mir vorgestellt habe.'],
        [5, 'Endlich ein Salon, der Locken versteht! Ehrliche Beratung, top Ergebnis. Klare Empfehlung.'],
        [5, 'Kurzfristig einen Termin bekommen, pünktlich drangekommen und super zufrieden. Danke!'],
        [5, 'Meine Farbe ist der Wahnsinn. Man merkt, dass hier Profis arbeiten. Preis-Leistung absolut fair.'],
        [4, 'Schöner Schnitt und nettes Personal. Nur die Parkplatzsuche ist etwas mühsam.'],
        [3, 'Ergebnis war gut, aber ich musste trotz Termin fast 25 Minuten warten. Eine kurze Info vorab wäre nett gewesen.'],
        [3, 'Haarschnitt ok, aber für den Preis hätte ich etwas mehr Beratung erwartet. Recht teuer.'],
        [2, 'Telefonisch nie jemand erreichbar, ich habe dreimal angerufen. Vor Ort dann aber freundlich.'],
        [1, 'Die Mitarbeiterin war sehr unfreundlich und genervt. Fühlte mich überhaupt nicht willkommen.'],
      ],
    },
    handwerk: {
      label: 'Handwerksbetrieb',
      keywords: ['Handwerker in der Nähe', 'Badsanierung', 'Heizung Notdienst'],
      basePositions: [8, 11, 6],
      competitors: [['Haustechnik Krüger', 4.5, 134, 60], ['Bau & Bad Meier', 4.2, 87, 25], ['Sanitär Express', 4.8, 61, 5]],
      reviews: [
        [5, 'Badsanierung komplett im Zeitplan, super sauber gearbeitet und alles erklärt. Absolut empfehlenswert!'],
        [5, 'Heizung am Sonntag ausgefallen – innerhalb von zwei Stunden war jemand da. Schnell, freundlich, fair.'],
        [5, 'Pünktlich, zuverlässig und ehrliche Beratung. So wünscht man sich einen Handwerksbetrieb.'],
        [5, 'Das Team hat die Baustelle jeden Tag ordentlich hinterlassen. Ergebnis top, Preis wie angeboten.'],
        [5, 'Sehr kompetent, hat sich Zeit genommen und mehrere Varianten erklärt. Gerne wieder!'],
        [4, 'Gute Arbeit, freundliche Monteure. Der Termin hat sich leider einmal verschoben.'],
        [3, 'Arbeit ist in Ordnung, aber es hat deutlich länger gedauert als angekündigt.'],
        [3, 'Ergebnis gut, die Rechnung lag aber über dem Kostenvoranschlag. Das hätte man vorher sagen können.'],
        [2, 'Auf meinen Rückruf warte ich seit einer Woche. Schade, die Arbeit selbst war gut.'],
        [1, 'Termin nicht eingehalten, niemand erreichbar, keine Entschuldigung. Sehr enttäuschend.'],
      ],
    },
    fahrschule: {
      label: 'Fahrschule',
      keywords: ['Fahrschule in der Nähe', 'Führerschein Klasse B', 'Intensivkurs Führerschein'],
      basePositions: [7, 10, 9],
      competitors: [['Fahrschule Gasgeben', 4.6, 245, 70], ['Drive Academy', 4.3, 119, 20], ['Fahrschule Rot-Weiß', 4.5, 88, 0]],
      reviews: [
        [5, 'Super geduldiger Fahrlehrer, ich hatte nie Stress. Prüfung im ersten Anlauf bestanden!'],
        [5, 'Sehr gut organisiert, Fahrstunden immer pünktlich und alles verständlich erklärt. Danke für alles!'],
        [5, 'Ich hatte große Angst vorm Autofahren – hier wurde ich total freundlich und geduldig begleitet. Bestanden!'],
        [5, 'Intensivkurs gemacht, top strukturiert. Theorie und Praxis in drei Wochen. Klare Empfehlung.'],
        [5, 'Faire Preise, moderne Autos und ein richtig nettes Team. Würde ich jederzeit wieder wählen.'],
        [4, 'Gute Fahrschule, nette Fahrlehrer. Termine waren manchmal etwas schwer zu bekommen.'],
        [3, 'Fahrlehrer war gut, aber ich musste lange auf freie Fahrstunden warten.'],
        [3, 'Unterricht ok, aber die Kosten am Ende waren höher als gedacht. Teuer.'],
        [2, 'Im Büro telefonisch kaum erreichbar, E-Mails werden spät beantwortet.'],
        [1, 'Mein Fahrlehrer war oft genervt und unhöflich. Habe die Fahrschule gewechselt.'],
      ],
    },
    restaurant: {
      label: 'Restaurant / Café',
      keywords: ['Restaurant in der Nähe', 'Mittagstisch', 'Restaurant mit Terrasse'],
      basePositions: [9, 6, 12],
      competitors: [['Trattoria Bella', 4.5, 512, 55], ['Zum Goldenen Hirsch', 4.3, 389, 10], ['Café Morgenrot', 4.6, 201, 80]],
      reviews: [
        [5, 'Wahnsinnig leckeres Essen, frische Zutaten und ein super herzlicher Service. Wir kommen wieder!'],
        [5, 'Bester Mittagstisch in der Gegend. Schnell serviert, fair im Preis und immer lecker.'],
        [5, 'Wunderschöne Terrasse, aufmerksames Personal und das Dessert war ein Traum.'],
        [5, 'Geburtstag hier gefeiert – alles perfekt organisiert, sehr freundlich und das Essen top.'],
        [5, 'Toller Abend! Die Empfehlung des Kellners war genau richtig. Preis-Leistung stimmt.'],
        [4, 'Sehr gutes Essen, nette Bedienung. Am Wochenende etwas laut.'],
        [3, 'Essen war gut, aber wir haben über 40 Minuten auf die Hauptspeise gewartet.'],
        [3, 'Lecker, aber für die Portionsgröße recht teuer.'],
        [2, 'Das Essen kam lauwarm und war etwas versalzen. Service war bemüht.'],
        [1, 'Unfreundliche Bedienung, die uns kaum beachtet hat. Leider ein enttäuschender Abend.'],
      ],
    },
    kfz: {
      label: 'KFZ-Werkstatt',
      keywords: ['Autowerkstatt in der Nähe', 'Inspektion', 'Reifenwechsel'],
      basePositions: [8, 7, 11],
      competitors: [['Auto Service Lang', 4.4, 301, 30], ['Kfz-Meisterbetrieb Weber', 4.7, 176, 65], ['Reifen Blitz', 4.1, 94, 0]],
      reviews: [
        [5, 'Inspektion schnell und fair erledigt, alles verständlich erklärt. Endlich eine ehrliche Werkstatt!'],
        [5, 'Kurzfristig einen Termin bekommen, das Auto war am selben Tag fertig. Super freundlich.'],
        [5, 'Sehr kompetente Beratung, keine unnötigen Reparaturen aufgeschwatzt. Absolute Empfehlung.'],
        [5, 'Reifenwechsel in 20 Minuten, pünktlich und sauber. Preis-Leistung top.'],
        [5, 'Familienbetrieb mit Herz. Man wird freundlich empfangen und das Ergebnis passt immer.'],
        [4, 'Gute Arbeit und faire Preise. Die Wartezone könnte etwas gemütlicher sein.'],
        [3, 'Reparatur gut, aber das Auto war zwei Tage später fertig als zugesagt.'],
        [3, 'Arbeit in Ordnung, aber die Rechnung war höher als besprochen.'],
        [2, 'Telefonisch schwer zu erreichen, Rückruf kam erst nach mehrmaligem Nachfragen.'],
        [1, 'Unfreundlicher Empfang, man fühlte sich wie ein Störfaktor. Komme nicht wieder.'],
      ],
    },
  };

  const NAMES = ['Sandra K.', 'Thomas W.', 'Michael R.', 'Julia S.', 'Andreas B.', 'Laura M.', 'Stefan H.', 'Katrin F.', 'Daniel P.', 'Nicole Z.',
    'Markus L.', 'Sabine T.', 'Jonas E.', 'Melanie G.', 'Tobias N.', 'Lena V.', 'Christian O.', 'Anna J.', 'Felix D.', 'Sarah A.', 'Mehmet Y.', 'Elena C.'];

  const AVATAR_COLORS = ['bg-amber-100 text-amber-800', 'bg-sky-100 text-sky-800', 'bg-rose-100 text-rose-800', 'bg-emerald-100 text-emerald-800', 'bg-violet-100 text-violet-800', 'bg-orange-100 text-orange-800'];

  // Historische Bewertungen, die das Profil vor AIOptim schon hatte.
  const BASELINE = { stars: { 5: 22, 4: 7, 3: 3, 2: 2, 1: 3 }, answered: 8 };
  const baselineCount = Object.values(BASELINE.stars).reduce((a, b) => a + b, 0);

  const TONES = [
    { value: 'herzlich', label: 'Herzlich', hint: 'Sie, warm' },
    { value: 'professionell', label: 'Professionell', hint: 'Sie, sachlich' },
    { value: 'locker', label: 'Locker', hint: 'Du, entspannt' },
  ];

  /* ================= KI-Antwort-Engine (lokal) ================= */

  const TOPICS = [
    { key: 'staff', pos: /freundlich|nett|herzlich|sympathisch|geduldig|aufmerksam|mit herz/i, phrase: 'die freundliche Betreuung' },
    { key: 'advice', pos: /berat|erklärt|ehrlich|kompetent|empfehlung des/i, phrase: 'unsere Beratung' },
    { key: 'speed', pos: /pünktlich|zuverlässig|schnell|kurzfristig|im zeitplan|am selben tag/i, phrase: 'unsere Zuverlässigkeit' },
    { key: 'price', pos: /fair|preis-leistung|faire preise/i, phrase: 'das faire Preis-Leistungs-Verhältnis' },
    { key: 'quality', pos: /ergebnis|perfekt|lecker|sauber|farbe|schnitt|bestanden|top|traum/i, phrase: 'das Ergebnis' },
  ];

  const ISSUES = [
    { key: 'rude', re: /unfreundlich|genervt|unhöflich|störfaktor|kaum beachtet/i, phrase: 'das Verhalten unseres Teams',
      fix: { sie: 'Das haben wir intern sehr deutlich angesprochen – so möchten wir nicht auftreten.', du: 'Das haben wir im Team sehr deutlich angesprochen – so wollen wir nicht rüberkommen.' } },
    { key: 'reach', re: /erreich|telefon|rückruf|e-mails?|angerufen/i, phrase: 'die schlechte Erreichbarkeit',
      fix: { sie: 'Wir haben unsere Telefonzeiten erweitert und rufen ab sofort innerhalb eines Werktags zurück.', du: 'Wir haben unsere Telefonzeiten erweitert und melden uns ab jetzt innerhalb eines Werktags.' } },
    { key: 'wait', re: /warten|wartezeit|wartet|gewartet|warte ich|gedauert|später fertig|verschoben|nicht eingehalten|länger/i, phrase: 'die lange Wartezeit',
      fix: { sie: 'Wir haben unsere Terminplanung angepasst und informieren künftig rechtzeitig, falls es einmal länger dauert.', du: 'Wir haben unsere Planung angepasst und sagen künftig rechtzeitig Bescheid, falls es mal länger dauert.' } },
    { key: 'price', re: /teuer|rechnung|kosten|höher als|kostenvoranschlag/i, phrase: 'die Unklarheit beim Preis',
      fix: { sie: 'Gerne erläutern wir Ihnen die Zusammensetzung persönlich – und achten künftig noch stärker auf transparente Angaben vorab.', du: 'Gerne erklären wir dir die Zusammensetzung persönlich – und achten künftig noch mehr auf klare Angaben vorab.' } },
    { key: 'food', re: /lauwarm|versalzen|kalt/i, phrase: 'die Qualität des Essens',
      fix: { sie: 'Unsere Küche hat die Abläufe bereits überprüft, damit jedes Gericht so ankommt, wie es soll.', du: 'Unsere Küche hat die Abläufe schon überprüft, damit jedes Gericht so ankommt, wie es soll.' } },
    { key: 'other', re: /parkplatz|laut|wartezone/i, phrase: 'diesen Punkt',
      fix: { sie: 'Wir nehmen Ihren Hinweis gerne auf und schauen, was wir verbessern können.', du: 'Wir nehmen deinen Hinweis gerne mit und schauen, was wir verbessern können.' } },
  ];

  const T = {
    herzlich: {
      du: false,
      greet: (c) => `Hallo ${c.first},`,
      posOpen: ['vielen herzlichen Dank für Ihre wunderbare Bewertung!', 'was für ein schönes Feedback – danke, dass Sie sich die Zeit dafür genommen haben!', 'über Ihre {stars} Sterne haben wir uns riesig gefreut – danke!'],
      posTopic: ['Dass Ihnen besonders {topic} gefallen hat, freut uns ganz besonders.', 'Ihr Lob für {topic} geben wir sehr gerne ans ganze Team weiter.'],
      posPlain: ['Genau für solche Rückmeldungen machen wir unsere Arbeit mit so viel Herz.'],
      posClose: ['Wir freuen uns schon auf Ihren nächsten Besuch!', 'Bis hoffentlich ganz bald!'],
      midOpen: ['vielen Dank für Ihre ehrliche Rückmeldung!', 'danke, dass Sie uns so offen Feedback geben!'],
      midPos: ['Schön, dass Sie mit {topic} zufrieden waren.'],
      midIssue: ['{Issue} tut uns aufrichtig leid – das entspricht nicht unserem Anspruch.', 'Für {issue} möchten wir uns ehrlich entschuldigen.'],
      midClose: ['Wir würden uns freuen, Sie bald wieder bei uns zu begrüßen und ganz zu überzeugen!'],
      negOpen: ['es tut uns wirklich leid, dass Sie keine gute Erfahrung mit uns gemacht haben.', 'danke, dass Sie uns darauf aufmerksam machen – Ihren Ärger können wir gut verstehen.'],
      negIssue: ['Für {issue} entschuldigen wir uns aufrichtig.'],
      contact: (c) => `Bitte melden Sie sich direkt bei uns${c.phone ? ` unter ${c.phone}` : ''} – wir kümmern uns persönlich um Ihr Anliegen.`,
      sign: 'Herzliche Grüße',
    },
    professionell: {
      du: false,
      greet: (c) => `Guten Tag ${c.author},`,
      posOpen: ['vielen Dank für Ihre positive Bewertung.', 'herzlichen Dank für Ihr Vertrauen und die sehr gute Bewertung.'],
      posTopic: ['Es freut uns, dass Sie mit {topic} zufrieden waren.', 'Ihr Lob für {topic} leiten wir gerne an unser Team weiter.'],
      posPlain: ['Ihre Zufriedenheit ist unser wichtigster Maßstab.'],
      posClose: ['Wir freuen uns, Sie bald wieder bei uns begrüßen zu dürfen.', 'Wir stehen Ihnen auch künftig jederzeit gerne zur Verfügung.'],
      midOpen: ['vielen Dank für Ihre konstruktive Rückmeldung.', 'haben Sie Dank für Ihre Bewertung.'],
      midPos: ['Es freut uns, dass Sie mit {topic} zufrieden waren.'],
      midIssue: ['Für {issue} bitten wir um Entschuldigung.', '{Issue} entspricht nicht unserem Qualitätsanspruch.'],
      midClose: ['Wir würden uns freuen, Sie erneut von unserer Leistung überzeugen zu dürfen.'],
      negOpen: ['wir bedauern sehr, dass Ihre Erfahrung nicht Ihren Erwartungen entsprochen hat.', 'vielen Dank für Ihren Hinweis, den wir sehr ernst nehmen.'],
      negIssue: ['Für {issue} entschuldigen wir uns ausdrücklich.'],
      contact: (c) => `Gerne klären wir Ihr Anliegen persönlich${c.phone ? ` – Sie erreichen uns unter ${c.phone}` : ''}.`,
      sign: 'Mit freundlichen Grüßen',
    },
    locker: {
      du: true,
      greet: (c) => `Hey ${c.first}!`,
      posOpen: ['danke dir für die mega Bewertung! 🙌', 'wie cool, vielen Dank für deine {stars} Sterne! 😊'],
      posTopic: ['Freut uns total, dass dir {topic} so gut gefallen hat.', 'Dein Lob für {topic} geben wir direkt ans Team weiter!'],
      posPlain: ['Genau für sowas machen wir das jeden Tag.'],
      posClose: ['Bis zum nächsten Mal!', 'Wir sehen uns!'],
      midOpen: ['danke dir fürs ehrliche Feedback!', 'merci, dass du so offen bist!'],
      midPos: ['Freut uns, dass {topic} gepasst hat.'],
      midIssue: ['{Issue} tut uns echt leid – das war nicht cool von uns.', 'Sorry für {issue}!'],
      midClose: ['Gib uns gern noch eine Chance – wir freuen uns auf dich!'],
      negOpen: ['autsch – sorry, dass es bei dir so gar nicht gepasst hat. 🙈', 'danke, dass du das ansprichst – wir verstehen deinen Ärger total.'],
      negIssue: ['Für {issue} entschuldigen wir uns ehrlich.'],
      contact: (c) => `Melde dich gern direkt bei uns${c.phone ? ` unter ${c.phone}` : ''}, dann klären wir das persönlich.`,
      sign: 'Viele Grüße',
    },
  };

  function analyzeReview(review) {
    const topic = TOPICS.find((t) => t.pos.test(review.text));
    const issue = ISSUES.find((i) => i.re.test(review.text));
    const sentiment = review.stars >= 4 && !(review.stars === 4 && issue) ? 'pos' : review.stars >= 3 ? 'mid' : 'neg';
    return { topic, issue: issue || (sentiment !== 'pos' ? ISSUES[ISSUES.length - 1] : null), sentiment };
  }

  function generateReply(review, settings, variant) {
    const tone = T[review.tone || settings.tone] || T.herzlich;
    const { topic, issue, sentiment } = analyzeReview(review);
    const ctx = {
      first: review.author.split(' ')[0],
      author: review.author,
      phone: settings.phone.trim(),
      stars: review.stars,
    };
    const fill = (s) => s
      .replace('{stars}', ctx.stars)
      .replace('{topic}', topic ? topic.phrase : '')
      .replace('{Issue}', issue ? cap(issue.phrase) : '')
      .replace('{issue}', issue ? issue.phrase : '');
    const v = variant;
    const parts = [];

    if (sentiment === 'pos') {
      parts.push(fill(pick(tone.posOpen, v)));
      parts.push(fill(topic ? pick(tone.posTopic, v + 1) : pick(tone.posPlain, v)));
      parts.push(pick(tone.posClose, v));
    } else if (sentiment === 'mid') {
      parts.push(pick(tone.midOpen, v));
      if (topic) parts.push(fill(pick(tone.midPos, v)));
      parts.push(fill(pick(tone.midIssue, v)), issue.fix[tone.du ? 'du' : 'sie']);
      parts.push(pick(tone.midClose, v));
    } else {
      parts.push(pick(tone.negOpen, v));
      parts.push(fill(pick(tone.negIssue, v)), issue.fix[tone.du ? 'du' : 'sie']);
      parts.push(tone.contact(ctx));
    }

    const signer = settings.signature.trim() || `${tone.du ? 'Dein' : 'Ihr'} Team von ${settings.business}`;
    // Nach "Hallo X," geht es klein weiter, nach "Hey X!" groß.
    const greeting = tone.greet(ctx);
    if (greeting.endsWith('!')) parts[0] = cap(parts[0]);
    return `${greeting}\n\n${parts[0]} ${parts.slice(1, -1).join(' ')}\n\n${parts[parts.length - 1]}\n\n${tone.sign}\n${signer}`.replace(/ {2,}/g, ' ');
  }

  /* ================= Zustand ================= */

  let state = load();
  const ui = { filter: 'open', view: 'inbox', editing: new Map(), typing: new Set(), paused: false };

  function defaultSettings() {
    return { business: 'Ihr Betrieb', industry: 'friseur', tone: 'herzlich', signature: '', phone: '', autoApprove5: false, alertCritical: true, speed: 30 };
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (raw && raw.settings && Array.isArray(raw.reviews)) {
        raw.settings = Object.assign(defaultSettings(), raw.settings);
        return raw;
      }
    } catch (_) { /* ignorieren */ }
    return null;
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* privater Modus */ }
  }

  let idCounter = Date.now();
  function makeReview({ stars, text, createdAt }) {
    const used = new Set(state.reviews.slice(0, 12).map((r) => r.author));
    const free = NAMES.filter((n) => !used.has(n));
    const author = rand(free.length ? free : NAMES);
    return {
      id: `r${idCounter++}`, author, stars, text, createdAt: createdAt || Date.now(),
      status: 'open', variant: 0, draft: '', reply: '', answeredAt: null, auto: false,
      color: rand(AVATAR_COLORS),
    };
  }

  function pickTemplate(starsWanted) {
    const pool = INDUSTRIES[state.settings.industry].reviews;
    let candidates;
    if (starsWanted === 5) candidates = pool.filter((r) => r[0] === 5);
    else if (starsWanted === 3) candidates = pool.filter((r) => r[0] === 3);
    else if (starsWanted === 1) candidates = pool.filter((r) => r[0] <= 2);
    else {
      // Realistische Mischung: ~70 % positiv, ~20 % gemischt, ~10 % Kritik
      const roll = Math.random();
      candidates = pool.filter((r) => (roll < 0.7 ? r[0] >= 4 : roll < 0.9 ? r[0] === 3 : r[0] <= 2));
    }
    // Zuletzt verwendete Texte vermeiden
    const recent = new Set(state.reviews.slice(0, 6).map((r) => r.text));
    const fresh = candidates.filter((r) => !recent.has(r[1]));
    return rand(fresh.length ? fresh : candidates);
  }

  function seedReviews() {
    const now = Date.now();
    const pool = INDUSTRIES[state.settings.industry].reviews;
    const seeds = [
      { t: pool[1], ago: 26 * 3600e3, answered: true },
      { t: pool[2], ago: 20 * 3600e3, answered: true },
      { t: pool[0], ago: 95 * 60e3 },
      { t: pool[6], ago: 38 * 60e3 },
      { t: pool[3], ago: 6 * 60e3 },
    ];
    seeds.forEach((s) => {
      const r = makeReview({ stars: s.t[0], text: s.t[1], createdAt: now - s.ago });
      r.draft = generateReply(r, state.settings, 0);
      if (s.answered) { r.status = 'answered'; r.reply = r.draft; r.answeredAt = r.createdAt + 3 * 3600e3; }
      state.reviews.unshift(r);
    });
  }

  /* ================= Hilfsfunktionen UI ================= */

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('opacity-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('opacity-0'), 3200);
  }

  function timeAgo(ts) {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 45) return 'gerade eben';
    const m = Math.round(s / 60);
    if (m < 60) return `vor ${m} Min.`;
    const h = Math.round(m / 60);
    if (h < 24) return `vor ${h} Std.`;
    const d = Math.round(h / 24);
    return d === 1 ? 'gestern' : `vor ${d} Tagen`;
  }

  function formatDuration(ms) {
    const m = Math.round(ms / 60000);
    if (m < 1) return '< 1 Min.';
    if (m < 60) return `${m} Min.`;
    const h = Math.round(m / 6) / 10;
    return `${h.toLocaleString('de-DE')} Std.`;
  }

  const starsText = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  const fmt1 = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function metrics() {
    const demo = state.reviews;
    const answered = demo.filter((r) => r.status === 'answered');
    const dist = Object.assign({}, BASELINE.stars);
    demo.forEach((r) => { dist[r.stars] += 1; });
    const total = baselineCount + demo.length;
    const sum = Object.entries(dist).reduce((a, [k, v]) => a + Number(k) * v, 0);
    const rate = Math.round(((BASELINE.answered + answered.length) / total) * 100);
    const baseRate = Math.round((BASELINE.answered / baselineCount) * 100);
    const times = answered.map((r) => r.answeredAt - r.createdAt).filter((t) => t > 0);
    const avgResponse = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
    const savedMin = Math.round((answered.length * (MINUTES_PER_MANUAL_REPLY * 60 - SECONDS_PER_APPROVAL)) / 60);
    return { total, newCount: demo.length, avg: sum / total, rate, baseRate, dist, open: demo.filter((r) => r.status === 'open').length, answered: answered.length, avgResponse, savedMin };
  }

  /* ================= Review-Karten ================= */

  function matchesFilter(r) {
    if (ui.filter === 'open') return r.status === 'open';
    if (ui.filter === 'answered') return r.status === 'answered';
    if (ui.filter === 'critical') return r.stars <= 3;
    return true;
  }

  function cardHtml(r) {
    const critical = r.stars <= 3;
    const editing = ui.editing.has(r.id);
    const typing = ui.typing.has(r.id);
    const badge = r.status === 'answered'
      ? `<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">${r.auto ? 'Automatisch beantwortet' : 'Beantwortet'}</span>`
      : `<span class="rounded-full ${critical ? 'bg-rose-50 text-rose-700' : 'bg-brand-50 text-brand-700'} px-2 py-0.5 text-xs font-semibold">${critical ? 'Kritisch · offen' : 'Offen'}</span>`;

    const toneOptions = TONES.map((t) => `<option value="${t.value}" ${(r.tone || state.settings.tone) === t.value ? 'selected' : ''}>${t.label}</option>`).join('');

    const body = r.status === 'answered'
      ? `<div class="mt-4 rounded-xl border-l-4 border-emerald-400 bg-slate-50 p-4">
           <p class="text-xs font-semibold text-slate-500">Antwort des Inhabers · <span data-time="${r.answeredAt}">${timeAgo(r.answeredAt)}</span></p>
           <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">${escapeHtml(r.reply)}</p>
         </div>`
      : `<div class="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
           <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
             <p class="flex items-center gap-2 text-sm font-semibold text-brand-800">
               <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9z"/></svg>
               KI-Antwortvorschlag
             </p>
             <label class="flex items-center gap-2 text-xs font-medium text-slate-600">Tonfall
               <select data-action="tone" class="rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-7 text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" ${typing ? 'disabled' : ''}>${toneOptions}</select>
             </label>
           </div>
           ${editing
             ? `<textarea data-editor rows="8" class="w-full rounded-lg border border-brand-300 bg-white p-3 text-sm leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500" aria-label="Antwort bearbeiten">${escapeHtml(ui.editing.get(r.id))}</textarea>`
             : `<p data-reply class="min-h-[6rem] whitespace-pre-line text-sm leading-relaxed text-slate-800 ${typing ? 'typing-caret' : ''}">${typing ? '' : escapeHtml(r.draft)}</p>`}
           <div class="mt-4 flex flex-wrap gap-2">
             <button type="button" data-action="publish" class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 sm:flex-none" ${typing ? 'disabled' : ''}>
               <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
               ${editing ? 'Speichern &amp; antworten' : '1-Klick-Antworten'}
             </button>
             <button type="button" data-action="edit" class="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" ${typing ? 'disabled' : ''}>${editing ? 'Abbrechen' : 'Anpassen'}</button>
             <button type="button" data-action="regen" class="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" ${typing || editing ? 'disabled' : ''}>Neu formulieren</button>
           </div>
         </div>`;

    return `
      <div class="flex items-start gap-3">
        <div class="grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold ${r.color}">${escapeHtml(r.author.charAt(0))}</div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p class="font-semibold text-slate-900">${escapeHtml(r.author)}</p>
            <span class="text-xs text-slate-500">Google · <span data-time="${r.createdAt}">${timeAgo(r.createdAt)}</span></span>
            <span class="ml-auto">${badge}</span>
          </div>
          <p class="mt-0.5 text-amber-400" aria-label="${r.stars} von 5 Sternen">${starsText(r.stars)}</p>
          <p class="mt-2 text-sm leading-relaxed text-slate-700">${escapeHtml(r.text)}</p>
        </div>
      </div>
      ${body}`;
  }

  function createCard(r, animate) {
    const el = document.createElement('article');
    el.className = `rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${r.stars <= 3 && r.status === 'open' ? 'border-rose-200' : 'border-slate-200'} ${animate ? 'review-new' : ''}`;
    el.dataset.id = r.id;
    el.innerHTML = cardHtml(r);
    return el;
  }

  function updateCard(r) {
    const old = $(`#reviewList [data-id="${r.id}"]`);
    if (!old) return;
    if (!matchesFilter(r)) { old.remove(); renderEmptyState(); return; }
    old.replaceWith(createCard(r, false));
  }

  function renderEmptyState() {
    const list = $('#reviewList');
    $('[data-empty]', list)?.remove();
    if (list.children.length) return;
    const msg = {
      open: ['Alles beantwortet! 🎉', 'Neue Bewertungen erscheinen hier automatisch. Oder senden Sie oben direkt eine Testbewertung.'],
      critical: ['Keine kritischen Bewertungen', 'Mit dem Button „1 ★“ oben können Sie eine kritische Testbewertung auslösen.'],
      answered: ['Noch nichts beantwortet', 'Geben Sie im Filter „Offen“ den ersten KI-Vorschlag frei.'],
      all: ['Noch keine Bewertungen', 'Die erste Testbewertung kommt gleich.'],
    }[ui.filter];
    list.insertAdjacentHTML('beforeend', `<div data-empty class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><p class="font-semibold text-slate-900">${msg[0]}</p><p class="mt-1 text-sm text-slate-500">${msg[1]}</p></div>`);
  }

  function renderList() {
    const list = $('#reviewList');
    list.innerHTML = '';
    state.reviews.filter(matchesFilter).forEach((r) => list.appendChild(createCard(r, false)));
    renderEmptyState();
    $$('.filter-btn').forEach((b) => {
      const active = b.dataset.filter === ui.filter;
      b.setAttribute('aria-selected', String(active));
      b.className = `filter-btn whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`;
    });
  }

  function typeReply(r, done) {
    ui.typing.add(r.id);
    updateCard(r);
    const finish = () => { ui.typing.delete(r.id); updateCard(r); if (done) done(); };
    if (prefersReducedMotion) { setTimeout(finish, 300); return; }
    setTimeout(() => {
      let i = 0;
      const step = () => {
        if (!ui.typing.has(r.id)) return;
        const el = $(`#reviewList [data-id="${r.id}"] [data-reply]`);
        i = Math.min(r.draft.length, i + 4);
        if (el) el.textContent = r.draft.slice(0, i);
        if (i < r.draft.length) setTimeout(step, 14); else finish();
      };
      step();
    }, 900);
  }

  /* ================= Aktionen ================= */

  function publish(r, text, auto) {
    r.status = 'answered';
    r.reply = text.trim() || r.draft;
    r.answeredAt = Date.now();
    r.auto = Boolean(auto);
    ui.editing.delete(r.id);
    save();
    const card = $(`#reviewList [data-id="${r.id}"]`);
    if (card && !matchesFilter(r)) {
      card.style.transition = 'opacity .3s';
      card.style.opacity = '0';
      setTimeout(() => { card.remove(); renderEmptyState(); }, 300);
    } else updateCard(r);
    renderMeta();
  }

  function onListClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.tagName === 'SELECT') return;
    const card = btn.closest('[data-id]');
    const r = state.reviews.find((x) => x.id === card.dataset.id);
    if (!r || r.status !== 'open') return;

    if (btn.dataset.action === 'publish') {
      const text = ui.editing.has(r.id) ? $('[data-editor]', card).value : r.draft;
      publish(r, text, false);
      toast(r.stars <= 3 ? 'Antwort veröffentlicht. Souverän reagiert! 💪' : 'Antwort veröffentlicht – in Sekunden erledigt. 🎉');
    } else if (btn.dataset.action === 'edit') {
      if (ui.editing.has(r.id)) ui.editing.delete(r.id); else ui.editing.set(r.id, r.draft);
      updateCard(r);
      $(`#reviewList [data-id="${r.id}"] [data-editor]`)?.focus();
    } else if (btn.dataset.action === 'regen') {
      r.variant += 1;
      r.draft = generateReply(r, state.settings, r.variant);
      save();
      typeReply(r);
    }
  }

  function onListChange(e) {
    if (e.target.dataset.action !== 'tone') return;
    const r = state.reviews.find((x) => x.id === e.target.closest('[data-id]').dataset.id);
    r.tone = e.target.value;
    r.variant = 0;
    r.draft = generateReply(r, state.settings, 0);
    ui.editing.delete(r.id);
    save();
    typeReply(r);
  }

  function onListInput(e) {
    if (!e.target.matches('[data-editor]')) return;
    ui.editing.set(e.target.closest('[data-id]').dataset.id, e.target.value);
  }

  /* ================= Simulation (Test-Google) ================= */

  const sim = { nextAt: 0, remaining: 0 };

  function scheduleNext() {
    const base = state.settings.speed * 1000;
    sim.nextAt = Date.now() + base * (0.75 + Math.random() * 0.5);
  }

  function receiveReview(starsWanted) {
    const [stars, text] = pickTemplate(starsWanted);
    const r = makeReview({ stars, text });
    r.draft = generateReply(r, state.settings, 0);
    state.reviews.unshift(r);
    save();

    if (matchesFilter(r)) {
      $('[data-empty]', $('#reviewList'))?.remove();
      $('#reviewList').prepend(createCard(r, true));
    }
    renderMeta();

    const autoApprove = state.settings.autoApprove5 && stars === 5;
    typeReply(r, () => {
      if (autoApprove && r.status === 'open') {
        setTimeout(() => { publish(r, r.draft, true); toast(`5 ★ von ${r.author} automatisch beantwortet.`); }, 600);
      }
    });

    if (stars <= 3) {
      toast(`⚠️ Kritische Bewertung (${stars} ★) von ${r.author} – Antwortvorschlag liegt bereit.`);
      if (state.settings.alertCritical && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
        try { new Notification('AIOptim: Neue kritische Bewertung', { body: `${r.author} (${stars} ★): ${r.text.slice(0, 90)}…` }); } catch (_) { /* nicht unterstützt */ }
      }
    } else if (!autoApprove) {
      toast(`Neue Bewertung: ${stars} ★ von ${r.author}`);
    }
  }

  function simTick() {
    if (!state) return;
    if (!ui.paused && Date.now() >= sim.nextAt) { receiveReview(0); scheduleNext(); }
    const secs = Math.max(0, Math.ceil(((ui.paused ? sim.remaining : sim.nextAt - Date.now())) / 1000));
    $('#simCountdown').textContent = ui.paused ? 'pausiert' : secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} Min.` : `${secs} Sek.`;
  }

  function setPaused(p) {
    if (p === ui.paused && sim.nextAt) { simTick(); return; }
    ui.paused = p;
    if (p) sim.remaining = Math.max(0, sim.nextAt - Date.now());
    else sim.nextAt = Date.now() + (sim.remaining || 3000);
    $('#simToggle').textContent = p ? 'Fortsetzen' : 'Pausieren';
    $('#simStatus').textContent = p ? 'Simulation pausiert' : 'Simulation läuft';
    $('#simDot').className = `h-2 w-2 rounded-full ${p ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`;
    simTick();
  }

  /* ================= Statistik, Ranking, Bericht ================= */

  function renderMeta() {
    const m = metrics();
    $$('[data-open-count]').forEach((el) => { el.textContent = m.open; el.classList.toggle('hidden', m.open === 0); });
    document.title = `${m.open ? `(${m.open}) ` : ''}AIOptim Dashboard – Live-Demo`;
    $$('[data-business-name]').forEach((el) => { el.textContent = state.settings.business; });

    const kpi = { open: m.open, avg: `${fmt1(m.avg)} ★`, rate: `${m.rate} %`, saved: `${m.savedMin} Min.` };
    Object.entries(kpi).forEach(([k, v]) => { $(`[data-kpi="${k}"]`).textContent = v; });

    const set = (k, v) => $$(`[data-stat="${k}"]`).forEach((el) => { el.textContent = v; });
    set('total', m.total);
    set('newCount', `davon ${m.newCount} neu in dieser Demo`);
    set('avg', `${fmt1(m.avg)} ★`);
    set('rate', `${m.rate} %`);
    const delta = m.rate - m.baseRate;
    const deltaEl = $('[data-stat="rateDelta"]');
    deltaEl.textContent = delta > 0 ? `▲ ${delta} Prozentpunkte seit Start (${m.baseRate} %)` : `Ausgangswert: ${m.baseRate} %`;
    deltaEl.className = `mt-1 text-xs ${delta > 0 ? 'font-semibold text-emerald-600' : 'text-slate-500'}`;
    set('responseTime', m.avgResponse == null ? '–' : formatDuration(m.avgResponse));
    set('saved', `${m.savedMin} Min.`);
    set('savedNote', `gespart bei ${m.answered} beantworteten Bewertungen in dieser Demo`);

    const max = Math.max(...Object.values(m.dist));
    $('#starBars').innerHTML = [5, 4, 3, 2, 1].map((s) => {
      const n = m.dist[s];
      const pct = Math.round((n / m.total) * 100);
      return `<div class="flex items-center gap-3 text-sm" title="${s} Sterne: ${n} Bewertungen (${pct} %)">
        <span class="w-10 shrink-0 font-medium text-slate-600">${s} ★</span>
        <div class="h-3 flex-1 rounded-full bg-slate-100"><div class="h-3 rounded-full bg-amber-400" style="width:${max ? (n / max) * 100 : 0}%"></div></div>
        <span class="w-20 shrink-0 text-right text-slate-600"><strong class="font-semibold text-slate-900">${n}</strong> · ${pct} %</span>
      </div>`;
    }).join('');

    renderRanking(m);
  }

  function rankingData(m) {
    const ind = INDUSTRIES[state.settings.industry];
    const gain = Math.max(0, m.rate - m.baseRate);
    const improvement = Math.floor(gain / 6) + Math.floor(m.answered / 3);
    return ind.keywords.map((k, i) => {
      const before = ind.basePositions[i];
      const now = Math.max(1, before - Math.max(0, improvement - (i === 2 ? 1 : 0)));
      return { keyword: k, before, now };
    });
  }

  function renderRanking(m) {
    const rows = rankingData(m);
    $('#rankingRows').innerHTML = rows.map((r) => {
      const d = r.before - r.now;
      return `<tr><td class="py-3 pr-4 font-medium text-slate-900">${escapeHtml(r.keyword)}</td><td class="py-3 pr-4 text-slate-500">Platz ${r.before}</td><td class="py-3 pr-4 font-bold text-slate-900">Platz ${r.now}</td>
        <td class="py-3 ${d > 0 ? 'font-semibold text-emerald-600' : 'text-slate-500'}">${d > 0 ? `▲ ${d} ${d === 1 ? 'Platz' : 'Plätze'}` : '–'}</td></tr>`;
    }).join('');

    const best = Math.min(...rows.map((r) => r.now));
    $('#rankingTip').textContent = best <= 3
      ? 'Stark! Sie sind bei mindestens einem wichtigen Suchbegriff in den Top 3 – dort landet der Großteil der Klicks.'
      : m.answered === 0
        ? 'Tipp: Beantworten Sie die offenen Bewertungen im Posteingang und beobachten Sie, wie sich Ihr Ranking hier verändert.'
        : 'Gut unterwegs! Bleiben Sie dran: Regelmäßige Antworten sind eines der stärksten Signale für Google Maps.';

    const ind = INDUSTRIES[state.settings.industry];
    const me = [state.settings.business, m.avg, m.total, m.rate, true];
    const all = ind.competitors.map((c) => [...c, false]).concat([me]).sort((a, b) => b[3] - a[3]);
    $('#competitorRows').innerHTML = all.map((c) => `<tr class="${c[4] ? 'bg-brand-50' : ''}">
      <td class="py-3 pl-2 pr-4 font-medium ${c[4] ? 'text-brand-800' : 'text-slate-900'}">${escapeHtml(c[0])}${c[4] ? ' <span class="text-xs font-semibold">(Sie)</span>' : ''}</td>
      <td class="py-3 pr-4">${fmt1(c[1])} ★</td><td class="py-3 pr-4">${c[2]}</td><td class="py-3 font-semibold">${c[3]} %</td></tr>`).join('');
  }

  function openReport() {
    const m = metrics();
    const rows = rankingData(m);
    const s = state.settings;
    const kw = (r) => { const d = r.before - r.now; return d > 0 ? `<span style="color:#059669;font-weight:600">▲ ${d}</span>` : '<span style="color:#94a3b8">±0</span>'; };
    $('#reportBody').innerHTML = `
      <div class="rounded-xl bg-white p-5 text-sm shadow-sm sm:p-6">
        <p class="text-xs text-slate-500">Von: AIOptim &lt;bericht@aioptim.de&gt;<br />Betreff: Ihr Wochenbericht für ${escapeHtml(s.business)}</p>
        <hr class="my-4 border-slate-100" />
        <p class="font-semibold text-slate-900">Guten Morgen!</p>
        <p class="mt-2 leading-relaxed text-slate-600">Hier ist Ihr Überblick der letzten 7 Tage – in 60 Sekunden gelesen.</p>
        <div class="mt-5 grid grid-cols-3 gap-2 text-center">
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-lg font-bold text-slate-900">${m.newCount}</p><p class="text-[11px] text-slate-500">neue Bewertungen</p></div>
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-lg font-bold text-slate-900">${fmt1(m.avg)} ★</p><p class="text-[11px] text-slate-500">Durchschnitt</p></div>
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-lg font-bold text-slate-900">${m.rate} %</p><p class="text-[11px] text-slate-500">Antwortquote</p></div>
        </div>
        <p class="mt-6 font-semibold text-slate-900">Ihr Ranking bei Google Maps</p>
        <table class="mt-2 w-full text-left text-sm"><tbody class="divide-y divide-slate-100">
          ${rows.map((r) => `<tr><td class="py-2 pr-2 text-slate-700">${escapeHtml(r.keyword)}</td><td class="py-2 pr-2 font-bold text-slate-900">Platz ${r.now}</td><td class="py-2 text-right">${kw(r)}</td></tr>`).join('')}
        </tbody></table>
        <p class="mt-6 font-semibold text-slate-900">Ihre Aufgabe diese Woche</p>
        <p class="mt-1 leading-relaxed text-slate-600">${m.open ? `${m.open} ${m.open === 1 ? 'Bewertung wartet' : 'Bewertungen warten'} auf Ihre Freigabe. Die Antworten sind schon vorbereitet – das dauert keine Minute.` : 'Nichts zu tun – alle Bewertungen sind beantwortet. Weiter so!'}</p>
        <button type="button" data-close class="mt-5 w-full rounded-lg bg-brand-700 py-3 font-semibold text-white hover:bg-brand-800">Zum Posteingang</button>
        <p class="mt-5 text-center text-[11px] text-slate-400">Sie erhalten diese E-Mail jeden Montag um 7:00 Uhr. · Abmelden</p>
      </div>`;
    showModal('reportModal');
  }

  /* ================= Navigation, Modals, Einstellungen ================= */

  const VIEW_TITLES = { inbox: 'Posteingang', stats: 'Statistik', ranking: 'Ranking-Report', settings: 'Einstellungen' };

  function setView(view) {
    ui.view = view;
    $$('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== view));
    $('#viewTitle').textContent = VIEW_TITLES[view];
    $$('.nav-btn').forEach((b) => {
      const active = b.dataset.view === view;
      b.setAttribute('aria-current', active ? 'page' : 'false');
      b.classList.toggle('text-brand-700', active);
      b.classList.toggle('bg-brand-50', active && b.closest('aside'));
      b.classList.toggle('text-slate-600', !active);
    });
    if (view === 'settings') fillSettingsForm();
    window.scrollTo({ top: 0 });
  }

  function showModal(id) {
    const m = document.getElementById(id);
    m.classList.remove('hidden');
    m.classList.add('flex');
    document.body.style.overflow = 'hidden';
    setTimeout(() => m.querySelector('input, button')?.focus(), 30);
  }

  function hideModal(m) {
    m.classList.add('hidden');
    m.classList.remove('flex');
    document.body.style.overflow = '';
  }

  function industryOptions(selected) {
    return Object.entries(INDUSTRIES).map(([k, v]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${v.label}</option>`).join('');
  }

  function toneRadios(name, selected) {
    return TONES.map((t) => `<label class="cursor-pointer">
      <input type="radio" name="${name}" value="${t.value}" class="peer sr-only" ${t.value === selected ? 'checked' : ''} />
      <span class="block rounded-xl border-2 border-slate-200 p-3 text-center text-sm peer-checked:border-brand-700 peer-checked:bg-brand-50 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500">
        <span class="block font-semibold text-slate-900">${t.label}</span><span class="text-xs text-slate-500">${t.hint}</span></span></label>`).join('');
  }

  function fillSettingsForm() {
    const f = $('#settingsForm');
    const s = state.settings;
    f.business.value = s.business;
    f.industry.innerHTML = industryOptions(s.industry);
    f.signature.value = s.signature;
    f.phone.value = s.phone;
    $('#toneOptions').innerHTML = toneRadios('tone', s.tone);
    f.autoApprove5.checked = s.autoApprove5;
    f.alertCritical.checked = s.alertCritical;
  }

  function regenerateOpenDrafts() {
    state.reviews.filter((r) => r.status === 'open').forEach((r) => {
      r.draft = generateReply(r, state.settings, r.variant);
      ui.editing.delete(r.id);
    });
  }

  function initSettings() {
    $('#settingsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const business = f.business.value.trim();
      if (business.length < 2) { toast('Bitte geben Sie den Namen Ihres Betriebs ein.'); f.business.focus(); return; }
      const s = state.settings;
      Object.assign(s, {
        business, industry: f.industry.value, signature: f.signature.value, phone: f.phone.value,
        tone: f.tone.value, autoApprove5: f.autoApprove5.checked, alertCritical: f.alertCritical.checked,
      });
      if (s.alertCritical && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
      regenerateOpenDrafts();
      save();
      renderList();
      renderMeta();
      toast('Gespeichert. Offene Antwortvorschläge wurden neu formuliert.');
    });

    $('#resetDemo').addEventListener('click', () => {
      if (!confirm('Demo wirklich zurücksetzen? Alle Testbewertungen und Einstellungen werden gelöscht.')) return;
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* egal */ }
      location.href = location.pathname;
    });
  }

  function startOnboarding() {
    const form = $('#onboardingForm');
    const prefill = new URLSearchParams(location.search).get('business');
    if (prefill) form.business.value = prefill.slice(0, 80);
    form.industry.innerHTML = industryOptions('friseur');
    $('#obToneOptions').innerHTML = toneRadios('obTone', 'herzlich');
    showModal('onboarding');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const business = form.business.value.trim();
      if (business.length < 2) {
        $('#obError').textContent = 'Bitte geben Sie den Namen Ihres Betriebs ein.';
        $('#obError').classList.remove('hidden');
        form.business.focus();
        return;
      }
      state = { settings: Object.assign(defaultSettings(), { business, industry: form.industry.value, tone: form.obTone.value }), reviews: [] };
      seedReviews();
      save();
      hideModal($('#onboarding'));
      boot();
      toast('Demo gestartet! Die erste neue Bewertung kommt in wenigen Sekunden.');
      sim.nextAt = Date.now() + 8000;
    });
  }

  function boot() {
    $('#simSpeed').value = String(state.settings.speed);
    renderList();
    renderMeta();
    setView('inbox');
    scheduleNext();
    setPaused(false);
    setInterval(simTick, 1000);
    setInterval(() => $$('[data-time]').forEach((el) => { el.textContent = timeAgo(Number(el.dataset.time)); }), 30000);
  }

  function init() {
    $$('.nav-btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $$('.filter-btn').forEach((b) => b.addEventListener('click', () => { ui.filter = b.dataset.filter; renderList(); }));

    const list = $('#reviewList');
    list.addEventListener('click', onListClick);
    list.addEventListener('change', onListChange);
    list.addEventListener('input', onListInput);

    $('#simToggle').addEventListener('click', () => setPaused(!ui.paused));
    $('#simSpeed').addEventListener('change', (e) => {
      state.settings.speed = Number(e.target.value);
      save();
      if (!ui.paused) scheduleNext(); else sim.remaining = state.settings.speed * 1000;
      simTick();
    });
    $$('[data-sim-stars]').forEach((b) => b.addEventListener('click', () => {
      if (ui.filter === 'answered') { ui.filter = 'open'; renderList(); }
      if (ui.view !== 'inbox') setView('inbox');
      receiveReview(Number(b.dataset.simStars));
      if (!ui.paused) scheduleNext();
    }));

    $('#reportBtn').addEventListener('click', openReport);
    $('#reportModal').addEventListener('click', (e) => {
      if (e.target.id === 'reportModal' || e.target.closest('[data-close]')) {
        hideModal($('#reportModal'));
        if (e.target.closest('[data-close]')?.textContent.includes('Posteingang')) setView('inbox');
      }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#reportModal').classList.contains('hidden')) hideModal($('#reportModal')); });

    initSettings();
    if (state) boot(); else startOnboarding();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
