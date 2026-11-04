# Jaskinia

Warsztat do tworzenia, uruchamiania i rozwijania gier oraz eksperymentów, budowany przez właściciela razem z agentami AI. W budowie.

- Kod jest jawny. Dane właściciela (notatki, werdykty, układy, materiały) żyją poza tym repo.
- Na razie:
  - `tools/straznik.mjs`: strażnik granicy publiczne/prywatne, uruchamiany przed każdym commitem i w CI;
  - `proby/`: próby, które sprawdzają założenia. Żadna z nich nie jest jeszcze fundamentem;
  - `wrangler.jsonc`, `public/`, `worker/`: szkielet wdrożenia na Cloudflare Workers. Pusty podgląd i `/api/zdrowie`, które mówi, czy ustawienia są na miejscu, bez pokazywania sekretów.
- Co jest tymczasowe i kiedy do tego wracamy: [TYMCZASOWE.md](TYMCZASOWE.md).
- Dawcy, z których budujemy: [docs/dawcy/](docs/dawcy/stara-jaskinia.md) (na początek stara Jaskinia, moduł po module).
- Testy: `npm test` (Node 18 lub nowszy, bez zależności).

Licencja: na razie brak, więc obowiązują domyślne prawa autorskie.
