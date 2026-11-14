# Jaskinia

Warsztat do tworzenia, uruchamiania i rozwijania gier oraz eksperymentów, budowany przez właściciela razem z agentami AI. W budowie.

- Kod jest jawny. Dane właściciela (notatki, werdykty, układy, materiały) żyją poza tym repo.
- Na razie:
  - `tools/straznik.mjs`: strażnik granicy publiczne/prywatne, uruchamiany przed każdym commitem i w CI;
  - `tools/drogi.mjs`: sprawdza, czy do każdego dokumentu da się dojść od tej strony i czy każdy odnośnik dokądś prowadzi ([DROGI.md](DROGI.md) to wynik ostatniego sprawdzenia);
  - [`proby/`](proby/README.md): próby, które sprawdzają założenia. Żadna z nich nie jest jeszcze fundamentem;
  - `wrangler.jsonc`, `public/`, `worker/`: szkielet wdrożenia na Cloudflare Workers. Pusty podgląd i `/api/zdrowie`, które mówi, czy ustawienia są na miejscu, bez pokazywania sekretów.
  - `/api/fakty` i lista na stronie: publiczne repo właściciela prosto z API GitHuba, z wiekiem faktów i luką zamiast zera (próba);
  - `/dom/`: dzisiejszy Dom (stara Jaskinia z GitHub Pages) pod adresem Workera, jako most do czasu, aż nowa Jaskinia pokaże własne rzeczy;
  - podgląd każdej gałęzi: Workers Builds z `npx wrangler preview` (Worker Previews), a `main` przez `npx wrangler deploy`.
- Co jest tymczasowe i kiedy do tego wracamy: [TYMCZASOWE.md](TYMCZASOWE.md).
- Dawcy, z których budujemy: [docs/dawcy/](docs/dawcy/stara-jaskinia.md) (na początek stara Jaskinia, moduł po module).
- Szkic rdzenia zapisów, zanim cokolwiek z niego awansuje: [docs/rdzen-zapisow-szkic.md](docs/rdzen-zapisow-szkic.md).
- Co już stąd żyje pod adresem: [`/studio/`](https://jaskinia.jozzpoly.workers.dev/studio/) (okna Studia R1 i R2 zbudowane z gałęzi starej Jaskini), [`/powroty/`](public/powroty/README.md) (wyprawa agenta z 29 IX, którą da się otworzyć i ruszyć) i [`/dowody-studio-r2/`](public/dowody-studio-r2/README.md) (dziesięć przebiegów CI Studia R2 z 10 XI, których artefakty wygasają 17 XI).
- Testy: `npm test` (Node 18 lub nowszy; jedyna zależność, `wrangler`, służy tylko do wdrożenia).

## Gdzie to jest i co jest obok

Ten warsztat nie stoi sam. Żeby nie trzeba było tego za każdym razem odtwarzać, adresy są tutaj,
a nie w czyjejś pamięci.

| Rzecz | Adres | Czym jest |
| --- | --- | --- |
| ten warsztat, na żywo | [jaskinia.jozzpoly.workers.dev](https://jaskinia.jozzpoly.workers.dev) | to repo wdrożone na Workera; każda gałąź ma własny podgląd |
| stara Jaskinia | [repo](https://github.com/Jozzpoly/Jozz-Cave-Workbench) · [na żywo](https://jozzpoly.github.io/Jozz-Cave-Workbench/) | dzisiejszy Dom właściciela: okna, układy, materiały, Kataster. Dawca, z którego tu budujemy |
| Medium | [repo](https://github.com/Jozzpoly/Shared-Work-Medium-Lab) | badania nad tym, co ciała agentów realnie osiągają i jak to udowadniać; wyniki negatywne, których nie ma nigdzie indziej |
| Feniks Studio | [repo](https://github.com/Jozzpoly/Feniks-Studio) | narzędzie do tworzenia miejsc i tworzywa; wstrzymane do czasu rozstrzygnięcia, gdzie ma rosnąć |

Prywatny kontekst właściciela (jego słowa, decyzje, rundy agentów) żyje poza wszystkimi tymi repozytoriami i dostęp do niego daje on sam.

Licencja: na razie brak, więc obowiązują domyślne prawa autorskie.
