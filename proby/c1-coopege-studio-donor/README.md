# C1 — Tibia Studio jako dawca dla Coopege/Jaskini (2026-11-05)

**STATUS: izolowany test dawcy, nie fundament nowego Studio; nie zmienia main ani działającej Jaskini.**

**Pytanie:** czy historyczne Tibia Developer Studio v3.1 naprawdę tworzy odtwarzalny build z modyfikacją świata w rzeczywistym silniku Tibia v14.1? Ten najprostszy szczebel należy zweryfikować przed próbą nowego Studio i dwóch okien z jednym światem.

## Źródła (nie kopiować do Jaskini)

Dokładne publiczne pliki z `Jozzpoly/Coopege/main`:

- `legacy/reference/Tibia_Developer_Studio_v3_1.html` — Git blob `b5fd22e9b0c597994ef6a8a43737c76f0e3a2efc`, SHA-256 `1364ee817bcbb73c0403d0d9e6006a7a63e324642b892560b15edc2288a12c47`;
- `legacy/reference/Tibia_Enhanced_v14_1_DevAPI.html` — Git blob `ee03e6250585d8ee9d5965d17abf73e1c0403cdc`, SHA-256 `cd7d0d7527847ebd3f4ddb2c5a8c18d292517815c4989b8f4bd40b0fc5ce900c`.

Te bajty zostały niezależnie odzyskane z Biblioteki właściciela i `git hash-object` potwierdził zgodność z GitHubem. W Bibliotece gra nazywała się `Tibia_Enhanced_v14_1_DevAPI(2).html`.

## Wynik wykonany 2026-11-05 — PASS w badanym zakresie

Izolowany headless Chromium, bez sieci, `page.set_content` (nie test hostingu):

1. Załadowanie Studio i pliku gry: `TibiaAssetAPI`, `TibiaMapAPI`, `TibiaContentAPI`, `TibiaProjectAPI` obecne. Studio pokazało silnik `14.1.0`, 45 assetów, mapę 200×200, pięć pięter, sześć typów potworów; bez `pageerror`.
2. UI „Edytor mapy”: pędzel, punkt `z=0, x=30, y=83`, trawa (0) → ziemia (4). Undo aktywne.
3. Przed „Zastosuj” runtime miał tile 0; po „Zastosuj mapę w grze” runtime miał tile 4; Studio zgłosiło zaakceptowany projekt i pełne testy mapy.
4. „Zapisz build gry” dał samodzielny HTML 665719 B. Cold-open tego HTML w **nowej** stronie odczytał tile 4 bez `pageerror`.
5. Równoległy czysty egzemplarz gry nadal odczytywał tile 0. **Czytelny dowód, że Studio edytuje własny runtime, nie drugi uruchomiony świat.**

Test nie używał prawdziwych danych/zapisów użytkownika i nie nadpisywał Biblioteki. Skrypt: `smoke_legacy.py`. Uruchomienie: `python smoke_legacy.py /sciezka/do/Tibia_Developer_Studio_v3_1.html /sciezka/do/Tibia_Enhanced_v14_1_DevAPI.html`; wymaga Python Playwright i Chromium. W razie potrzeby `CHROMIUM_EXECUTABLE=/usr/bin/chromium`.

## Granice

- **Nie uruchomiono** połączenia historycznego Studio z eksperymentem Coopege 26 X; źródłowy audyt 4 `Tibia*API` nie zastępuje próby uruchomienia.
- **Nie uruchomiono** historycznego Studio w *rzeczywistym* oknie starej Jaskini; to osobne pytanie niż aktualna próba P1.
- `page.set_content` nie reprezentuje `file://`, pełnego adresu `https://`, iframe third-party ani trwających zapisów w różnych origins.
- Zapis world-build nie oznacza zachowania postaci, F2 patcha, aktywnej symulacji, sesji ani współedytowania żywego świata.
- Nie badałem wygody Studia dla człowieka ani współczesnego feel Coopege.

**Wyższy cel:** odizolować rozwój gry od warsztatu, a w starej Jaskini sprawdzać realną pętlę autorstwa i powrotu. Raport i ograniczenia przekazane nowej Jaskini: [issue #2](https://github.com/Jozzpoly/Jaskinia/issues/2).
