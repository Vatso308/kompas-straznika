# Kompas Strażnika – prototyp 0.1

Nieoficjalne narzędzie szkoleniowe (PWA). Działa na Androidzie i iPhonie, także offline.

## Hosting (darmowy, GitHub Pages), ok. 30 min

1. Załóż konto na github.com.
2. Utwórz nowe repozytorium, np. `kompas-sm`. Może być prywatne, jeśli masz plan, który pozwala na prywatne Pages. W przeciwnym razie publiczne.
3. „Add file” → „Upload files” → wrzuć **całą zawartość** tego folderu (razem z folderem `icons`).
4. Settings → Pages → Source: „Deploy from a branch”, gałąź `main`, folder `/ (root)` → Save.
5. Po 1–2 minutach aplikacja będzie pod adresem `https://TWOJA-NAZWA.github.io/kompas-sm/`.

## Instalacja na telefonie

- **Android (Chrome):** otwórz adres → menu ⋮ → „Zainstaluj aplikację” / „Dodaj do ekranu głównego”.
- **iPhone (Safari):** otwórz adres → przycisk Udostępnij → „Do ekranu początkowego”.

Po pierwszym otwarciu z internetem aplikacja działa bez sieci.

## Aktualizacja bazy

1. Edytuj `data.json` (zmień też `dataBazy`).
2. W `sw.js` podbij numer w `CACHE` (np. `kompas-v0.2`).
3. Wgraj oba pliki do repozytorium. Telefony pobiorą nową bazę przy następnym otwarciu z internetem.

## Status wpisów

Każdy wpis ma `"status": "szkic"`. Po sprawdzeniu przez członka grupy zmień na `"zweryfikowany"`.
Aplikacja pokaże wtedy zielony znacznik.
