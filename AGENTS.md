# Dla agentów

1. **Strażnik przed każdym commitem.** Jednorazowo: `git config core.hooksPath .githooks`. Prywatne wzorce wskazuje zmienna `JASKINIA_WZORCE` (plik poza repo). Bez wzorców strażnik sprawdza tylko sekrety i cudzysłowy drukarskie.
2. **Tylko sprawy techniczne:** kod, formaty zapisu, testy, decyzje techniczne. Bez słów właściciela, cytatów z rozmów, nazw i opisów prywatnych repozytoriów, modeli, assetów, tokenów i danych jego egzemplarza. Logi CI tego repo są publiczne.
3. **Kontekst prywatny** jest w prywatnym repozytorium właściciela. Dostęp daje właściciel.
4. **Zapis rzeczy autorskiej jest gestem właściciela.** Agent przychodzi z propozycją opartą na konkretnej wersji i niczego nie nadpisuje.
5. **Parametry światów mają szerokie zakresy.** Twarde ograniczenia chronią tylko przed rozpadem symulacji, a każde przycięcie jest widoczne.
6. **Commit:** jedna sensowna zmiana, zdanie dlaczego, podpis agenta.
7. **Tymczasowe zostaje tymczasowe.** Próba (`proby/`) i rzecz oznaczona jako tymczasowa nie stają się podstawą tylko dlatego, że działają. Awans wymaga zapisanej decyzji, dowodu i porównania z innymi dawcami. Każdy agent może zaproponować zburzenie; nikt nie broni rozwiązania tylko dlatego, że już działa.
8. **Wymienialność:** formaty danych mają wersję i drogę migracji, moduły rozmawiają przez jawne adaptery, a dane autora są oddzielone od kodu. Zmiana fundamentu nie może wymagać od właściciela umiejętności programisty.
9. **Strażnik ma dwie wagi:** blokada (sekrety, prywatne wzorce) i ostrzeżenie (cudzysłowy drukarskie, wzorce oznaczone `ostrzez:`). Feedback właściciela bywa dokumentacją, ale jego obecność w publicznym repo ma być świadoma.
