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
| `app.html` + `assets/dashboard.js` | **Live-Demo des Dashboards** – ohne Anmeldung, mit simulierten Google-Bewertungen |

### Funktionen in `assets/app.js`

- **Gratis-Analyse**: akzeptiert Firmennamen oder Google-Maps-Links (`/maps/place/…`, `maps.app.goo.gl`), validiert die Eingabe, zeigt einen Analyse-Ablauf und einen Sichtbarkeits-Score. Die Werte sind eine **deterministische Vorschau** (gleiche Eingabe → gleiches Ergebnis), keine echten Google-Daten. Danach geht es direkt in die Registrierung, der Firmenname ist schon eingetragen.
- **Interaktive Demo**: drei Beispiel-Bewertungen (Lob/gemischt/Kritik), Tonfall-Wahl (herzlich, professionell, locker), Antwort neu generieren, im Textfeld anpassen und mit einem Klick freigeben.
- **Registrierung & Lead-Erfassung**: Modal mit Tarifwahl und Footer-Formular, Validierung, Einwilligungs-Checkbox, Erfassung von UTM-Parametern und `gclid`, Erfolgsansicht mit Onboarding-Schritten und Testende-Datum.
- **Preise**: Umschalter monatlich/jährlich. Jeder Tarif-Button öffnet die Registrierung mit vorausgewähltem Tarif.
- **FAQ**: barrierearmes Akkordeon und automatisch erzeugtes `FAQPage`-Schema (JSON-LD) für Google.
- Mobiles Menü, Sticky-CTA auf dem Handy, Fokus-Falle und Schließen per Escape in Modals, Unterstützung für `prefers-reduced-motion`.

### Live-Demo (`app.html`)

Öffnen Sie `http://localhost:8000/app.html` oder klicken Sie auf der Landingpage auf „Live-Demo“.

- **Test-Google**: Nach und nach gehen simulierte Bewertungen ein, alle 15 Sekunden bis 2 Minuten, einstellbar und pausierbar. Mit den Knöpfen „Zufällig“, „5 ★“, „3 ★“ und „1 ★“ lösen Sie sofort eine Bewertung aus.
- **KI-Antworten**: Eine lokale Vorlagen-Engine erkennt Lob und Kritik (Freundlichkeit, Wartezeit, Erreichbarkeit, Preis …) und formuliert passend. Den Tonfall wählen Sie pro Bewertung, außerdem können Sie neu formulieren, die Antwort anpassen oder sie mit einem Klick freigeben.
- **Posteingang** mit Filtern (offen, kritisch, beantwortet), Kennzahlen, **Statistik**, **Ranking-Report** mit Mitbewerbern und einer Vorschau auf die wöchentliche E-Mail.
- **Einstellungen**: Betrieb, Branche (Friseur, Handwerk, Fahrschule, Restaurant, KFZ), Unterschrift, Telefon, Tonfall, Auto-Antwort auf 5 Sterne, Browser-Alarm bei Kritik und Zurücksetzen der Demo.
- Alles wird im `localStorage` (`aioptim_demo_v1`) gespeichert. Ranking- und Mitbewerberzahlen sind simuliert.

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
