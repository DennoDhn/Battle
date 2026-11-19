# Battle Rush

Ein originales, kostenloses 2.5D-Crowd-Battle-Spiel für Smartphones, Tablets und Desktop. Keine Bibliotheken, kein Backend, keine Werbung und keine In-App-Käufe.

## Spielen

- **Handy / Tablet:** Mit dem Finger nach links oder rechts ziehen.
- **Desktop:** Maus ziehen oder `A` / `D` beziehungsweise Pfeiltasten benutzen.
- **Ziel:** Blaue Soldaten mit `+`- und `×`-Toren vermehren, roten Gegnern und nummerierten Fässern ausweichen oder sie besiegen, am Ende den Boss schlagen.
- **Fünf Leben**, beliebig viele Level, steigende Schwierigkeit, Fortschritts- und Bestlevel-Anzeige, Pause sowie optionaler Sound.

## GitHub Pages

Repository **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/(root)` → Save**. Anschließend läuft das Spiel unter `https://dennodhn.github.io/Battle/`.

## Technik

HTML5 Canvas mit perspektivischer 2.5D-Zeichnung, Pointer Events, responsives HUD, prozedural generierte Mini-Soldaten, ohne externe Abhängigkeiten. Relative Asset-Pfade für GitHub Pages. Installierbare PWA mit Service Worker und Offline-Cache, lokaler Speicherung des Bestlevels und der Toneinstellung.

## Dateien

- `index.html` – Oberfläche und Menüs
- `style.css` – Responsive Design
- `game.js` – Gameplay, Rendering, Steuerung, Sound
- `manifest.webmanifest`, `sw.js`, `icon.svg` – Offline-PWA

Das Spiel ist eine eigene Umsetzung des Crowd-Battle-Genres und nutzt keine Grafiken, Marken oder Programmteile aus dem App-Store-Spiel des Screenshots.