# Battle Rush 3.0 – Crowd Battle

Eigenständiges kostenloses 2.5D-Crowd-Battle-Spiel für Smartphone, Tablet und Desktop. Inspiriert vom Crowd-Runner-Prinzip, **ohne Originalgrafiken, Marken oder kopierte Assets**. GitHub Pages, kein Backend, keine Werbe- oder Trackingdienste.

## Steuerung und Spiel
- Armee mit Fingerwischen / Mausziehen / Pfeiltasten oder A und D lenken.
- Positive `+`/`×`-Rechentore durchlaufen, gelegentlichen roten `−`-Toren ausweichen.
- Blaue Armee gegen rote Truppen und Eliteeinheiten antreten lassen. Boss am Levelende.
- Münzen, Schild-Power-ups und Herzen einsammeln; Schild fängt ein Hindernis ab.
- Feuermodus: fünf erfolgreiche Tore laden einen zeitlich begrenzten Kampfbonus.
- 5 Leben; steigende Gegnerzahlen, vier wechselnde Umgebungen, gefährlichere Strecken.
- Drei dauerhafte Upgrades: Starttruppen, Rüstung, Münzenbonus.
- Fortschritt im Browser gespeichert: höchster Level, Münzen, Siege und Verbesserungen.
- Startet ab zuletzt freigeschaltetem Level; über Menü jederzeit Level 1 wiederholen.
- Gold-/Silber-/Bronze-Medaillen und Extrabelohnung für eine saubere Runde.
- Optionale synthetische Geräusche, Haptik, automatische Pause bei Appwechsel.

## Hosting
Repository-Einstellungen → **Pages → Deploy from a branch → main → /(root)**.
Spiel-URL: `https://dennodhn.github.io/Battle/`.
Relative Asset-Pfade funktionieren auch unter Projektpfaden.

## Technik
Native Canvas-2D-Perspektive; Soldatenanimationsframes werden einmalig als Sprites gerendert. Kein JS-Framework, kein CDNs, keine externen Ressourcen. Responsive Gestaltung, Pointer-Steuerung und PWA-Service-Worker mit versioniertem Offline-Cache. Spielstand bleibt kompatibel mit der v2-`localStorage`-Kennung `battle-rush-save-v2`.

## Testen
Lokal per HTTP-Server starten, z. B. `python3 -m http.server 8000`, danach `http://localhost:8000` öffnen. Für Testautomatisierung steht `window.__battleDiagnostics` als read-only Debugzustand bereit.