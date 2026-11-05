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

## C1-LIVE — odrębne Studio, *jedna* żywa gra (6 XI 2026)

**Kolejny, odrębny eksperyment, NIE realizacja w starej Jaskini ani w październikowym Coopege.** Używa tego samego historycznego dawcy Tibia v14.1. Tym razem gra działa w osobnej sandboxowanej ramce, a małe Studio w drugiej; Studio **nie uruchamia kopii silnika**. Przez ograniczone wiadomości `postMessage` edytuje rzeczywiste `TibiaMapAPI` jedynego runtime.

Reprodukowalne źródła w tej samej gałęzi: `live_shell_template.html`, `live_editor_template.html`, `live_game_bridge_snippet.html`, `live_bootstrap_template.html`, generator `build_live_c1.py`, automatyczny smoke `smoke_live_c1.py`. Nie kopiujemy całego historycznego silnika do repo Jaskini: należy go przekazać jako wejście ze znanego `Coopege/main/legacy/reference/Tibia_Enhanced_v14_1_DevAPI.html` (blob Git `ee03e6250585d8ee9d5965d17abf73e1c0403cdc`, SHA-256 `cd7d0d7527847ebd3f4ddb2c5a8c18d292517815c4989b8f4bd40b0fc5ce900c`).

```text
python build_live_c1.py Tibia_Enhanced_v14_1_DevAPI.html --out C1-lokalny.html
python smoke_live_c1.py Tibia_Enhanced_v14_1_DevAPI.html
```

Przy dokładnie wskazanym donorze i obecnych źródłach generator dał **464057 B**, SHA-256 `7eb8b2b3e749200399ec874ae3562bb385a9827ff8530dbe3bbba88af832723a`; porównano bajty z samodzielnym HTML-em użytym do testu. Test Chrome/Chromium: **PASS** odczytu i edycji pola, rzeczywistego cofnięcia nawet przy oryginalnym tile `5` (drewno), ochrony przed `STALE_WRITE`, odzyskania patcha po reload *samej ramki gry*, contextualizacji edytora przy aktywnym wojowniku, braku respawnu 338 potworów po punktowej edycji, oraz odzyskania fokusu bez niezamierzonego click-to-move (po powrocie `D` porusza postać). Bez błędów JS w badanym przebiegu.

**Ważna negatywna lekcja:** pierwsza wersja ograniczała również undo do terenów `0/4`; przy zmianie drewnianej posadzki `5→4` nie dawało się jej przywrócić. Naprawiono zakres akceptacji *poprzednich wartości* zgodnie z `TibiaMapAPI.getCapabilities().maxTile` i powtórzono test `5→4→5` — PASS. Nie kopiować z poligonu arbitralnego ograniczenia palety przy cofnięciu.

**Ważna druga lekcja:** samo kliknięcie ramki gry przy powrocie z edytora wydało komendę ruchu postaci. Sam `iframe.focus()` z powłoki nie wystarczył. Dodatkowa, jawna wiadomość `focus` do instrumentu i fokusu ustawionego *przez samą grę* na canvas zadziałała bez kliknięcia w świat.

**Granice:** test używał `page.set_content`, `srcdoc` i sandboxowanych origins `null`, **nie** dwóch rzeczywistych domen HTTP(S), produkcyjnego kontraktu zabezpieczeń, normalnego `file://` ani Opery właściciela. Odświeżenie tylko ramki gry działa; nie wykazano długotrwałej trwałości świata po pełnym zamknięciu strony i nie zapisuje to postaci. To nie jest jeszcze prawdziwa Jaskinia ani 26-X Coopege i nie uprawnia do uznania nowej koncepcji Studio za gotową. Mapy nie walidowano pod kątem każdej konsekwencji przebudowania szlaków i interakcji NPC. Własność danych świata powinna pozostać jawna, nie być automatycznie przejmowana przez powłokę.

Kontekst użytkowy i feedback dla nowej Jaskini: [issue #2](https://github.com/Jozzpoly/Jaskinia/issues/2). Hipoteza: **najbardziej wartościową jednostką integracji może być możliwość tworzenia w miejscu, zdarzeniu lub przedmiocie, który właściciel właśnie zauważył w grze**, z płynnym powrotem do sterowania, a nie sama ramka HTML. To należy sfalsyfikować praktycznym użyciem na Coopege i drugim odmiennym projekcie, nie zamrażać jako uniwersalnego API.
