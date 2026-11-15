// Durable Object Miejsca: jedna instancja na przestrzeń, z własną bazą SQLite. Status: próba (TYMCZASOWE.md).
// Wzięte z dawcy `claude/miejsce-wspolne-2026-11-11` (11 XI 2026) do kroku 1 rdzenia (15 XI 2026).
// Względem dawcy wypadł most do repozytorium agentów (alarm i `most.mjs`): krok 1 ma stały budżet czterech
// punktów i most do niego nie należy. W `miejsce.mjs` zostały po nim metody i zamknięta ścieżka `most/…`;
// nikt ich stąd nie woła. Zostają do decyzji, czy most wraca, czy znika (wpis w TYMCZASOWE.md).
// Zwykła klasa z fetch(), bez importu cloudflare:workers, żeby testy w Node mogły ładować moduł główny.
// Cloudflare trzyma tę bazę po stronie serwera, z odtworzeniem do dowolnej chwili z ostatnich 30 dni
// (point-in-time recovery dla Durable Objects z SQLite).
import { Rdzen, obsluzMiejsce } from './miejsce.mjs';

export class Miejsce {
  constructor(ctx, env = {}) {
    this.ctx = ctx;
    this.env = env;
    this.rdzen = new Rdzen(ctx.storage.sql);
  }

  async fetch(request) {
    return obsluzMiejsce(this.rdzen, request);
  }
}
