# Battle Rush 4.0

Eigenständiges, kostenloses und offlinefähiges Crowd-Battle-Arcadespiel für GitHub Pages.

## Spielen

Öffne `https://dennodhn.github.io/Battle/` oder `index.html` über einen lokalen HTTP-Server. Berühre die Straße oder ziehe links/rechts, um die blaue Armee zu lenken. Passiere positive Tore, um Soldaten zu vervielfachen. Meide Stacheln, Minen und nummerierte Fässer. Besiege die roten Truppen und den Boss.

## Neu in Version 4.0

- Aufladbare **Verstärkung** als optionaler, sichtbarer Button (Tastatur: Leertaste)
- **Rekrutierungsbanner** (+Soldaten), **Schatzkisten** (+Münzen) und ausweichbare **Minen**
- Spezielle **Belagerungstruppen** auf späteren Leveln
- Zwei neue Themen: **Frostpass** und **Wüstenzitadelle** (insgesamt sechs)
- Bonusziele für drei bis fünf Tore und dauerhafte Level-Medaillen
- Viertes Upgrade: **Sammelmagnet** für größere Sammelreichweite
- Relatives Touch-Ziehen ohne anfängliches Verspringen, zusätzliches Tippen auf die gewünschte Spur
- Reduzierte häufige HUD-Neuzeichnungen und erweitertes Diagnosemodell

## Speicherung

Fortschritt, Münzen, Upgrades und Medaillen liegen lokal im Browser-Speicher. Es werden keine Konten, Tracker, Werbung oder externen APIs eingesetzt. Die bisherigen V2/V3-Speicherstände werden gelesen und um V4-Felder erweitert.

## Technische Hinweise

Vanilla JS + Canvas 2D, kein Backend, keine Abhängigkeiten, keine Build-Tools. GitHub Pages: `main` / `(root)` veröffentlichen. Der Service Worker nutzt einen versionsgetrennten Cache (`battle-rush-v4.0`).