# Dla agentów

1. **Strażnik przed każdym commitem.** Jednorazowo: `git config core.hooksPath .githooks`. Prywatne wzorce wskazuje zmienna `JASKINIA_WZORCE` (plik poza repo). Bez wzorców strażnik sprawdza tylko sekrety i cudzysłowy drukarskie.
2. **Głównie sprawy techniczne:** kod, formaty zapisu, testy, decyzje techniczne. Słowa właściciela i nazwy jego repozytoriów trafiają tu tylko świadomie, gdy służą dokumentacji (zasada 9). Nigdy: sprawy osobiste, tokeny i klucze, lokalne ścieżki, modele, assety i dane jego egzemplarza. Logi CI tego repo są publiczne.
3. **Kontekst prywatny** jest w prywatnym repozytorium właściciela. Dostęp daje właściciel.
4. **Prawo do skutku zależy od odwracalności, nie od tożsamości.** Czytać i pytać może każdy. Proponować też, widocznie i bez skutku do przyjęcia. Działać w izolacji (własna gałąź, kopia świata, próba obok) agent może bez pytania. Wspólne rzeczy zmienia odwracalnie i ze śladem w obszarze, który mu powierzono. Dzieła właściciela zmienia tylko jako propozycję opartą na konkretnej wersji albo w zakresie zleconym z góry; ich zapis jest gestem właściciela. Rzeczy nieodwracalne (usuwanie, publikacja, pieniądze, dostępy) należą wyłącznie do właściciela.
5. **Parametry światów mają szerokie zakresy.** Twarde ograniczenia chronią tylko przed rozpadem symulacji, a każde przycięcie jest widoczne.
6. **Commit:** jedna sensowna zmiana, zdanie dlaczego, podpis agenta.
7. **Tymczasowe zostaje tymczasowe.** Próba (`proby/`) i rzecz oznaczona jako tymczasowa nie stają się podstawą tylko dlatego, że działają. Awans wymaga zapisanej decyzji, dowodu i porównania z innymi dawcami. Każdy agent może zaproponować zburzenie; nikt nie broni rozwiązania tylko dlatego, że już działa. Ceremonia rośnie z kosztem odwrócenia: rzeczy tanie do cofnięcia nie potrzebują statusów ani porównań, pełna procedura dotyczy formatów danych, publicznych umów między modułami i granic bezpieczeństwa. Mechanizm ochronny, którego nie da się zakwestionować ani przebudować, sam jest betonem.
8. **Wymienialność:** formaty danych mają wersję i drogę migracji, moduły rozmawiają przez jawne adaptery, a dane autora są oddzielone od kodu. Zmiana fundamentu nie może wymagać od właściciela umiejętności programisty.
9. **Strażnik ma dwie wagi:** blokada (sekrety, prywatne wzorce) i ostrzeżenie (cudzysłowy drukarskie, wzorce oznaczone `ostrzez:`). Feedback właściciela bywa dokumentacją, ale jego obecność w publicznym repo ma być świadoma.
10. **Rejestr tymczasowości:** przeczytaj [TYMCZASOWE.md](TYMCZASOWE.md) przed pierwszym commitem. Wprowadzasz coś tymczasowego, to dopisujesz wpis: co, dlaczego teraz, co może to zastąpić i kiedy wracamy.
11. **Dwie nieudane próby tej samej hipotezy** oznaczają zmianę podejścia i zgłoszenie, a nie trzecią próbę tego samego.
12. **Sekrety tylko w ustawieniach Cloudflare i GitHuba,** nigdy w kodzie, plikach, logach ani w odpowiedziach API. Kod może najwyżej powiedzieć, czy sekret jest ustawiony.
13. **Konsumuj cudzą pracę.** Porzucony zapis innego agenta to materiał, nie cudzy teren: wchodzisz w niego, wchłaniasz żywe, oznaczasz martwe i zostawiasz oryginał pod spodem. Terenem jest tylko cudza gałąź, cudzy plik w trakcie pracy i cudza decyzja. Zanim założysz nowy dokument, znajdź ten, który już jest o tym samym, i dopisz tam; nowy zakładasz, gdy naprawdę nie ma gdzie. Wracasz po przerwie — najpierw sprawdź, co zmieniło się w środowisku, zamiast wracać do miejsca, w którym skończyłeś. Powód jest zmierzony (16 XI 2026, historia gita wspólnego repozytorium agentów): **738 nowych dokumentów na 32 wejścia w cudzą treść, 23 do 1**; 94% plików ma jednego autora przez całe życie. Właściciel prosił o porządek pięć razy i po każdej prośbie przybywało 22–57 nowych dokumentów i zero albo jedna konsumpcja. Pisanie obok wygląda na wynik, a jest zatorem.

## Słowa właściciela: kiedy agenci scalają sami (14 XI 2026, 23:46)

Jego własne zdanie, dosłownie, z literówkami i bez naszej parafrazy — on sam ujął je w cudzysłów
jako oświadczenie zgody:

> Agenci scalają swoje pr gdy CI jest zielone i druga linia sprawdziła je u źródła.
> Pr który który mówi, że sam jest dowodem albo decyzja o fundamencie,  scalają tylko po mojej zgodzie, wystarczy tylko "tak", albo inny synonim zgody lub potwierdzenia.

Zaraz po nim dodał: *Nie jestem pewny czy to wystarczy na dłużej ale jakby co to będziemy budować
lepsze wersję w przyszłości.* Czyli ta zasada sama jest tymczasowa (zob. rejestr tymczasowości).

**Nasza wykładnia, nasza — nie jego.** Druga linia to agent, który **nie** robił tej zmiany i powtórzył
polecenia u źródła: testy, próbne scalenie z dzisiejszym `main`, sprawdzenie pod żywym adresem, jeśli
rzecz ma adres. Wynik zapisuje z poleceniem, w PR-ze albo w przekazie między liniami. Gdy opis PR-a
mówi o sobie, że jest dowodem, a autor zmienił zdanie później — wygrywa wersja ostrożniejsza, dopóki
właściciel nie powie *tak*. Z nim zostają, jego własnymi słowami: *„Istotne nieodwracalne decyzje dotyczące mojego dorobku,
prywatności, dostępu, pieniędzy i rzeczywistego przełączenia używanej Jaskini”* (rozmowa z Opusem czatu, tura 153, ok. 10 XI wieczorem — datę podaje raport odcinka tur 150–164, liczony z treści tur, bo sam zapis rozmowy nie ma godzin). Scalenie, które przełącza jego codzienne okno, nie jest *swoim PR-em* w sensie tej zgody.
