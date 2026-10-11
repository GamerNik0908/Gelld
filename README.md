# AIOptim – Landingpage & Web-App-Logik

B2B-Micro-SaaS-Landingpage für lokale Kleinunternehmer (Handwerk, Friseure, Fahrschulen, Gastronomie): Google-Bewertungen automatisch überwachen, per KI beantworten, lokale Sichtbarkeit steigern.

## Starten

Kein Build nötig – reines HTML + Tailwind (CDN) + Vanilla JS.

```bash
python3 -m http.server 8000   # dann http://localhost:8000 öffnen
```

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Alle Sektionen: Header/Navigation, Hero mit Gratis-Analyse & interaktiver Demo, Problem, Feature-Matrix, Kundenstimmen, Preise, FAQ, Lead-Catcher, Footer, Modals |
| `assets/app.js` | Logik der Landingpage (siehe unten) |
| `login.html` + `assets/auth.js` | Login-Seite und Anmelde-Logik |
| `app.html` + `assets/dashboard.js` | Dashboard (nur nach Anmeldung erreichbar) |

### Funktionen in `assets/app.js`

- **Gratis-Analyse**: akzeptiert Firmennamen oder Google-Maps-Links (`/maps/place/…`, `maps.app.goo.gl`), validiert die Eingabe, zeigt einen Analyse-Ablauf und einen Sichtbarkeits-Score. Die Werte sind eine **deterministische Vorschau** (gleiche Eingabe → gleiches Ergebnis), keine echten Google-Daten. Danach geht es direkt in die Registrierung, der Firmenname ist schon eingetragen.
- **Interaktive Demo**: drei Beispiel-Bewertungen (Lob/gemischt/Kritik), Tonfall-Wahl (herzlich, professionell, locker), Antwort neu generieren, im Textfeld anpassen und mit einem Klick freigeben.
- **Registrierung & Lead-Erfassung**: Modal mit Tarifwahl und Footer-Formular, Validierung, Einwilligungs-Checkbox, Erfassung von UTM-Parametern und `gclid`, Erfolgsansicht mit Onboarding-Schritten und Testende-Datum.
- **Preise**: Umschalter monatlich/jährlich. Jeder Tarif-Button öffnet die Registrierung mit vorausgewähltem Tarif.
- **FAQ**: barrierearmes Akkordeon und automatisch erzeugtes `FAQPage`-Schema (JSON-LD) für Google.
- Mobiles Menü, Sticky-CTA auf dem Handy, Fokus-Falle und Schließen per Escape in Modals, Unterstützung für `prefers-reduced-motion`.

### Login & Dashboard

Über „Anmelden“ auf der Landingpage oder direkt unter `http://localhost:8000/login.html`.

**Vorab angelegter Benutzer:**

| E-Mail | Passwort |
|---|---|
| `demo@aioptim.de` | `Demo1234!` |

- Ohne Anmeldung leitet `app.html` automatisch zum Login um.
- „Angemeldet bleiben“ speichert die Sitzung dauerhaft im Browser, sonst gilt sie nur bis zum Schließen des Tabs.
- Im Dashboard gibt es Posteingang, Statistik und Ranking-Report (alle leer, bis Google angebunden ist) sowie Einstellungen (Betrieb, Branche, Unterschrift, Telefon, Tonfall, Auto-Antwort, Alarm). Die Einstellungen werden pro Benutzer im `localStorage` gespeichert.
- Weitere Benutzer legen Sie in `assets/auth.js` im Array `USERS` an.

> **Wichtig:** Die Anmeldung läuft nur im Browser. Benutzer und Passwort stehen im Quelltext und sind für jeden lesbar. Das reicht zum Testen, ist aber **kein Schutz**. Vor dem Livegang muss die Anmeldung auf einen Server umziehen (Passwort-Hash in einer Datenbank, Session-Cookie).

### Backend anbinden

Ohne Konfiguration landen Leads im `localStorage` (`aioptim_leads`), und die Antworten kommen aus lokalen Vorlagen. Für den Produktivbetrieb **vor** `assets/app.js` einbinden:

```html
<script>
  window.AIOPTIM_CONFIG = {
    leadEndpoint: '/api/leads',   // POST JSON {email, business?, plan, billing, source, utm, createdAt, page}
    replyEndpoint: '/api/reply',  // POST JSON {review:{author,stars,text}, tone} -> {reply: "..."}
  };
</script>
```

Der `replyEndpoint` sollte serverseitig ein LLM aufrufen. API-Schlüssel gehören nie in den Browser. Schlägt der Endpoint fehl, nutzt die Demo automatisch die lokalen Vorlagen.

Tracking-Events (`analysis_started`, `signup_opened`, `trial_signup`) werden als `aioptim:track`-DOM-Event ausgelöst und an Plausible weitergegeben, falls es eingebunden ist.

## Vor dem Livegang

- **Kundenstimmen ersetzen**: Die drei Testimonials sind Beispieltexte. Gefälschte Bewertungen sind nach UWG unzulässig, deshalb nur echte, freigegebene Stimmen verwenden.
- **Rechtsseiten**: Impressum, Datenschutz, AGB und AVV verlinken derzeit auf Anker. Echte Seiten anlegen.
- **Leistungsversprechen prüfen**: Angaben wie „Server in der EU (Frankfurt)“, SMS-Alarm und Standortanzahl müssen dem tatsächlichen Produkt entsprechen.
- **Tailwind**: Das Play-CDN ist für Prototypen gedacht. Für Produktion mit der Tailwind-CLI ein statisches CSS bauen (die Konfiguration steht im `<head>`). Das verbessert auch die Ladezeit.
- **Google Fonts**: Für strikte DSGVO-Konformität die Schrift „Inter“ lokal hosten statt von Google laden.
