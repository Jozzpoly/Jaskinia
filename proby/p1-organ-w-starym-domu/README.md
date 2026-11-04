# P1 — organ nowej Jaskini w oknie starej

**Status: próba.** Sprawdza jedno założenie etapu 1 z planu budowy v2 (§6a): czy strona z nowego repo może żyć w oknie starej Jaskini i rozmawiać z nią przez jej *kontrakt przyrządu* (v1), bez żadnej zmiany w starym kodzie.

## Wynik (4 XI 2026, Opus w czacie)

Starą Jaskinię zbudowałem z jej źródeł (`Jozzpoly/Jozz-Cave-Workbench`, `main`: `tools/render.py --app jaskinia --host web`) i uruchomiłem w Chromium (Playwright). Potem:

| Pytanie | Wynik |
| --- | --- |
| Czy stara Jaskinia wystawia API dla zewnętrznych stron? | tak, `window.Jaskinia.ext` |
| Czy otwiera obcą stronę w swoim oknie bez zmian w kodzie? | tak: `Jaskinia.ext.open('przyrzad', { fresh: true, st: { url } })` |
| Czy organ może się przedstawić? | tak: po `Jaskinia.hello(...)` stara Jaskinia zapamiętała go pod jego własną nazwą |
| Czy stara Jaskinia odpowiada organowi? | tak, organ dostał `{"jaskinia":1,"type":"hi","v":1}` |
| Błędy w konsoli | brak |

## Granice

- Obie strony stały na tym samym adresie (`127.0.0.1`). Prawdziwy układ to inny origin (Cloudflare Workers obok GitHub Pages). Kontrakt używa `postMessage` z `'*'`, więc powinien działać, ale nie zostało to sprawdzone. Trzeba też sprawdzić, czy nagłówki hosta organu pozwalają na osadzenie.
- Nie sprawdziłem dalszej części kontraktu (stan, sygnały, uwagi właściciela wracające do organu) ani telefonu.
- `organ.html` ładuje skrypt kontraktu `jaskinia-przyrzad.js` ze starego repo (`docs/przyrzad/`). Do uruchomienia trzeba go położyć obok.

## Uruchomienie

1. Zbuduj starą Jaskinię z jej repo (`npm ci --ignore-scripts`, potem `python3 tools/render.py --app jaskinia --host web --out <katalog>/jaskinia.html`).
2. Do tego samego katalogu skopiuj `organ.html` i `docs/przyrzad/jaskinia-przyrzad.js`.
3. `python3 sprawdz.py` (wymaga Playwright dla Pythona; skrypt sam uruchamia serwer na porcie 8765).

**Zburzymy ją, gdy** prawdziwy organ (warsztat parametrów albo biurko) przejmie to sprawdzenie albo wariant z przeniesieniem Domu wróci.
