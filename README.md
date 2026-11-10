# Jaskinia

Warsztat do tworzenia, uruchamiania i rozwijania gier oraz eksperymentów, budowany przez właściciela razem z agentami AI. W budowie.

- Kod jest jawny. Dane właściciela (notatki, werdykty, układy, materiały) żyją poza tym repo.
- Na razie:
  - `tools/straznik.mjs`: strażnik granicy publiczne/prywatne, uruchamiany przed każdym commitem i w CI;
  - `proby/`: próby, które sprawdzają założenia. Żadna z nich nie jest jeszcze fundamentem;
  - `wrangler.jsonc`, `public/`, `worker/`: szkielet wdrożenia na Cloudflare Workers. Pusty podgląd i `/api/zdrowie`, które mówi, czy ustawienia są na miejscu, bez pokazywania sekretów.
  - `/api/fakty` i lista na stronie: publiczne repo właściciela prosto z API GitHuba, z wiekiem faktów i luką zamiast zera (próba);
  - `/dom/`: dzisiejszy Dom (stara Jaskinia z GitHub Pages) pod adresem Workera, jako most do czasu, aż nowa Jaskinia pokaże własne rzeczy;
  - podgląd każdej gałęzi: Workers Builds z `npx wrangler preview` (Worker Previews), a `main` przez `npx wrangler deploy`.
- Co jest tymczasowe i kiedy do tego wracamy: [TYMCZASOWE.md](TYMCZASOWE.md).
- Dawcy, z których budujemy: [docs/dawcy/](docs/dawcy/stara-jaskinia.md) (na początek stara Jaskinia, moduł po module).
- Testy: `npm test` (Node 18 lub nowszy; jedyna zależność, `wrangler`, służy tylko do wdrożenia).

Licencja: na razie brak, więc obowiązują domyślne prawa autorskie.
