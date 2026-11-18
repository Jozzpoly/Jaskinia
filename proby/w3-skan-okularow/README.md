# W3: skan okularów — która publiczna metoda czyta rzeczy obok widoku

**Po co.** Strażnik W16 (`worker/widocznosc.test.mjs`) pilnował, żeby żadna publiczna metoda środowiska
nie pytała bazy obok okularów czytającego. Pytał jednak tylko o SUROWY SQL w ciele metody — i dlatego
przepuścił dwie metody, które czytają bazę **przez inną metodę**:

- `ksztalty()` (przez `wszystkie()`): rodzaj opisany kształtem w obszarze zamkniętym wychodził w liście
  rodzajów **każdemu** czytającemu, z nazwą i opisem. Nazwa rodzaju mówi, czym ktoś się zajmuje.
- `ustawienie()` (przez `rzecz()`): obszar jawny położony w obszarze zamkniętym podawał w polu `skad`
  identyfikator swojego ukrytego rodzica — w opisie Miejsca, przy każdym obszarze.

Pierwszą wskazał Fable (drugi atak na tę granicę, 17 XI 2026); drugą znalazł ten skan, szukając
metod tego samego kształtu. Obie poprawione, oba kierunki w sprawdzianach W17 i W18.

**Wniosek, który zostaje:** strażnik, który łapie jeden kształt błędu, sam jest dziurą. W16 pyta
dziś także o czytanie pośrednie, a każda metoda spoza listy owiniętych musi być wypisana z powodem.

**Jak uruchomić** (działa na dowolnej kopii repozytorium, bez Cloudflare i bez bazy w chmurze):

    KOPIA=<katalog repozytorium> node proby/w3-skan-okularow/trzy-twierdzenia.mjs

Sprawdza trzy twierdzenia u źródła, a nie z opisu: (1) czy drzwi ustawień są wyrocznią istnienia
(nakładka z ukrytym identyfikatorem wobec nakładki z identyfikatorem, którego nie ma — punkt chodzi
tylko na gałęzi, która ma `worker/ustawienia.mjs`), (2) czy rodzaj z zamkniętego obszaru wychodzi
w liście rodzajów, (3) czy uczestnik z odłożonym wpisem traci prawa.

## Zasiew po skrócie (18 XI 2026): co jeszcze sprawdza ta próba

Fable dołożył do zasiewu **odcisk całości** (`zasiew:calosc`): gdy lista ziaren jest ta sama co przy ostatnim
pełnym przejściu, obudzenie Miejsca pyta bazy raz zamiast 243 razy (82 wiersze zamiast 317 pod adresem).
Sam poprosił o cudze oczy właśnie tam, swoimi słowami: *„to jest mechanizm, który milczy, kiedy się myli”*.

- `zasiew-po-skrocie.mjs` — czy skrót nie wyłącza naprawy rzeczy zajętej cudzą ręką i czy zasiew dalej
  ustępuje ręce (odłożone zostaje odłożone). **Trzyma.**
- `zasiew-widzi-zmiane.mjs` — czy odcisk widzi każdą zmianę ziaren: treści, ziarna liczonego **funkcją**
  (to był kształt jego własnego wcześniejszego błędu), usunięcie ziarna z kodu i powrót do pełnej listy.
  **Trzyma w czterech na cztery.**
- `ksztalt-zamarza.mjs` — i rzecz starsza niż tamten skrót, która z niego wyszła: **kształt raz zmieniony
  ręką właściciela nie dostanie żadnej nowej reguły sprawdzania z kodu, po cichu** (`zasiew ustępuje ręce`
  dotyczy też kształtów). Nie jest to błąd w niczyjej zmianie; jest to pytanie o fundament, zgłoszone
  z poleceniem: czy umowa o danych ma ustępować ręce tak samo jak treść właściciela.
