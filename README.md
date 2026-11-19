# Battle Rush 2.0

Eigenständiges kostenloses 2.5D-Crowd-Battle-Spiel für Smartphone, Tablet und Desktop. Inspiriert vom Crowd-Runner-Spielprinzip, ohne Übernahme fremder Marken oder Grafiken.

## Gameplay

- Armee mit Touch/Wischen oder Maus/AD/Pfeiltasten steuern.
- Zwischen Additions- und Multiplikations-Toren wählen.
- Gegnergruppen in **animierten Schlachten** besiegen, nummerierten Fässern und Stachelfeldern ausweichen.
- Bosskampf am Ende jeder Strecke; 5 Leben.
- Münzen für Siege und Kämpfe; im Startmenü dauerhafte Upgrades für Starttruppen und Rüstung.
- Zunehmende Gegnerstärke, neue Hindernisse ab Level 2 und Level-Fortschritt.
- Optionaler synthetischer Ton, Haptik, automatisches Pausieren beim Appwechsel.

## Hosting

GitHub → **Settings → Pages → Deploy from a branch → main → /(root)**. Spiel unter `https://dennodhn.github.io/Battle/`. Reines HTML/CSS/JS mit relativen Pfaden. Kein Backend, keine Drittanbieter-Cookies, kein Login und keine Kosten.

## Technische Hinweise

Canvas 2D-Perspektive mit prozeduralen Miniatur-Soldaten, Schatten, Glanz und Animationen. Offline PWA mit versioniertem Cache, Nutzungsfortschritt über localStorage. Canvas passt sich an Displays an, Pointer Events unterstützen iOS Safari. Systemseitiges `prefers-reduced-motion` gilt für Oberflächenanimationen.