# Umowa kroku 1: rzeczy, przestrzeń, słowo, cofnięcie

Status: **próba** (zob. [TYMCZASOWE.md](../TYMCZASOWE.md)). **Wersja 2**, po ataku drugiej pary oczu (część 11).
Ten plik jest umową między tym, kto pisze sprawdziany, tym, kto buduje moduł, i tym, kto sprawdza. Kod, który
jej nie spełnia, nie wchodzi na gałąź. Sama umowa też jest do podważenia: zmiana idzie przez ten plik,
z powodem, nie przez ciche odstępstwo w kodzie.

Stoi na rdzeniu z dawcy ([`worker/miejsce.mjs`](../worker/miejsce.mjs): zapis, akt, głowa) i niczego do niego
nie dopisuje. Kształt rdzenia opisuje [szkic rdzenia zapisów](rdzen-zapisow-szkic.md), a mierzy go
`tools/umowa-rdzenia.mjs`.

## 0. Zakres: cztery punkty, stały budżet

1. Siedem rzeczy, każda ze stałym adresem i stroną tej samej budowy.
2. Położenie, rozmiar i zwinięcie karty jako głowa właściciela, takie samo na telefonie i komputerze.
3. Słowo właściciela przy rzeczy i odpowiedź agenta przez te same drzwi, pod imieniem z klucza.
4. Cofnięcie ruchu właściciela, także po przeładowaniu i z drugiego urządzenia.

Pierwszeństwo ma komputer, telefon jest wsparciem: sprawdzian na telefonie zostaje, ale wygodę stroi się
najpierw pod mysz i duży ekran.

**Poza krokiem 1** (kto dokłada, mówi, co wypada): okna i trasa narzędzia, rodziny, presety, ruch wielu kart
jednym gestem, pełne poziomy szczegółowości, doręczenie (adresat, budzi albo czeka), wpuszczanie urządzeń
i agentów kliknięciem, zbieracz faktów, wersje i buildy rzeczy, statystyki, wyszukiwanie.

## 1. Zasady, które obowiązują każdy moduł

Każda ma za sobą pomiar albo doświadczenie z poprzednich prób; numer w nawiasie to sprawdzian z części 7.

1. **Wynik jest obiektem, nie wyjątkiem.** Sukces: `{ ok: true, ... }`. Porażka: `{ ok: false, status, blad, ... }`,
   gdzie `status` to kod HTTP, a `blad` to zdanie po polsku, które mówi, co zrobić. Każde `409` ma też `powod`
   z zamkniętej listy (4.3). Moduły nie znają HTTP.
2. **Autor i czas nadają drzwi.** Biorą się z klucza i z zegara serwera. W drzwiach kroku 1 każde pole ciała
   spoza umowy, także `kto` i `kiedy`, to błąd `400`. Drzwi dawcy `/akt` takie pola pomijają (S11).
3. **Każda czynność ma `op`** i powtórzone dostarczenie daje ten sam skutek z `powtorzone: true`, nigdy drugi
   akt (S6). `op` klienta: `^[A-Za-z0-9_-]{8,100}$`. Kropka i dwukropek są zastrzeżone dla czynności złożonych
   serwera (4.1, 4.2); drzwi `/akt` odrzucają z zewnątrz `op`, który je zawiera (S18). Powód: zbiór `op` jest
   w rdzeniu jeden dla wszystkich uczestników, a numery aktów są przewidywalne.
4. **Każda lista mówi, ile ma pozycji i ile pokazuje:** `razem` i `pokazane` (S3).
5. **Przycięcie wartości jest widoczne.** Zakresy są szerokie; wartość spoza zakresu moduł przycina i wypisuje
   w `przyciete`, nie odrzuca po cichu i nie udaje, że przyjął.
6. **GET niczego nie zmienia** (S16). Samo otwarcie adresu nie zapisuje aktu ani odczytu.
7. **Treść dla agenta leży w zwykłym tekście strony.** Strony rzeczy i spis składa serwer. Strona przestrzeni
   jest rysowana skryptem, więc ma w zwykłym tekście blok dla agentów z adresem danych i odnośnikiem do spisu (K12).
8. **Strona mówi, kiedy jest gotowa i ile pokazuje:** `data-gotowe="tak"` oraz liczby w `data-...` na `<body>`.
   Powód: 15 XI sprawdzacz zmierzył stronę, zanim dorysowała karty, i podał 6 elementów zamiast 17 (K1).
9. **Próba jest podpisana jako próba** na każdej stronie, razem ze zdaniem, że klucze podglądu są jawne
   i nic prywatnego tu nie trafia (S14).
10. **Format ma wersję.** Każda treść zapisu ma pole `w`. Zapis w nieznanej wersji jest pokazywany jako
    "zapis w nowszym formacie", nigdy pomijany ani przepisywany.
11. **Rządzi nazwa głowy, a nieznane czeka.** Drzwi dawcy `/akt` nie znają kształtów, więc pod głową może
    stanąć zapis złego rodzaju albo z innym identyfikatorem niż w nazwie. Czytający sprawdza to przy odczycie
    i pokazuje taki wpis z oznaczeniem `niepoprawna` i powodem. Wpis nie znika i nie jest naprawiany po cichu.
12. **Strona wyjaśnia się sama.** Z każdej strony jest droga w górę (do spisu), do sąsiadów i do bloku
    "jak to jest zbudowane": wzór adresów, jak zostawić słowo, gdzie są dane. Bez osobnego manifestu:
    strukturę widać w adresach i w powtarzalnej budowie.
13. **Drzwi dają się wystawić jeden do jednego cienką warstwą narzędzi.** Każda czynność to jedno żądanie
    z jawnym ciałem i wynikiem, bez stanu po stronie wołającego.

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

- `<id>` rzeczy: `^[a-z0-9][a-z0-9_.-]{0,63}$` i nie kończy się na `.json`. Dla rzeczy z repozytorium to nazwa
  repozytorium małymi literami, więc stary adres `#repo~Nazwa` przekłada się jeden do jednego.
- `<nazwa>` przestrzeni: `^[a-z0-9][a-z0-9_-]{0,29}$`.
- Długości są dobrane tak, żeby najdłuższa nazwa głowy (3.2) mieściła się w 120 znakach ścieżki, które
  przyjmuje rdzeń.

## 3. Zapisy

Treść zapisu to JSON w postaci kanonicznej (`kanon()` w `worker/ksztalty.mjs`), bo tożsamością zapisu jest
skrót treści:

- klucze posortowane rekurencyjnie, bez spacji;
- **każde pole kształtu jest zawsze wpisane**, także puste (`do: []`, `nawiazuje: null`, `zwinieta: false`);
- listy bez znaczenia kolejności (`do`) posortowane i bez powtórek;
- w tekstach `CRLF` staje się `LF`; reszta tekstu zostaje nietknięta, znak po znaku.

### 3.1 `rzecz` (w: 1), głowa `wspolne:rzecz/<id>`

```json
{ "w": 1, "id": "combat-lab", "nazwa": "...", "czym_jest": "...", "repo": "Wlasciciel/Combat-Lab",
  "wejscie": { "adres": "https://...", "rodzaj": "strona" },
  "telefon": { "deklaruje": "dotyk", "skad_wiem": "..." },
  "zrodlo": { "plik": "public/wejscia.json", "sprawdzone": "2026-11-15" } }
```

- `id` w treści musi być równe identyfikatorowi w nazwie głowy.
- `repo` i `wejscie` mogą być `null`. `wejscie.adres` musi być `https:`. `nazwa` 1 do 200 znaków, `czym_jest` do 2000.
- `telefon.deklaruje`: `dotyk` (strona deklaruje sterowanie dotykiem), `tylko-komputer` (strona mówi to wprost)
  albo `nic`. To jest deklaracja strony, nie pomiar: nikt nie sprawdził tego palcem i strona rzeczy to mówi.
- `zrodlo.sprawdzone` to data pomiaru z wpisu ziarna. Commit pliku ziarna nie wchodzi do treści, bo zmienia
  się bez zmiany rzeczy i przesuwałby głowę przy każdym siewie.

### 3.2 `miejsce-karty` (w: 1), głowa `jozz:przestrzen/<nazwa>/rzecz/<id>`

```json
{ "w": 1, "co": "rzecz/combat-lab", "auto": false, "x": 0, "y": 0, "szer": 240, "wys": 150, "zwinieta": false }
{ "w": 1, "co": "rzecz/combat-lab", "auto": true, "zwinieta": false }
```

- Człon `rzecz/` w nazwie głowy i pole `co` są po to, żeby później na płaszczyźnie mogło stanąć coś innego
  niż rzecz (okno narzędzia, notatka) bez zmiany nazw istniejących głów. `co` musi zgadzać się z nazwą głowy.
- Jednostki płaszczyzny, liczby całkowite (ułamki są zaokrąglane). Nigdy ułamki ekranu.
- Zakresy: `x`, `y` od -10 000 000 do 10 000 000; `szer`, `wys` od 40 do 100 000. Poza zakresem: przycięcie
  i wpis w `przyciete`.
- `zwinieta: true` zostawia `x`, `y`, `szer`, `wys` bez zmian. Rozwinięcie przywraca dokładnie to, co było.
- `auto: true` znaczy: karta stoi tam, gdzie kładzie ją automat. Karta bez głowy też. Miejsca automatyczne
  liczy klient jedną funkcją z tej samej listy rzeczy, więc są takie same na każdym urządzeniu; serwer ich nie zapisuje.
- Przybliżenie widoku nie jest polem karty. To stan oka, osobny na każdym urządzeniu.

### 3.3 `slowo` (w: 1), bez głowy

```json
{ "w": 1, "tekst": "...", "o": "rzecz/combat-lab", "do": [], "nawiazuje": { "akt": 41, "jako": "odpowiedz" } }
```

- `tekst`: po obcięciu białych znaków z brzegów 1 do 20 000 znaków. Dłuższy: `413`, bez cichego ucinania.
- **`nawiazuje` wskazuje akt, nie zapis.** Autor i czas są w akcie, więc to samo zdanie od dwóch autorów jest
  jednym zapisem, a dwoma wpisami. Numer aktu przechodzi przez eksport i import bez zmian. `jako`: `odpowiedz`,
  `dopisek` albo `poprawka`. Dopisek i poprawka są nowym zapisem, stary zostaje.
- `do`: lista imion, może być pusta. W kroku 1 niczego nie doręcza. Uczciwie: doręczenie prywatnych słów
  będzie wymagało zmiany reguły widoczności w rdzeniu, który dziś zna pod tym względem tylko rodzaj `wiadomosc`.

## 4. Drzwi

Wszystko pod `/api/miejsce/` wymaga klucza: nagłówek `Authorization: Bearer <klucz>` albo ciasteczko
`jaskinia_klucz` ustawione przez `/wejdz`. Bez klucza: `401`, także przy czytaniu. Żądanie zmieniające stan
z ciasteczkiem musi mieć nagłówek `Origin` równy adresowi strony, inaczej `403`.

| Metoda i ścieżka | Ciało | Sukces | Porażki |
| --- | --- | --- | --- |
| `GET /api/miejsce/rzeczy` | | `{ razem, pokazane, rzeczy: [{ id, glowa, wersja, zapis, rzecz, niepoprawna, slow }] }` | |
| `GET /api/miejsce/rzecz/<id>` | | `{ id, glowa, wersja, zapis, rzecz, niepoprawna, slowa, historia, sasiedzi }`, trzy ostatnie jako listy z `razem` i `pokazane` | `404` |
| `POST /api/miejsce/rzecz/<id>/slowo` | `{ op, tekst, do?, nawiazuje? }` | `{ powtorzone, zapis, akt }` | `400`, `404`, `413` |
| `GET /api/miejsce/przestrzen/<nazwa>` | | `{ przestrzen, razem, pokazane, karty, cofnij, ponow, obciete, kursor }` | |
| `POST /api/miejsce/przestrzen/<nazwa>/poloz` | `{ op, co, miejsce, wersja }` | `{ powtorzone, bez_zmian, karta, akty, przyciete }` | `400`, `403`, `404`, `409` |
| `POST /api/miejsce/przestrzen/<nazwa>/cofnij` | `{ akt }` | `{ powtorzone, cofniete: { akt }, karta, cofnij, ponow }` | `400`, `403`, `409` |
| `POST /api/miejsce/przestrzen/<nazwa>/ponow` | `{ akt }` | `{ powtorzone, ponowione: { akt }, karta, cofnij, ponow }` | `400`, `403`, `409` |
| `GET /api/miejsce/glowy?przedrostek=` | | `{ razem, pokazane, glowy }` | `403` dla prywatnych |
| `GET /api/miejsce/historia?glowa=` | | `{ razem, pokazane, akty }` od najnowszego | `403` dla prywatnych |

- `karta` to `{ co, glowa, wersja, zapis, miejsce, brak_rzeczy }`. `wersja` to numer aktu, który ostatnio
  przesunął głowę. W każdej odpowiedzi `karta` jest **stanem aktualnym**, odczytanym po czynności, a nie stanem
  z dawnego aktu.
- `karty` zawierają tylko karty, które mają głowę. Resztę rzeczy klient kładzie automatem (3.2).
- `cofnij` i `ponow` w odpowiedzi to `{ mozna, akt }`: `akt` jest numerem, który trzeba podać, żeby cofnąć albo ponowić.
- `kursor` to numer ostatniego aktu w całym dzienniku w chwili odczytu; klient podaje go drzwiom dawcy
  `/dziennik?od=`, żeby dowiedzieć się, co przybyło.
- `obciete` mówi, że okno cofania było pełne (4.2).
- Ścieżki dawcy (`/akt`, `/dziennik`, `/nowe`, `/glowa`, `/zapis`, `/widzialem`, `/eksport`, `/import`) zostają,
  z jednym zwężeniem z zasady 3.

### 4.1 Jeden gest to jedna para aktów

`poloz` robi dwie czynności rdzenia: `zapisz` (op `<op>.z`) i `przesun` (op `<op>.p`). Klient woła je raz,
na końcu gestu, nigdy w trakcie ruchu. Kolejność w środku jest częścią umowy, bo od niej zależy, ile aktów
zostawia odmowa:

1. Sprawdzenie kształtu (`400`) i właściciela (`403`). Kładzie tylko właściciel przestrzeni. Zero aktów.
2. Rzecz musi istnieć i być poprawna (`404`). Zero aktów.
3. Jeśli akt o op `<op>.p` już jest: `powtorzone: true`, zero nowych aktów. Wynik rdzenia przy powtórzeniu
   ma tylko `ok`, `powtorzone` i `akt`; zapis i wersję czyta się z `akt.zapis` i `akt.nr`.
4. Jeśli miejsce po normalizacji jest takie samo jak aktualne: `bez_zmian: true`, zero aktów. Gest bez zmiany
   nie jest krokiem cofania.
5. Jeśli `wersja` z żądania różni się od aktualnej: `409`, `powod: "wersja"`, aktualna `karta`, zero aktów.
6. `zapisz`, potem `przesun`. Jeśli między nimi wszedł inny gest na tę samą kartę, `przesun` dostaje odmowę:
   `409`, `powod: "wersja"`, aktualna `karta`. Wtedy w dzienniku zostaje jeden akt `zapisz` bez przesunięcia.
   To jedyny wypadek, w którym odmowa zostawia akt.

### 4.2 Cofnięcie i ponowienie

Cofnięcie to przesunięcie tej samej głowy z powrotem. Jest nowym aktem, więc historia zostaje.

- **Dwie liczby, nie jedna.** Wpis na stosie pamięta akt, który go trzyma (`trzyma`): dla świeżego ruchu to
  ten ruch, po ponowieniu to akt ponowienia. `op` cofnięcia to `cofnij.akt:<trzyma>`, a `op` ponowienia to
  `ponow.akt:<trzyma>` (tu `trzyma` to akt cofnięcia). Do porównaj-i-zamień idzie natomiast **aktualna wersja
  głowy**, odczytana w tej samej chwili. Gdy ta sama karta była ruszona dwa razy, po pierwszym cofnięciu głowę
  trzyma akt cofnięcia, a do odwrócenia jest starszy ruch: to dwie różne liczby.
- **`akt` w żądaniu jest obowiązkowy i musi być wierzchem stosu** (klient zna go z ostatniego odczytu).
  - Gdy akt o op `cofnij.akt:<akt>` już istnieje: `powtorzone: true`, zero nowych aktów. Tak samo dla ponowienia.
    Dzięki temu dwa urządzenia cofające ten sam ruch i ponowione żądanie po zgubionej odpowiedzi dają jeden akt.
  - Gdy `akt` nie jest wierzchem: `409`, `powod: "nie-wierzch"`, z aktualnymi `cofnij` i `ponow`. Zero aktów.
  - Gdy stos jest pusty: `409`, `powod: "pusto"`.
- **Dokąd wraca głowa:** na `z` aktu, który trzyma wpis. Gdy `z` jest puste (pierwsze położenie karty), głowa
  idzie na zapis `auto: true` tej karty; ten zapis ma stały op `cofnij.akt:<trzyma>.z`, więc cofnięcie pierwszego
  położenia to dwa akty, a jego powtórzenie nie dopisuje trzeciego.
- Co jest na stosie, liczy czysta funkcja z samych aktów (5.3), więc cofanie działa po przeładowaniu i z drugiego
  urządzenia. Nowy zwykły ruch czyści to, co było do ponowienia.
- **Głębokość.** Stos liczy się z ostatnich 200 przesunięć w przestrzeni. Cofnięcia i ponowienia też zajmują to
  okno, więc przy pełnym oknie da się cofnąć około 100 ruchów. `obciete: true` mówi, że okno było pełne.
- Słowa się nie cofa: dopisuje się następne.

### 4.3 Wartości `powod`

`wersja` (głowa ruszyła się po odczycie; w odpowiedzi aktualna `karta`), `op-zajety` (ten `op` należy do innej
czynności; klient bierze nowy `op`), `pusto`, `nie-wierzch`.

## 5. Moduły i ich właściciele

Jeden plik ma jednego piszącego naraz. Moduł nie sięga do tabel rdzenia inaczej niż przez `rzuty.mjs`.

| Paczka | Pliki | Zależy od |
| --- | --- | --- |
| P0 kształty | `worker/ksztalty.mjs` | niczego |
| P1 rzuty | `worker/rzuty.mjs` | rdzenia |
| P2 stos | `worker/stos-cofania.mjs` | P0 (tylko rozpoznanie `op`) |
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

- `kanon(wartosc)` → tekst JSON według części 3.
- `sprawdzRzecz(o)`, `sprawdzMiejsceKarty(o)`, `sprawdzSlowo(o)` → `{ ok: true, wartosc, przyciete }` albo błąd
  `400`/`413`. `wartosc` jest znormalizowana i pełna (wszystkie pola). Nieznane pola: `400`.
- `czytaj(rodzaj, tekst)` → `{ ok: true, wartosc }` albo `{ ok: false, powod }`, gdzie `powod` to `nie-json`,
  `nieznana-wersja` (z polem `w`) albo `zly-ksztalt`. Tej funkcji używa każdy, kto pokazuje zapis (zasady 10 i 11).
- `idRzeczy(s)`, `nazwaPrzestrzeni(s)`, `opKlienta(s)` → `true` albo `false`.
- `glowaRzeczy(id)`, `glowaKarty(przestrzen, co)`, `przedrostekPrzestrzeni(przestrzen)` → nazwy głów;
  `coZGlowy(glowa)` → `rzecz/<id>` albo `null`.
- `opPary(op)` → `{ z, p }`; `opCofniecia(nr)`, `opPonowienia(nr)`; `rozbierzOp(op)` → `{ rodzaj, akt }`, gdzie
  `rodzaj` to `cofnij`, `ponow` albo `zwykly`. Rozpoznanie idzie pełnym wzorem (`^cofnij\.akt:(\d+)$`):
  `cofnij.akt:2.p` i `cofnij.akt:2x` to zwykłe op.

### 5.2 `rzuty.mjs` (tylko czyta)

- `glowyZPrzedrostkiem(rdzen, kto, przedrostek, { limit = 500 })` → `{ ok, przedrostek, razem, pokazane, glowy: [{ glowa, zapis, wersja, rodzaj, tresc }] }`.
  Przedrostek idzie zakresem (`>=` i `<`), nie przez `LIKE`: podkreślenie w nazwie przestrzeni nie może
  dopasować innej litery.
- `historiaGlowy(rdzen, kto, glowa, { limit = 50 })` → `{ ok, glowa, razem, pokazane, akty }`, od najnowszego.
- `aktyGlow(rdzen, kto, przedrostek, { limit = 200 })` → przesunięcia głów z przedrostkiem, od najnowszego, z `obciete`.
- `akt(rdzen, kto, nr)` i `aktPoOp(rdzen, kto, op)` → jeden akt albo `404`.
- `zapisyRodzaju(rdzen, kto, rodzaj, { o = null, limit = 500 })` → `{ ok, razem, pokazane, wpisy: [{ akt, zapis, tresc }] }`,
  od najstarszego; `tresc` jako tekst (rozbiera go `czytaj`).
- `czytelnicy(rdzen)` → `{ ok, czytelnicy: [{ kto, widziane_do, kiedy }] }`.

Widoczność idzie za regułą dawcy (`Rdzen.widoczny`): głowy `jozz:prywatne/` i ich akty widzi tylko właściciel.
Zapytanie o sam prywatny przedrostek od kogoś innego: `403`. Przy szerszym przedrostku prywatne są pomijane.

### 5.3 `stos-cofania.mjs` (czysta funkcja)

`stos(akty, { obciete })`: `akty` to przesunięcia głów jednej przestrzeni, od najstarszego, każdy
`{ nr, op, glowa, zapis, z }`; `obciete` mówi, że to tylko okno, a starsze akty istnieją. Zwraca
`{ doCofniecia, doPonowienia, glebokosc: { cofnij, ponow }, niespojne }`, gdzie cel to `null` albo
`{ glowa, trzyma, wroc_na }`.

Dwie kupki wpisów `{ glowa, trzyma, wroc_na }`: "zrobione" i "cofnięte". Reguły, w kolejności aktów:

1. **Zwykły akt** (`rozbierzOp` mówi `zwykly`) kładzie na "zrobione" wpis `{ glowa, trzyma: nr, wroc_na: z }`
   i czyści "cofnięte".
2. **Akt `cofnij.akt:X`.** Jeśli na "zrobionych" jest wpis z `trzyma` równym `X` i tą samą głową: zdejmuje go
   i kładzie na "cofnięte" wpis `{ glowa, trzyma: nr, wroc_na: z }` (czyli ponowienie wróci tam, skąd cofnięcie
   zabrało głowę).
3. **Akt `ponow.akt:U`.** Jeśli na "cofniętych" jest wpis z `trzyma` równym `U` i tą samą głową: zdejmuje go
   i kładzie na "zrobione" wpis `{ glowa, trzyma: nr, wroc_na: z }`. Niczego nie czyści.
4. **Cel poza oknem.** Jeśli wpisu z reguły 2 albo 3 nie ma, okno jest obcięte i wskazany numer jest mniejszy
   od numeru pierwszego aktu w oknie: akt odtwarza wpis z samego siebie na właściwej kupce (cofnięcie na
   "cofnięte", ponowienie na "zrobione") i niczego nie czyści.
5. **Niespójność.** W każdym innym wypadku braku wpisu (zły numer, inna głowa) akt trafia do `niespojne`
   i liczy się jak zwykły (reguła 1).
6. `doCofniecia` to wierzch "zrobionych", `doPonowienia` to wierzch "cofniętych".

### 5.4 `przestrzen.mjs`

- `uklad(rdzen, kto, przestrzen)`; `poloz(rdzen, kto, przestrzen, { op, co, miejsce, wersja })`;
  `cofnij(rdzen, kto, przestrzen, { akt })`; `ponow(rdzen, kto, przestrzen, { akt })`. Zwroty i kolejność kroków
  jak w części 4.
- Czynności idą wyłącznie przez `rdzen.wykonaj`, więc każdy skutek jest aktem w dzienniku i wchodzi do eksportu.
- Karta, której głowa rzeczy wskazuje niepoprawny zapis (zasada 11), zostaje w układzie z `brak_rzeczy: true`.

### 5.5 `rzeczy.mjs` i `tools/zasiej-rzeczy.mjs`

- `zasiej(rdzen, kto, lista, { zrodlo })` → `{ ok, razem, nowe, zmienione, bez_zmian, bledy }`.
  - Głowa, która już wskazuje ten sam zapis, jest pomijana bez żadnego aktu. Stąd drugi przebieg z tym samym
    ziarnem nie zapisuje niczego.
  - `op` siewu: `ziarno.<id>.<wersja głowy albo 0>.<pierwsze 12 znaków identyfikatora zapisu>` z końcówkami
    `.z` i `.p`. Wersja głowy w `op` jest po to, żeby opis mógł wrócić do dawnej treści (A, potem B, potem
    znowu A to trzy przesunięcia).
- `rzeczy(rdzen, kto)`, `rzecz(rdzen, kto, id)` → jak w części 4. Głowa, pod którą nie stoi poprawna rzecz
  o tym samym `id`, wraca z `rzecz: null` i `niepoprawna` z powodem.
- `zZiarna(wpis, zrodlo)` → `rzecz` w kształcie 3.1 z jednego wpisu `wejscia.json`
  (`telefon`: `tak` staje się `dotyk`, `nie` staje się `tylko-komputer`, `nieznane` staje się `nic`).

### 5.6 `slowa.mjs`

- `dodajSlowo(rdzen, kto, { op, tekst, o, do, nawiazuje })` → jeden akt `zapisz` rodzaju `slowo`.
  Rzecz musi istnieć. `nawiazuje.akt` musi być aktem `zapisz` słowa o tej samej rzeczy, widocznym dla piszącego.
- `slowaO(rdzen, kto, o)` → `{ ok, razem, pokazane, slowa }`: każde `{ zapis, akt: { nr, kto, kiedy }, tekst, do, nawiazuje, widzieli, pod, nieczytelne }`,
  gdzie `pod` to słowa, których `nawiazuje.akt` równa się numerowi tego aktu, a `widzieli` to imiona
  z `widziane_do` nie mniejszym niż numer aktu, bez autora. Słowo, którego treści nie da się rozebrać,
  zostaje na liście z `nieczytelne` i powodem.

### 5.7 `strony.mjs` (czyste: dane w, tekst HTML na zewnątrz)

- `stronaRzeczy(dane, kontekst)`, `stronaSpisu(dane, kontekst)`, `stronaBezKlucza(kontekst)`, `stronaWejscia(kontekst)`.
  `kontekst`: `{ podglad, ja, kluczeProbne, op }`.
- Strona rzeczy ma zawsze te same części, w tej kolejności: droga w górę; nazwa; czym jest; wejście i telefon;
  skąd to wiemy (plik, data pomiaru, kto i kiedy zapisał); słowa (z formularzem, który działa bez JavaScriptu);
  kto ruszał; czego nie wiemy; sąsiedzi (z liczbą); jak to jest zbudowane i jak agent zostawia słowo jednym poleceniem.
- Każdy tekst z danych przechodzi przez ucieczkę HTML. Słowo o treści `<script>` jest tekstem, nie znacznikiem.
- Bez klucza strona nie zawiera żadnej treści rzeczy ani słów.
- Rzecz z `niepoprawna` dostaje stronę z powodem zamiast błędu.

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
  przy dotyku, poza prawym dolnym rogiem karty), `dopasujOko(miejsca, widok)` (wszystkie karty na ekranie),
  `poziomSzczegolu(szerNaEkranie)` (dwa poziomy: pełna karta albo kafelek z całą nazwą).
- `gesty.mjs`: `krok(stan, zdarzenie)` → `{ stan, zamiary }`. Zdarzenia: `dol`, `ruch`, `gora`, `anuluj`, `kolko`.
  Cel zdarzenia `dol`: `karta`, `uchwyt`, `tlo`. Zamiary: `podglad` (rysuj, nie zapisuj), `poloz` (raz, na końcu
  gestu, tylko gdy coś się zmieniło), `stuk`, `oko`.
- `auto-uklad.mjs`: `ulozAutomatycznie(idRzeczy, opcje)` → miejsca dla kart bez własnego położenia; ta sama
  lista daje zawsze ten sam układ.
- `drzwi.mjs`: `nowyOp()`, `wyslij(...)` z ponowieniem tym samym `op` przy błędzie sieci i `5xx` (najwyżej 3 razy);
  odpowiedzi `4xx` nie ponawia, poza `op-zajety`, przy którym bierze nowy `op` raz.
- `szkic.mjs`: szkic słowa przeżywa przeładowanie; wyjątek magazynu przeglądarki nie wywraca strony.

## 6. Przypadki sprawdzianów

Kto buduje moduł, nie zmienia jego sprawdzianów. Brakujący przypadek zgłasza, a dopisuje go autor sprawdzianów.

**Kształty (KS).** KS1 `kanon` daje ten sam tekst dla tych samych danych w innej kolejności kluczy. KS2 liczby
ułamkowe w miejscu karty są zaokrąglane. KS3 `szer: 5` daje 40 i wpis w `przyciete`. KS4 nieznane pole: `400`.
KS5 `wejscie.adres` z `http:` albo `javascript:`: `400`. KS6 pusty `tekst` po obcięciu: `400`; 20 001 znaków: `413`.
KS7 postać `auto: true` nie przyjmuje `x`, a przyjmuje `zwinieta`. KS8 `nawiazuje.jako` spoza listy: `400`.
KS9 `id` z wielką literą albo z końcówką `.json`: `false`. KS10 `czytaj` zapisu z `w: 2` mówi `nieznana-wersja`.
KS11 dwa wejścia różniące się tylko pominiętym polem opcjonalnym, kolejnością `do` albo `CRLF` dają ten sam tekst
kanoniczny. KS12 najdłuższa dozwolona nazwa przestrzeni z najdłuższym `id` daje nazwę głowy, którą rdzeń przyjmuje.
KS13 `opKlienta` odrzuca kropkę i dwukropek; `rozbierzOp("cofnij.akt:2.p")` mówi `zwykly`.

**Rzuty (RZ).** RZ1 przedrostek zwraca tylko swoje głowy, także gdy obok istnieją przestrzenie `a_b` i `axb`.
RZ2 `limit: 2` przy pięciu głowach: `pokazane` 2, `razem` 5. RZ3 prywatne głowy: agent `403`, właściciel widzi.
RZ4 historia głowy od najnowszego, z `z`. RZ5 `zapisyRodzaju` z `o` zwraca tylko słowa o tej rzeczy. RZ6 zapis
prywatny cudzego autora nie pokazuje się agentowi. RZ7 żadna funkcja nie zapisuje aktu ani wiersza (liczniki
`stan()` bez zmian). RZ8 `aktPoOp` znajduje akt i mówi `404` dla nieznanego op.

**Stos (ST).** ST1 pusta lista: oba cele `null`. ST2 jeden ruch: cel cofnięcia z `trzyma` równym numerowi ruchu
i `wroc_na` równym `z`. ST3 ruch, cofnięcie: cel ponowienia ma `trzyma` równe numerowi cofnięcia. ST4 ruch,
cofnięcie, ponowienie: cel cofnięcia ma `trzyma` równe numerowi ponowienia i `wroc_na` jak na początku.
ST5 ruch A, ruch B, cofnięcie B, nowy ruch C: nie ma nic do ponowienia; do cofnięcia jest C, potem A.
ST6 cofnięcie wpisu spoza wierzchu zdejmuje właśnie ten wpis (odporność funkcji; drzwi na to nie pozwalają).
ST7 cofnięcie wskazujące numer, którego nie ma, przy nieobciętym oknie: `niespojne`, liczy się jak zwykły ruch.
ST8 pierwsze położenie: `wroc_na` jest `null`. ST9 po k ruchach i k cofnięciach budowanych według kolejnych
celów cel cofnięcia jest `null`, a `glebokosc.ponow` równa k (losowe ciągi z ustalonym ziarnem). ST10 ta sama
karta ruszona dwa razy, dwa cofnięcia: drugi cel ma `trzyma` równe numerowi pierwszego ruchu, choć głowę
przesunął ostatnio akt cofnięcia. ST11 obcięte okno, w którym jest cofnięcie ruchu sprzed okna: wpis pojawia
się na "cofniętych" i nic nie znika z "zrobionych". ST12 obcięte okno z ponowieniem cofnięcia sprzed okna:
wpis pojawia się na "zrobionych", a "cofnięte" zostają. ST13 `cofnij.akt:X`, gdzie `X` trzyma wpis innej głowy:
`niespojne`. ST14 op `cofnij.akt:2.p` jest zwykłym ruchem.

**Przestrzeń (PR).** PR1 `poloz` zapisuje dokładnie dwa akty. PR2 to samo `op` drugi raz: `powtorzone`, zero
nowych aktów, `karta` aktualna. PR3 zła `wersja`: `409`, `powod: "wersja"`, aktualna karta, zero aktów.
PR4 agent: `403`, zero aktów. PR5 nieznana rzecz: `404`, zero aktów. PR6 zwinięcie i rozwinięcie: te same cztery
liczby. PR7 cofnięcie i ponowienie wracają do tych samych liczb, także na nowym obiekcie rdzenia nad tą samą
bazą. PR8 cofnięcie pierwszego położenia: karta ma `auto: true`, przybyły dwa akty, powtórzenie nie dodaje
żadnego. PR9 dwa cofnięcia z tym samym `akt`, drugie po zakończeniu pierwszego: drugie `powtorzone`, zero nowych
aktów. PR10 karta, której głowa rzeczy wskazuje zapis innego rodzaju, zostaje w układzie z `brak_rzeczy`.
PR11 przycięcie widać w odpowiedzi i w zapisanym miejscu. PR12 nic do cofnięcia: `409`, `powod: "pusto"`.
PR13 losowy ciąg 30 ruchów na 5 kartach, 30 cofnięć, 30 ponowień: stan po cofnięciach jak przed ruchami,
po ponowieniach jak po ruchach (ustalone ziarno). PR14 ta sama karta dwa razy, dwa cofnięcia, dwa ponowienia.
PR15 `akt` spoza wierzchu: `409`, `powod: "nie-wierzch"`, zero aktów. PR16 brak `akt`: `400`. PR17 gest bez
zmiany: `bez_zmian`, zero aktów, stos bez nowego kroku. PR18 70 ruchów, 70 cofnięć, 70 ponowień: wszystkie
przechodzą. PR19 `op` z kropką od klienta: `400`. PR20 dwa gesty na tę samą kartę wpuszczone na przemian
(drugi między `zapisz` a `przesun` pierwszego): jeden przechodzi, drugi `409` z aktualną kartą, w dzienniku
najwyżej jeden akt `zapisz` bez przesunięcia.

**Rzeczy (RC).** RC1 siew siedmiu: `razem` 7, `nowe` 7. RC2 drugi siew: `bez_zmian` 7, zero aktów. RC3 zmieniony
opis jednej: `zmienione` 1, stary zapis w historii głowy. RC4 zły wpis nie zatrzymuje pozostałych i jest w `bledy`.
RC5 `rzecz()` nieznanego id: `404`. RC6 `rzeczy()` podaje `slow` zgodne z liczbą słów. RC7 głowa rzeczy
przestawiona drzwiami `/akt` na słowo albo na rzecz o innym `id`: `rzecz: null`, `niepoprawna` z powodem.
RC8 opis A, potem B, potem znowu A: głowa wraca na zapis A.

**Słowa (SL).** SL1 słowo właściciela i odpowiedź agenta: dwa akty, właściwe imiona. SL2 pole `kto` w ciele: `400`.
SL3 `nawiazuje.akt` wskazujący słowo o innej rzeczy albo akt, który nie jest słowem: `400`. SL4 to samo zdanie
dwa razy z różnym `op`: dwa wpisy. SL5 `widzieli` pojawia się po `widzialem` z numerem nie mniejszym niż akt
słowa. SL6 słowo o nieistniejącej rzeczy: `404`. SL7 to samo zdanie od właściciela i od agenta, odpowiedź na
zdanie agenta: stoi w `pod` tylko pod wpisem agenta.

**Strony (SN).** SN1 strona rzeczy zawiera wszystkie części z 5.7 w kolejności. SN2 `<script>` w słowie jest
ucieczką. SN3 strona bez klucza nie zawiera nazwy rzeczy. SN4 spis mówi "7 z 7". SN5 poza podglądem nie ma
kluczy próbnych w tekście. SN6 każda strona ma słowo "próba" i zdanie o jawnych kluczach, gdy `podglad`.
SN7 rzecz z `niepoprawna` dostaje stronę z powodem.

**Wejście (WE).** WE1 nagłówek i ciasteczko dają to samo imię. WE2 złe ciasteczko: `401`. WE3 `dokad` równe
`//obca.strona`: przekierowanie na adres domyślny. WE4 POST z ciasteczkiem i obcym `Origin`: `403`; z nagłówkiem
`Authorization` bez `Origin`: przechodzi. WE5 `/wyjdz` kasuje ciasteczko. WE6 `/akt` z zewnątrz z `op`
zawierającym kropkę albo dwukropek: `400`.

**Klient (KL).** KL1 `naPlaszczyzne(naEkran(p))` oddaje `p`. KL2 przybliżenie w punkcie zostawia ten punkt
w miejscu. KL3 ciągnięcie zaczęte na karcie o rozmiarze 40 na 40 daje `poloz` ze zmienionym `x`, `y` i tym
samym rozmiarem. KL4 ciągnięcie zaczęte na uchwycie zmienia rozmiar, nie położenie. KL5 ruch poniżej 6 px:
`stuk`, bez `poloz`. KL6 `anuluj` w trakcie: bez `poloz`. KL7 w trakcie ruchu są tylko `podglad`, a `poloz`
jest jeden, na końcu. KL8 drugi palec w trakcie ciągnięcia karty anuluje je i zaczyna przybliżanie. KL9 uchwyt
przy dotyku ma co najmniej 44 px przy każdym przybliżeniu. KL10 automat daje ten sam układ dla tej samej listy
i nie nakłada kart na siebie. KL11 `wyslij` ponawia z tym samym `op` po błędzie sieci, nie ponawia po `409`
z powodem `wersja`, a po `op-zajety` bierze nowy `op` raz.

## 7. Sprawdziany pod adresem

Trzy poziomy. Wyższy nie zastępuje niższego.

**S: skrypt `tools/sprawdzian-kroku-1.mjs <adres>`.** Dwa niezależne urządzenia właściciela (A, B) i agent (G).
Pełny przebieg idzie na serwerze lokalnym i na osobnym podglądzie do sprawdzianów, nigdy na podglądzie,
którego używa właściciel: dziennik jest nieusuwalny, więc sprawdzian zostawiłby mu śmieci.

S1 zdrowie mówi, że pamięć i klucze są. S2 bez klucza `401` na danych, na stronie rzeczy i na `.json`.
S3 spis: `razem` 7 i `pokazane` 7; każda strona rzeczy ma w źródle nazwę, opis, wejście i datę pomiaru.
S4 A kładzie kartę, B czyta te same liczby. S5 jeden gest: liczba aktów rośnie o 2. S6 to samo `op`: `powtorzone`.
S7 zwinięcie i rozwinięcie: te same liczby. S8 dwie karty naraz z A i B: obie zostają. S9 ta sama karta naraz:
jedno `200`, jedno `409` z aktualnym stanem. S10 cofnięcie i ponowienie, potem nowy klient widzi to samo;
drugie cofnięcie z tym samym `akt` jest `powtorzone` i nie dopisuje aktu. S11 słowo A, odpowiedź G pod nim,
imiona z kluczy; pole `kto` w ciele to `400`, a przez `/akt` jest pomijane. S12 G nie przesunie karty
właściciela. S13 po `widzialem` G jest w `widzieli`. S14 każda strona ma "próba" i zdanie o kluczach.
S15 formularz bez JavaScriptu: z ciasteczkiem `303`, z obcym `Origin` `403`, bez ciasteczka `401`. S16 seria GET
nie zmienia liczby aktów. S17 stan przeżywa ponowne wdrożenie (`--zapamietaj` przed, `--porownaj` po).
S18 G nie zajmie przez `/akt` op `cofnij.akt:<nr>`: `400`.

**K: klikanie w przeglądarce**, najpierw na 1918 na 1030, potem na 375 na 812. K1 `data-gotowe="tak"` i 7 kart,
zgodnie z liczbą na `<body>`. K2 na telefonie nie ma przewijania w bok. K3 każda nazwa jest cała i ma co
najmniej 12 px. K4 cele dotyku mają co najmniej 44 px. K5 ciągnięcie małej karty za środek przesuwa ją i nie
zmienia rozmiaru. K6 ciągnięcie uchwytu zmienia rozmiar. K7 zwinięcie i rozwinięcie guzikiem. K8 cofnięcie po
przeładowaniu. K9 "próba" widać bez przewijania. K10 szkic słowa przeżywa przeładowanie. K11 stara karta dostaje
komunikat i aktualny stan, nic nie ginie. K12 strona przestrzeni ma w zwykłym tekście blok dla agentów z adresem danych.

**W: ręka właściciela.** Tego nie sprawdzi żaden agent: czy przesuwanie i zmiana rozmiaru są wygodne pod myszą
i pod kciukiem i czy pierwszy rzut oka jest zwarty. Wynik idzie do dziennika ocen, nie do tego pliku.

## 8. Granice, zapisane jako granice

- **Słowa bez indeksu.** Otwarcie strony rzeczy czyta wszystkie słowa. Przy 1000 słów i limicie 5 mln
  odczytanych wierszy na dobę to ok. 5000 otwarć. Wyjście bez zmiany formatu: indeks po polu `o`; nikt nie
  sprawdził go jeszcze w Durable Object.
- **Stos cofania czyta akty przestrzeni bez indeksu** i przy pełnym oknie sięga około 100 ruchów wstecz.
- **Jeden gest to ok. 7 do 8 zapisanych wierszy** razem z indeksami (do zmierzenia licznikiem magazynu),
  czyli ok. 12 000 gestów na dobę w limicie 100 000.
- **Odmowa `409` w wyścigu dwóch gestów zostawia jeden akt `zapisz` bez przesunięcia.**
- **Ruch wielu kart jednym gestem** to dziś wiele par aktów i wiele kroków cofania.
- **Zmiana nazwy repozytorium daje nową rzecz**, a słowa zostają przy starej. Rdzeń nie umie usunąć głowy,
  więc starej rzeczy nie da się dziś schować.
- **Doręczenie prywatnych słów** wymaga zmiany reguły widoczności w rdzeniu (3.3).
- **Klucze podglądu są jawne.** Każdy, kto zna adres, wejdzie jako właściciel próbny. Dlatego próba jest
  podpisana i nic prywatnego na nią nie trafia. Prywatne użycie wymaga wpuszczania urządzeń, którego tu nie ma.
- **Automat nie omija kart położonych ręcznie.**

## 9. Wygląd i droga do oczu właściciela

- Próba nie jest osobną stroną agenta. Stoi pod adresem nowej Jaskini, wchodzi się do niej z jej drzwi
  (pasek rzeczy do obejrzenia), a wygląda jak jego Jaskinia: te same barwy, krój pisma, kształt kart i zwarta
  góra. Źródłem jest stary dom opisany w [docs/dawcy/](dawcy/stara-jaskinia.md); wartości trafiają do jednego
  pliku `public/wspolne/jaskinia.css`.
- Szczegółowość karty ma w kroku 1 dwa poziomy, liczone z szerokości karty na ekranie: pełna karta albo kafelek.
  Nazwa jest zawsze cała, nigdy ucięta.
- Pierwsze otwarcie pokazuje wszystkie karty naraz, zwarto.

## 10. Reguły dla budujących i sprawdzających

1. Pracujesz tylko w plikach swojej paczki i tylko w katalogu, który dostałeś. Niczego nie wypychasz.
2. Nie dodajesz zależności i niczego nie pobierasz.
3. Nie zmieniasz sprawdzianów, żeby przeszły. Sprawdzian, który uważasz za błędny, zgłaszasz z powodem.
4. Raport: lista dotkniętych plików, polecenia z wynikami, ile przypadków z listy pokryłeś z ilu, czego nie
   sprawdziłeś. Raport nie jest pomiarem: druga osoba powtarza polecenia.
5. Sprawdzający psuje jedno zachowanie naraz i patrzy, czy któryś sprawdzian się wywraca. Zachowanie, którego
   zepsucia nikt nie zauważa, jest dziurą w sprawdzianach, a nie dowodem jakości.
6. Dwie nieudane próby tej samej hipotezy: zmiana podejścia i zgłoszenie, nie trzecia próba.

## 11. Co zmienił atak (wersja 2, 15 XI 2026)

Druga para oczu przeczytała wersję 1 i uruchomiła 27 prób na prawdziwym rdzeniu, zanim powstał kod.
Najważniejsze zmiany:

1. `nawiazuje` w słowie wskazuje akt, nie zapis: to samo zdanie od dwóch autorów było jednym zapisem
   i odpowiedź stawała pod oboma.
2. Cofanie rozróżnia akt, który trzyma wpis, od aktualnej wersji głowy. Wersja 1 mówiła o jednej liczbie
   i przy karcie ruszonej dwa razy cofnięcie dostawało odmowę.
3. `akt` w cofnięciu jest obowiązkowy i musi być wierzchem: bez tego ponowione żądanie cofało dwa ruchy
   po jednym naciśnięciu.
4. Akt cofnięcia albo ponowienia, którego cel wypadł z okna, odtwarza wpis z samego siebie: bez tego po
   70 ruchach i 70 cofnięciach dało się ponowić tylko 61.
5. `op` ma gramatykę: klient nie używa kropki ani dwukropka, a drzwi `/akt` ich z zewnątrz nie przyjmują.
   Bez tego agent mógł z góry zająć `op` cudzego cofnięcia.
6. Kolejność kroków w `poloz` jest częścią umowy, razem z tym, ile aktów zostawia odmowa.
7. Postać kanoniczna wpisuje wszystkie pola; nazwy głów kart dostały człon rodzaju; `telefon` mówi o deklaracji
   strony, nie o działaniu; data siewu nie przesuwa głów; czytający sprawdza zapis pod głową.
