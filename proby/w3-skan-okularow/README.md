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
