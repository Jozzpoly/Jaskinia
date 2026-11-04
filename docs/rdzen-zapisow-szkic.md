# Rdzeń zapisów — szkic do etapu 1B (4 XI 2026)

**Status: szkic do obalenia.** To nie jest decyzja ani fundament.

## Problem

Fundament definiuje jego pierwszy konsument (obserwacja z korpusu sesji agentów z lat poprzednich). Próba `proby/e1-wersje` wpisała do rdzenia porównanie pól z trzech stron, przypięcia i werdykty. Wszystkie trzy są potrzebne ustawieniom pojazdu, ale nie uwagom ani zapisom agenta. Gdyby E1 stało się rdzeniem, ustawienia pojazdu zdefiniowałyby całą Jaskinię.

Odpowiedź: rdzeń ma być **częścią wspólną trzech różnych konsumentów naraz**, a wszystko inne ma żyć w modułach konsumentów.

## Trzej pierwsi konsumenci

| Konsument | Kształt | Jak się zmienia | Kto zapisuje (stopnie z `AGENTS.md`, zasada 4) |
| --- | --- | --- | --- |
| Wersje ustawień pojazdu (warsztat) | JSON, dziesiątki pól | kolejne wersje; propozycje agentów jako różnice; przypięcia światów; werdykty | wersję zapisuje właściciel; agent proponuje |
| Uwagi i odpowiedzi (biurko) | krótki tekst, czas, kontekst organu (do 8 KB) | nie zmieniają się; poprawka to nowa uwaga ze wskazaniem starej; wątki | właściciel i agenci, każdy swoje |
| Próba agenta (jego własna rzecz) | dowolna treść i stan | agent zmienia ją swobodnie | agent sam, w swojej przestrzeni; właściciel ogląda i ocenia |

## Co jest wspólne, czyli rdzeń

1. **Zapis:** niezmienny. Ma treść (nieprzezroczysty JSON albo tekst), rodzaj, autora i czas oraz tożsamość z treści, czyli skrót rodzaju i treści. Może wskazywać inne zapisy po tożsamości.
2. **Głowa:** nazwany, zmienny wskaźnik na zapis, na przykład `ustawienia:m6/glowna`, `uwagi:skrzynka` albo `agent:opus-code/proba-7`. Każda głowa ma właściciela i prawa według stopni. Przesunięcie głowy zawsze podaje, skąd przesuwa (porównaj i zamień), więc karta ze starym stanem nie nadpisze nowszego. To usuwa całą klasę błędu wskrzeszania uwag ze starej Jaskini.
3. **Dziennik:** zdarzenia tylko dopisywane (utworzenie zapisu, przesunięcie głowy, kto, kiedy, dlaczego). To z niego da się odpowiedzieć na pytanie *co się działo, gdy mnie nie było*, czyli zapewnić ponowne spotkanie.
4. **Trwałość za adapterem:** najpierw lokalnie w przeglądarce, z eksportem i importem do plików. Później repo danych albo magazyny Cloudflare. Ratunek dla danych nieczytelnych zostaje w adapterze, jak w starym magazynie.

## Czego w rdzeniu nie ma (moduły konsumentów)

- porównania pól i łączenia z trzech stron (moduł ustawień; trafia tu kod E1);
- przypinania i przyjmowania ulepszeń bazowej wersji (moduł ustawień i biblioteki);
- znaczenia werdyktu (to po prostu zapis, który wskazuje wersję; sens nadaje moduł);
- wątków i stanu uwag (moduł biurka);
- sesji edycji z cofaniem (warstwa nad rdzeniem; dawca: rdzeń dokumentu z Feniks-Studio), która tworzy szkic i kończy się zapisem;
- telemetrii (sygnały nie są zapisami; najwyżej migawki).

## E1 w tym podziale

- Tożsamość wersji to tożsamość zapisu.
- Zapis właściciela to nowy zapis i przesunięcie głowy, do którego prawo ma tylko on.
- Propozycja agenta to zapis agenta ze wskazaniem podstawy.
- Przypięcie świata to głowa świata.
- Werdykt to zapis, który wskazuje wersję.

Wszystko z E1 da się więc rozłożyć na mały rdzeń i moduł *ustawienia*, bez utraty żadnego zachowania, które dziś sprawdzają testy. To samo jest sposobem taniego burzenia: moduł wymienia się bez ruszania rdzenia.

## Jak obalić ten szkic

1. Trzej konsumenci zbudowani na rdzeniu, każdy w kilkudziesięciu liniach, **bez dopisywania do rdzenia żadnego pojęcia**. Jeśli któryś musi coś dopisać, najpierw pytamy, czy to naprawdę wspólne.
2. Test wielu kart: dwie karty przesuwają tę samą głowę i żadna nie wskrzesza starego stanu.
3. Test ponownego spotkania: agent tworzy 20 zapisów pod nieobecność właściciela, a jedno zapytanie do dziennika mówi, co się zmieniło.
4. Test eksportu i importu: całość przechodzi tam i z powrotem bez zmian tożsamości.
5. Kontrprzykłady K1–K5 (gałąź `opus-code/e1-kontrprzyklady`) dalej przechodzą w module *ustawienia*.

## Zasady starego magazynu, które się tu mieszczą

| Stara zasada | W tym szkicu |
| --- | --- |
| kopie przed każdym ryzykownym krokiem | niezmienne zapisy niosą historię same; kopie zostają tylko dla danych spoza rdzenia |
| ratunek dla tego, czego nie da się odczytać | w adapterze trwałości |
| nic nie jest podmieniane po cichu | porównaj i zamień na każdej głowie i dziennik |
| uwagi żyją poza układami | osobne głowy dla uwag i dla układów |
