# Rejestr tymczasowości (sprawy techniczne)

Rozwiązania techniczne, których używamy, choć nie są docelowe. Żadne z nich nie jest fundamentem tylko dlatego, że działa (zasada 7 w [AGENTS.md](AGENTS.md)). Przeczytaj ten plik przed pierwszym commitem i dopisz wpis, gdy wprowadzasz coś tymczasowego.

**Statusy:** *próba* (może zniknąć, nic na niej nie budujemy), *tymczasowe* (w użyciu, z warunkiem powrotu), *fundament* (zapisana decyzja, dowód na prawdziwym przypadku, porównanie z co najmniej jednym innym rozwiązaniem i ścieżka migracji danych). Każdy może zaproponować zburzenie wpisu, jeśli ma dowód.

| Co | Status | Dlaczego teraz | Co może to zastąpić | Kiedy wracamy |
| --- | --- | --- | --- | --- |
| `proby/e1-wersje`: model wersji, propozycji, przypięć i werdyktów | próba | sprawdza założenia na małym kodzie dla jednego przypadku: dzieła właściciela | wynik porównania z innymi rdzeniami (sesje edycji z cofaniem, rewizje lokalne) | przy zapisie architektury v1. Znana wada: ścieżki pól łączone kropką, więc klucz `a.b` i zagnieżdżone `a` → `b` zlewają się w porównaniu; E1 umie też tylko przypinać wersje, a nie przyjmować ulepszeń bazowego assetu |
| Czysty JavaScript (moduły `.mjs`) bez TypeScriptu | tymczasowe | zero zależności, ten sam kod w Node i przeglądarce | TypeScript albo JSDoc z typami | przed pierwszym kodem o statusie fundamentu |
| Brak zależności npm i `node --test` jako jedyne narzędzie testów | tymczasowe | wystarcza dla prób i strażnika | bundler i narzędzia testów przeglądarkowych | gdy pierwszy interfejs będzie wymagał budowania |
| Node 22 w CI | tymczasowe | stabilna wersja LTS | wersja zgodna z podpinanymi światami (np. 24.x) | przy pierwszym świecie podpiętym adapterem |
| Strażnik w CI sprawdza tylko sekrety i cudzysłowy; prywatne wzorce sprawdza lokalny hook | tymczasowe | wzorce są prywatne, a logi CI publiczne | sekret repozytorium z wzorcami dla CI (wyniki i tak nie pokazują dopasowań) | gdy commituje agent bez lokalnego hooka |
| Szkielet Workera: `wrangler.jsonc`, `public/`, `worker/` | tymczasowe | droga na urządzenia właściciela przez Cloudflare Workers ze statycznymi plikami | inny układ projektu po zapisie architektury v1 | po pierwszym podglądzie na telefonie i po architekturze v1 |
| `/api/zdrowie` bez weryfikacji tokenu Access | tymczasowe | szkielet nie ma jeszcze danych do chronienia | weryfikacja JWT z `POLICY_AUD` i `TEAM_DOMAIN` przy każdym żądaniu API | zanim API dotknie jakichkolwiek danych |
| Brak licencji | tymczasowe | decyzja należy do właściciela | licencja wybrana przez właściciela | przed otwarciem dla innych |
