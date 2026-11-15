# Umowa kroku 1: rzeczy, przestrzeń, słowo, cofnięcie

Status: **próba** (zob. [TYMCZASOWE.md](../TYMCZASOWE.md)). Ten plik jest umową między tym, kto pisze
sprawdziany, tym, kto buduje moduł, i tym, kto sprawdza. Kod, który jej nie spełnia, nie wchodzi na gałąź.
Sama umowa też jest do podważenia: zmiana idzie przez ten plik, z powodem, nie przez ciche odstępstwo w kodzie.

Stoi na rdzeniu z dawcy ([`worker/miejsce.mjs`](../worker/miejsce.mjs): zapis, akt, głowa) i niczego do niego
nie dopisuje. Kształt rdzenia opisuje [szkic rdzenia zapisów](rdzen-zapisow-szkic.md), a mierzy go
`tools/umowa-rdzenia.mjs`.

## 0. Zakres: cztery punkty, stały budżet

1. Siedem rzeczy, każda ze stałym adresem i stroną tej samej budowy.
2. Położenie, rozmiar i zwinięcie karty jako głowa właściciela, takie samo na telefonie i komputerze.
3. Słowo właściciela przy rzeczy i odpowiedź agenta przez te same drzwi, pod imieniem z klucza.
4. Cofnięcie ruchu właściciela, także po przeładowaniu i z drugiego urządzenia.

**Poza krokiem 1** (kto dokłada, mówi, co wypada): okna i trasa narzędzia, rodziny, presety, ruch wielu kart
jednym gestem, pełne poziomy szczegółowości, doręczenie (adresat, budzi albo czeka), wpuszczanie urządzeń
i agentów kliknięciem, zbieracz faktów, wersje i buildy rzeczy, statystyki, wyszukiwanie.

## 1. Zasady, które obowiązują każdy moduł

Każda ma za sobą pomiar albo doświadczenie z poprzednich prób; numer w nawiasie to sprawdzian z części 7.

1. **Wynik jest obiektem, nie wyjątkiem.** Sukces: `{ ok: true, ... }`. Porażka: `{ ok: false, status, blad, ... }`,
   gdzie `status` to kod HTTP, a `blad` to zdanie po polsku, które mówi, co zrobić. Moduły nie znają HTTP.
2. **Autor i czas nadają drzwi.** Pola `kto` i `kiedy` biorą się z klucza i z zegara serwera. Pole o tej
   nazwie w treści żądania jest ignorowane (S11).
3. **Każda czynność ma `op`.** Powtórzone dostarczenie tej samej czynności daje ten sam skutek
   i `powtorzone: true`, nigdy drugi akt (S6).
4. **Lista mówi, ile ma pozycji i ile pokazuje:** `razem` i `pokazane`. Obcięcie jest widoczne (S3).
5. **Przycięcie wartości jest widoczne.** Zakresy są szerokie; gdy wartość wychodzi poza zakres, moduł ją
   przycina i wypisuje w `przyciete`, nie odrzuca po cichu i nie udaje, że przyjął.
6. **GET niczego nie zmienia** (S16). Samo otwarcie adresu nie zapisuje aktu ani odczytu.
7. **Treść dla agenta leży w zwykłym tekście strony:** nie w ramce, nie w zwiniętej sekcji, nie w skrypcie
   i nie w pamięci przeglądarki (S3).
8. **Strona mówi, kiedy jest gotowa i ile pokazuje:** `data-gotowe="tak"` oraz liczby w `data-...` na `<body>`.
   Powód: 15 XI sprawdzacz zmierzył stronę, zanim dorysowała karty, i podał 6 elementów zamiast 17 (K1).
9. **Próba jest podpisana jako próba** na każdej stronie, razem ze zdaniem, że klucze podglądu są jawne
   i nic prywatnego tu nie trafia (S14).
10. **Format ma wersję.** Każda treść zapisu ma pole `w`. Zmiana kształtu to nowy numer i droga migracji.
11. **Nieznane czeka.** Karta wskazująca rzecz, której nie ma, zostaje w układzie z oznaczeniem, a nie znika.

## 2. Adresy

Wzór jest stały i taki sam dla każdej rzeczy: kto zna jeden adres, zgadnie następny.

| Adres | Co pod nim jest |
| --- | --- |
| `/rzeczy` | spis rzeczy, strona |
| `/rzecz/<id>` | strona rzeczy, ta sama budowa dla każdej |
| `/rzecz/<id>.json` | to samo jako dane |
| `/rzecz/<id>/slowo` (POST, formularz) | zostawienie słowa bez JavaScriptu |
| `/przestrzen/<nazwa>` | płaszczyzna z kartami; w kroku 1 tylko `glowna` |
| `/wejdz`, `/wyjdz` | wejście i wyjście z kluczem w przeglądarce |
| `/api/miejsce/...` | drzwi: dane i czynności (część 4) |

`<id>` rzeczy: `^[a-z0-9][a-z0-9_.-]{0,79}$`. Dla rzeczy z repozytorium to nazwa repozytorium małymi literami,
więc stary adres `#repo~Nazwa` przekłada się jeden do jednego. `<nazwa>` przestrzeni: `^[a-z0-9][a-z0-9_-]{0,39}$`.

## 3. Zapisy

Treść zapisu to JSON w postaci kanonicznej: klucze posortowane rekurencyjnie, bez spacji (`kanon()`
w `worker/ksztalty.mjs`). Powód: tożsamość zapisu to skrót treści, więc ta sama rzecz musi dać ten sam tekst.

### 3.1 `rzecz` (w: 1), głowa `wspolne:rzecz/<id>`

```json
{ "w": 1, "id": "combat-lab", "nazwa": "...", "czym_jest": "...", "repo": "Wlasciciel/Combat-Lab",
  "wejscie": { "adres": "https://...", "rodzaj": "strona" },
  "telefon": { "stan": "tak", "skad_wiem": "..." },
  "zrodlo": { "plik": "public/wejscia.json", "commit": "<sha>", "sprawdzone": "2026-11-15" } }
```

`repo` i `wejscie` mogą być `null`. `telefon.stan`: `tak`, `nie` albo `nieznane`. `wejscie.adres` musi być `https:`.
`nazwa` 1 do 200 znaków, `czym_jest` do 2000.

### 3.2 `miejsce-karty` (w: 1), głowa `jozz:przestrzen/<nazwa>/<id>`

```json
{ "w": 1, "rzecz": "combat-lab", "x": 0, "y": 0, "szer": 240, "wys": 150, "zwinieta": false }
{ "w": 1, "rzecz": "combat-lab", "auto": true }
```

- Jednostki płaszczyzny, liczby całkowite (ułamki są zaokrąglane). Nigdy ułamki ekranu.
- Zakresy: `x`, `y` od -10 000 000 do 10 000 000; `szer`, `wys` od 40 do 100 000. Poza zakresem: przycięcie
  i wpis w `przyciete`.
- `zwinieta: true` zostawia `x`, `y`, `szer`, `wys` bez zmian. Rozwinięcie przywraca dokładnie to, co było.
- Druga postać (`auto: true`) znaczy: karta stoi tam, gdzie kładzie ją automat. Karta bez głowy też.
- Przybliżenie widoku nie jest polem karty. To stan oka, osobny na każdym urządzeniu.

### 3.3 `slowo` (w: 1), bez głowy

```json
{ "w": 1, "tekst": "...", "o": "rzecz/combat-lab", "do": [],
  "nawiazuje": { "zapis": "<64 znaki szesnastkowe>", "jako": "odpowiedz" } }
```

- `tekst`: po obcięciu białych znaków 1 do 20 000 znaków. Dłuższy: `413`, bez cichego ucinania.
- `do`: lista imion, może być pusta. W kroku 1 niczego nie doręcza; pole jest po to, żeby format nie musiał
  się zmieniać, gdy doręczenie przyjdzie.
- `nawiazuje`: `null` albo wskazanie innego słowa o tej samej rzeczy. `jako`: `odpowiedz`, `dopisek`
  albo `poprawka`. Dopisek i poprawka są nowym zapisem, stary zostaje.
- Autor i czas są w akcie, nie w treści.

## 4. Drzwi

Wszystko pod `/api/miejsce/` wymaga klucza: nagłówek `Authorization: Bearer <klucz>` albo ciasteczko
`jaskinia_klucz` ustawione przez `/wejdz`. Bez klucza: `401`, także przy czytaniu. Żądanie zmieniające stan
z ciasteczkiem musi mieć nagłówek `Origin` równy adresowi strony, inaczej `403`.

| Metoda i ścieżka | Ciało | Sukces | Porażki |
| --- | --- | --- | --- |
| `GET /api/miejsce/rzeczy` | | `{ razem, pokazane, rzeczy: [{ id, glowa, wersja, zapis, rzecz, slow }] }` | |
| `GET /api/miejsce/rzecz/<id>` | | `{ id, glowa, wersja, zapis, rzecz, slowa, historia }` | `404` |
| `POST /api/miejsce/rzecz/<id>/slowo` | `{ op, tekst, do?, nawiazuje? }` | `{ powtorzone, zapis, akt }` | `400`, `404`, `413` |
| `GET /api/miejsce/przestrzen/<nazwa>` | | `{ przestrzen, karty: [karta], cofnij: { mozna, akt }, ponow: { mozna, akt }, kursor }` | |
| `POST /api/miejsce/przestrzen/<nazwa>/poloz` | `{ op, rzecz, miejsce, wersja }` | `{ powtorzone, karta, akty, przyciete? }` | `400`, `403`, `404`, `409` z `karta` |
| `POST /api/miejsce/przestrzen/<nazwa>/cofnij` | `{ akt? }` | `{ powtorzone, cofniete: { akt }, karta }` | `403`, `409` z `powod` |
| `POST /api/miejsce/przestrzen/<nazwa>/ponow` | `{ akt? }` | `{ powtorzone, ponowione: { akt }, karta }` | `403`, `409` z `powod` |
| `GET /api/miejsce/glowy?przedrostek=` | | `{ razem, pokazane, glowy }` | `403` dla prywatnych |
| `GET /api/miejsce/historia?glowa=` | | `{ razem, pokazane, akty }` od najnowszego | `403` dla prywatnych |

`karta` to `{ rzecz, glowa, wersja, zapis, miejsce, brak_rzeczy? }`. `wersja` to numer aktu, który ostatnio
przesunął głowę, albo `null`, gdy karta nie ma jeszcze głowy. Ścieżki dawcy (`/akt`, `/dziennik`, `/nowe`,
`/glowa`, `/zapis`, `/widzialem`, `/eksport`, `/import`) zostają bez zmian.

### 4.1 Jeden gest to jedna para aktów

`poloz` robi dwie czynności rdzenia: `zapisz` (op `<op>.z`) i `przesun` (op `<op>.p`). Klient woła je raz,
na końcu gestu, nigdy w trakcie ruchu. `op` od klienta ma 8 do 110 znaków.

- Konflikt wersji: `409` i aktualna `karta`. Klient pokazuje stan z odpowiedzi; nic nie ginie.
- Kładzie tylko właściciel przestrzeni. Agent dostaje `403` (S12).
- Rzecz musi istnieć (`404`).

### 4.2 Cofnięcie i ponowienie

Cofnięcie to przesunięcie tej samej głowy z powrotem. Jest nowym aktem, więc historia zostaje.

- Akt cofnięcia ma `op = "cofnij.akt:<nr>"`, a ponowienia `op = "ponow.akt:<nr>"`, gdzie `<nr>` to numer aktu,
  który **teraz trzyma głowę** i jest odwracany. Dzięki temu dwa urządzenia cofające ten sam ruch dają
  jeden akt, a ciąg cofnij, ponów, cofnij nie zderza się sam ze sobą.
- Dokąd wraca głowa: na `z` odwracanego aktu. Gdy `z` jest puste (pierwsze położenie karty), głowa idzie na
  zapis `{ "auto": true }` tej karty; wtedy cofnięcie to para aktów.
- Bez `akt` w ciele serwer bierze wierzch stosu. Z `akt` odwraca dokładnie ten akt albo mówi `409`.
- Co jest na stosie, liczy czysta funkcja z samych aktów (część 5, `stos-cofania.mjs`), więc cofanie działa
  po przeładowaniu i z drugiego urządzenia. Nowy zwykły ruch czyści to, co było do ponowienia.
- Głębokość: ostatnie 200 przesunięć w przestrzeni. Granica jest podawana w odpowiedzi (`obciete`).
- Słowa się nie cofa: dopisuje się następne.

## 5. Moduły i ich właściciele

Jeden plik ma jednego piszącego naraz. Moduł nie sięga do tabel rdzenia inaczej niż przez `rzuty.mjs`.

| Paczka | Pliki | Zależy od |
| --- | --- | --- |
| P0 kształty | `worker/ksztalty.mjs` | niczego |
| P1 rzuty | `worker/rzuty.mjs` | rdzenia |
| P2 stos | `worker/stos-cofania.mjs` | niczego |
| P3 przestrzeń | `worker/przestrzen.mjs` | P0, P1, P2 |
| P4 rzeczy | `worker/rzeczy.mjs`, `tools/zasiej-rzeczy.mjs` | P0, P1 |
| P5 słowa | `worker/slowa.mjs` | P0, P1 |
| P6 strony | `worker/strony.mjs` | niczego (czyste funkcje: dane w, HTML na zewnątrz) |
| P7 wejście | `worker/klucze.mjs` (rozszerzenie), `worker/wejscie.mjs` | niczego |
| P8 klient, części czyste | `public/przestrzen/geometria.mjs`, `gesty.mjs`, `auto-uklad.mjs`, `drzwi.mjs`, `szkic.mjs` | niczego |
| P9 klient, strona | `public/przestrzen/index.html`, `przestrzen.mjs`, `public/wspolne/jaskinia.css` | P8 |
| P10 serwer lokalny | `tools/serwer-lokalny.mjs` | wszystkiego |
| P11 sprawdzian pod adresem | `tools/sprawdzian-kroku-1.mjs` | tylko tej umowy |
| spinanie | `worker/index.mjs`, `worker/miejsce-do.mjs`, `worker/drzwi-kroku-1.mjs`, `wrangler.jsonc` | jedna osoba |

Sprawdziany leżą obok kodu (`worker/*.test.mjs`), a dla klienta w `testy/klient/`. Bez nowych zależności:
`node:test`, `node:sqlite`, nic do pobrania.

### 5.1 `ksztalty.mjs`

- `kanon(wartosc)` → tekst JSON z kluczami posortowanymi rekurencyjnie.
- `sprawdzRzecz(o)`, `sprawdzMiejsceKarty(o)`, `sprawdzSlowo(o)` → `{ ok: true, wartosc, przyciete }` albo błąd `400`/`413`.
  `wartosc` jest znormalizowana (zaokrąglone liczby, obcięte białe znaki, dopisane `w`). Nieznane pola: błąd `400`.
- `idRzeczy(s)`, `nazwaPrzestrzeni(s)` → `true` albo `false`.
- `glowaRzeczy(id)`, `glowaKarty(przestrzen, id)`, `przedrostekPrzestrzeni(przestrzen)` → nazwy głów.

### 5.2 `rzuty.mjs` (tylko czyta)

- `glowyZPrzedrostkiem(rdzen, kto, przedrostek, { limit = 500 })` → `{ ok, przedrostek, razem, pokazane, glowy: [{ glowa, zapis, wersja, rodzaj, tresc }] }`.
- `historiaGlowy(rdzen, kto, glowa, { limit = 50 })` → `{ ok, glowa, razem, pokazane, akty }`, od najnowszego.
- `aktyGlow(rdzen, kto, przedrostek, { limit = 200 })` → przesunięcia głów z przedrostkiem, od najnowszego, z `obciete`.
- `akt(rdzen, kto, nr)` → jeden akt albo `404`.
- `zapisyRodzaju(rdzen, kto, rodzaj, { o = null, limit = 500 })` → `{ ok, razem, pokazane, wpisy: [{ akt, zapis, tresc }] }`, od najstarszego; `tresc` rozebrana z JSON albo `null`.
- `czytelnicy(rdzen)` → `{ ok, czytelnicy: [{ kto, widziane_do, kiedy }] }`.

Widoczność idzie za regułą dawcy (`Rdzen.widoczny`): głowy `jozz:prywatne/` i ich akty widzi tylko właściciel.
Zapytanie o sam prywatny przedrostek od kogoś innego: `403`. Przy szerszym przedrostku prywatne są pomijane.

### 5.3 `stos-cofania.mjs` (czysta funkcja)

`stos(akty)`: `akty` to przesunięcia głów jednej przestrzeni, od najstarszego, każdy `{ nr, op, glowa, zapis, z }`.
Zwraca `{ doCofniecia, doPonowienia, glebokosc: { cofnij, ponow }, niespojne }`, gdzie cel to `null` albo
`{ glowa, trzyma, wroc_na }` (`trzyma`: numer aktu do odwrócenia; `wroc_na`: zapis albo `null`).

Reguły:
1. Zwykły akt (op bez przedrostków z 4.2) wchodzi na stos "zrobione" i czyści stos "cofnięte".
2. Akt `cofnij.akt:X` zdejmuje ze "zrobionych" wpis, który trzyma `X`, i kładzie go na "cofnięte" z nowym
   trzymającym (sobą). Gdy takiego wpisu nie ma, akt liczy się jak zwykły i trafia do `niespojne`.
3. Akt `ponow.akt:U` zdejmuje z "cofniętych" wpis trzymany przez `U` i kładzie go na "zrobione" z nowym
   trzymającym (sobą). Gdy takiego wpisu nie ma: jak w regule 2.
4. `doCofniecia` to wierzch "zrobionych": `wroc_na` równe `z` trzymającego aktu. `doPonowienia` to wierzch
   "cofniętych": `wroc_na` równe `z` aktu cofnięcia.

### 5.4 `przestrzen.mjs`

- `uklad(rdzen, kto, przestrzen)`; `poloz(rdzen, kto, przestrzen, { op, rzecz, miejsce, wersja })`;
  `cofnij(rdzen, kto, przestrzen, { akt })`; `ponow(rdzen, kto, przestrzen, { akt })`. Zwroty jak w części 4.
- Czynności idą wyłącznie przez `rdzen.wykonaj`, więc każdy skutek jest aktem w dzienniku i wchodzi do eksportu.

### 5.5 `rzeczy.mjs` i `tools/zasiej-rzeczy.mjs`

- `zasiej(rdzen, kto, lista, { zrodlo })` → `{ ok, razem, nowe, zmienione, bez_zmian, bledy }`. Drugi przebieg
  z tym samym ziarnem nie zapisuje ani jednego aktu. Zmienione ziarno daje nowy zapis i przesuwa głowę;
  stary zapis zostaje w historii.
- `rzeczy(rdzen, kto)`, `rzecz(rdzen, kto, id)` → jak w części 4.
- `zZiarna(wpis, zrodlo)` → `rzecz` w kształcie 3.1 z jednego wpisu `wejscia.json`.

### 5.6 `slowa.mjs`

- `dodajSlowo(rdzen, kto, { op, tekst, o, do, nawiazuje })` → jeden akt `zapisz` rodzaju `slowo`.
  Rzecz musi istnieć. `nawiazuje.zapis` musi być słowem o tej samej rzeczy.
- `slowaO(rdzen, kto, o)` → `{ ok, razem, pokazane, slowa }`: każde `{ zapis, akt: { nr, kto, kiedy }, tekst, do, nawiazuje, widzieli, pod }`,
  gdzie `pod` to słowa nawiązujące do tego, a `widzieli` to imiona z `widziane_do` nie mniejszym niż numer aktu, bez autora.
  To samo zdanie zapisane dwa razy to dwa wpisy: tożsamością wpisu jest akt.

### 5.7 `strony.mjs` (czyste: dane w, tekst HTML na zewnątrz)

- `stronaRzeczy(dane, kontekst)`, `stronaSpisu(dane, kontekst)`, `stronaBezKlucza(kontekst)`, `stronaWejscia(kontekst)`.
  `kontekst`: `{ podglad, ja, kluczeProbne, op }`.
- Strona rzeczy ma zawsze te same części, w tej kolejności: nazwa; czym jest; wejście i telefon; skąd to wiemy
  (plik, commit, data); słowa (z formularzem, który działa bez JavaScriptu); kto ruszał; czego nie wiemy;
  dla agentów (jak czytać `.json`, jak zostawić słowo jednym poleceniem).
- Każdy tekst z danych przechodzi przez ucieczkę HTML. Słowo o treści `<script>` jest tekstem, nie znacznikiem.
- Bez klucza strona nie zawiera żadnej treści rzeczy ani słów.

### 5.8 `klucze.mjs` i `wejscie.mjs`

- `ktoTo(request, env)` → `{ ok, kto, przez }`, `przez`: `naglowek` albo `ciastko`. Najpierw nagłówek.
- `POST /wejdz` (formularz, pole `klucz`): poprawny klucz ustawia ciasteczko `jaskinia_klucz` z
  `HttpOnly; Secure; SameSite=Lax; Path=/` i odsyła (`303`) pod `dokad`. `dokad` musi być ścieżką tej samej strony
  (zaczyna się od `/`, nie od `//`), inaczej `/przestrzen/glowna`.
- Guziki z kluczami próbnymi pokazują się tylko wtedy, gdy `PODGLAD` jest `tak` i jest ustawienie `KLUCZE_PROBNE`.
  Poza podglądem w tekście strony nie ma żadnego klucza.

### 5.9 Klient

- `geometria.mjs`: `naEkran(p, oko)`, `naPlaszczyzne(p, oko)`, `przyblizWPunkcie(oko, punkt, mnoznik)` (punkt pod
  wskaźnikiem zostaje w miejscu), `ograniczOko(oko)` (przybliżenie 0,05 do 8, przycięcie widoczne),
  `prostokatKarty(miejsce, oko)`, `uchwytRozmiaru(miejsce, oko, { dotyk })` (stały rozmiar na ekranie: 44 px
  przy dotyku, poza prawym dolnym rogiem karty), `dopasujOko(miejsca, widok)` (wszystkie karty na ekranie).
- `gesty.mjs`: `krok(stan, zdarzenie)` → `{ stan, zamiary }`. Zdarzenia: `dol`, `ruch`, `gora`, `anuluj`, `kolko`.
  Cel zdarzenia `dol`: `karta`, `uchwyt`, `tlo`. Zamiary: `podglad` (rysuj, nie zapisuj), `poloz` (raz, na końcu
  gestu, tylko gdy coś się zmieniło), `stuk`, `oko`.
- `auto-uklad.mjs`: `ulozAutomatycznie(idRzeczy, opcje)` → miejsca dla kart bez własnego położenia; ta sama
  lista daje zawsze ten sam układ.
- `drzwi.mjs`: `nowyOp()`, `wyslij(...)` z ponowieniem tym samym `op` przy błędzie sieci i `5xx` (najwyżej 3 razy);
  odpowiedzi `4xx` nie ponawia.
- `szkic.mjs`: szkic słowa przeżywa przeładowanie; wyjątek magazynu przeglądarki nie wywraca strony.

## 6. Przypadki sprawdzianów

Kto buduje moduł, nie zmienia jego sprawdzianów. Brakujący przypadek zgłasza, a dopisuje go autor sprawdzianów.

**Kształty (KS).** KS1 `kanon` daje ten sam tekst dla tych samych danych w innej kolejności kluczy. KS2 liczby
ułamkowe w miejscu karty są zaokrąglane. KS3 `szer: 5` daje 40 i wpis w `przyciete`. KS4 nieznane pole: `400`.
KS5 `wejscie.adres` z `http:` albo `javascript:`: `400`. KS6 pusty `tekst` po obcięciu: `400`; 20 001 znaków: `413`.
KS7 postać `auto: true` nie przyjmuje `x`. KS8 `nawiazuje.jako` spoza listy: `400`. KS9 `id` z wielką literą: `false`.

**Rzuty (RZ).** RZ1 przedrostek zwraca tylko swoje głowy, `razem` równe liczbie. RZ2 `limit: 2` przy pięciu
głowach: `pokazane` 2, `razem` 5. RZ3 prywatne głowy: agent `403`, właściciel widzi. RZ4 historia głowy od
najnowszego, z `z`. RZ5 `zapisyRodzaju` z `o` zwraca tylko słowa o tej rzeczy. RZ6 zapis prywatny cudzego
autora nie pokazuje się agentowi. RZ7 żadna funkcja nie zapisuje aktu ani wiersza (liczniki `stan()` bez zmian).

**Stos (ST).** ST1 pusta lista: oba cele `null`. ST2 jeden ruch: cel cofnięcia, `wroc_na` równe `z`.
ST3 ruch, cofnięcie: cel ponowienia wskazuje akt cofnięcia. ST4 ruch, cofnięcie, ponowienie, cofnięcie: op-y
się nie zderzają i stan jest jak po ST3. ST5 ruch A, ruch B, cofnięcie B, nowy ruch C: nie ma nic do ponowienia,
do cofnięcia jest C, potem A. ST6 cofnięcie aktu spoza wierzchu zdejmuje właśnie ten wpis. ST7 cofnięcie
wskazujące nieistniejący akt trafia do `niespojne` i liczy się jak zwykły ruch. ST8 pierwsze położenie:
`wroc_na` jest `null`. ST9 po k zwykłych ruchach i k cofnięciach zbudowanych według kolejnych celów `doCofniecia` cel cofnięcia jest
`null`, a `glebokosc.ponow` równa k (losowe ciągi z ustalonym ziarnem).

**Przestrzeń (PR).** PR1 `poloz` zapisuje dokładnie dwa akty. PR2 to samo `op` drugi raz: `powtorzone`, zero
nowych aktów. PR3 zła `wersja`: `409` z aktualną kartą. PR4 agent: `403`, zero aktów. PR5 nieznana rzecz: `404`.
PR6 zwinięcie i rozwinięcie: te same cztery liczby. PR7 cofnięcie i ponowienie wracają do tych samych liczb,
także na nowym obiekcie rdzenia nad tą samą bazą. PR8 cofnięcie pierwszego położenia: karta ma `auto: true`.
PR9 dwa cofnięcia tego samego `akt`: jeden akt, drugie `powtorzone`. PR10 `uklad` pokazuje kartę, której rzecz
zniknęła, z `brak_rzeczy`. PR11 przycięcie widać w odpowiedzi i w zapisanym miejscu. PR12 nic do cofnięcia: `409`, `powod: "pusto"`. PR13 losowy ciąg 30 ruchów
na 5 kartach, potem 30 cofnięć: każda karta wraca do stanu sprzed ruchów; potem 30 ponowień: stan jak po ruchach
(ustalone ziarno).

**Rzeczy (RC).** RC1 siew siedmiu: `razem` 7, `nowe` 7. RC2 drugi siew: `bez_zmian` 7, zero aktów. RC3 zmieniony
opis jednej: `zmienione` 1, stary zapis w historii głowy. RC4 zły wpis nie zatrzymuje pozostałych i jest w `bledy`.
RC5 `rzecz()` nieznanego id: `404`. RC6 `rzeczy()` podaje `slow` zgodne z liczbą słów.

**Słowa (SL).** SL1 słowo właściciela i odpowiedź agenta: dwa akty, właściwe imiona. SL2 pole `kto` w ciele jest
ignorowane. SL3 `nawiazuje` do słowa o innej rzeczy: `400`. SL4 to samo zdanie dwa razy z różnym `op`: dwa wpisy.
SL5 `widzieli` pojawia się po `widzialem` z numerem nie mniejszym niż akt słowa. SL6 słowo o nieistniejącej rzeczy: `404`.

**Strony (SN).** SN1 strona rzeczy zawiera wszystkie części z 5.7 w kolejności. SN2 `<script>` w słowie jest
ucieczką. SN3 strona bez klucza nie zawiera nazwy rzeczy. SN4 spis mówi "7 z 7". SN5 poza podglądem nie ma
kluczy próbnych w tekście. SN6 każda strona ma słowo "próba" i zdanie o jawnych kluczach, gdy `podglad`.

**Wejście (WE).** WE1 nagłówek i ciasteczko dają to samo imię. WE2 złe ciasteczko: `401`. WE3 `dokad` równe
`//obca.strona`: przekierowanie na adres domyślny. WE4 POST z ciasteczkiem i obcym `Origin`: `403`; z nagłówkiem
`Authorization` bez `Origin`: przechodzi. WE5 `/wyjdz` kasuje ciasteczko.

**Klient (KL).** KL1 `naPlaszczyzne(naEkran(p))` oddaje `p`. KL2 przybliżenie w punkcie zostawia ten punkt
w miejscu. KL3 ciągnięcie zaczęte na karcie o rozmiarze 40 na 40 daje `poloz` ze zmienionym `x`, `y` i tym
samym rozmiarem. KL4 ciągnięcie zaczęte na uchwycie zmienia rozmiar, nie położenie. KL5 ruch poniżej 6 px:
`stuk`, bez `poloz`. KL6 `anuluj` w trakcie: bez `poloz`. KL7 w trakcie ruchu są tylko `podglad`, a `poloz`
jest jeden, na końcu. KL8 drugi palec w trakcie ciągnięcia karty anuluje je i zaczyna przybliżanie. KL9 uchwyt
przy dotyku ma co najmniej 44 px przy każdym przybliżeniu. KL10 automat daje ten sam układ dla tej samej listy
i nie nakłada kart na siebie. KL11 `wyslij` ponawia z tym samym `op` po błędzie sieci i nie ponawia po `409`.

## 7. Sprawdziany pod adresem

Trzy poziomy. Wyższy nie zastępuje niższego.

**S: skrypt `tools/sprawdzian-kroku-1.mjs <adres>`.** Dwa niezależne urządzenia właściciela (A, B) i agent (G).
Pełny przebieg idzie na serwerze lokalnym i na osobnym podglądzie do sprawdzianów, nigdy na podglądzie,
którego używa właściciel: dziennik jest nieusuwalny, więc sprawdzian zostawiłby mu śmieci.

S1 zdrowie mówi, że pamięć i klucze są. S2 bez klucza `401` na danych, na stronie rzeczy i na `.json`.
S3 spis: `razem` 7 i `pokazane` 7; każda strona rzeczy ma w źródle nazwę, opis, wejście i commit ziarna.
S4 A kładzie kartę, B czyta te same liczby. S5 jeden gest: liczba aktów rośnie o 2. S6 to samo `op`: `powtorzone`.
S7 zwinięcie i rozwinięcie: te same liczby. S8 dwie karty naraz z A i B: obie zostają. S9 ta sama karta naraz:
jedno `200`, jedno `409` z aktualnym stanem. S10 cofnięcie i ponowienie, potem nowy klient widzi to samo;
dwa cofnięcia tego samego aktu dają jeden akt. S11 słowo A, odpowiedź G pod nim, imiona z kluczy; podróbka
autora w treści bez skutku. S12 G nie przesunie karty właściciela. S13 po `widzialem` G jest w `widzieli`.
S14 każda strona ma "próba" i zdanie o kluczach. S15 formularz bez JavaScriptu: z ciasteczkiem `303`,
z obcym `Origin` `403`, bez ciasteczka `401`. S16 seria GET nie zmienia liczby aktów.
S17 stan przeżywa ponowne wdrożenie (`--zapamietaj` przed, `--porownaj` po).

**K: klikanie w przeglądarce**, na 1918 na 1030 i na 375 na 812. K1 `data-gotowe="tak"` i 7 kart. K2 na telefonie
nie ma przewijania w bok. K3 każda nazwa jest cała i ma co najmniej 12 px. K4 cele dotyku mają co najmniej
44 px. K5 ciągnięcie małej karty za środek przesuwa ją i nie zmienia rozmiaru. K6 ciągnięcie uchwytu zmienia
rozmiar. K7 zwinięcie i rozwinięcie guzikiem. K8 cofnięcie po przeładowaniu. K9 "próba" widać bez przewijania.
K10 szkic słowa przeżywa przeładowanie. K11 stara karta dostaje komunikat i aktualny stan, nic nie ginie.

**W: palec właściciela.** Tego nie sprawdzi żaden agent: czy przesuwanie i zmiana rozmiaru pod kciukiem są
wygodne i czy pierwszy rzut oka jest zwarty. Wynik idzie do dziennika ocen, nie do tego pliku.

## 8. Granice, zapisane jako granice

- **Słowa bez indeksu.** Otwarcie strony rzeczy czyta wszystkie słowa. Przy 1000 słów i limicie 5 mln
  odczytanych wierszy na dobę to ok. 5000 otwarć. Wyjście bez zmiany formatu: indeks po polu `o`.
- **Stos cofania czyta akty przestrzeni bez indeksu** i sięga 200 przesunięć wstecz.
- **Jeden gest to ok. 7 do 8 zapisanych wierszy** razem z indeksami (do zmierzenia licznikiem magazynu),
  czyli ok. 12 000 gestów na dobę w limicie 100 000.
- **Ruch wielu kart jednym gestem** to dziś wiele par aktów. Wspólny przedrostek `op` załatwi to później.
- **Klucze podglądu są jawne.** Każdy, kto zna adres, wejdzie jako właściciel próbny. Dlatego próba jest
  podpisana i nic prywatnego na nią nie trafia. Prywatne użycie wymaga wpuszczania urządzeń, którego tu nie ma.
- **Automat nie omija kart położonych ręcznie.**

## 9. Reguły dla budujących i sprawdzających

1. Pracujesz tylko w plikach swojej paczki i tylko w katalogu, który dostałeś. Niczego nie wypychasz.
2. Nie dodajesz zależności i niczego nie pobierasz.
3. Nie zmieniasz sprawdzianów, żeby przeszły. Sprawdzian, który uważasz za błędny, zgłaszasz z powodem.
4. Raport: lista dotkniętych plików, polecenia z wynikami, ile przypadków z listy pokryłeś z ilu, czego nie
   sprawdziłeś. Raport nie jest pomiarem: druga osoba powtarza polecenia.
5. Sprawdzający psuje jedno zachowanie naraz i patrzy, czy któryś sprawdzian się wywraca. Zachowanie, którego
   zepsucia nikt nie zauważa, jest dziurą w sprawdzianach, a nie dowodem jakości.
6. Dwie nieudane próby tej samej hipotezy: zmiana podejścia i zgłoszenie, nie trzecia próba.
