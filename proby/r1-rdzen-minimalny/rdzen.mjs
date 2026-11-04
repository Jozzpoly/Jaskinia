// Próba R1: minimalny rdzeń zapisów według docs/rdzen-zapisow-szkic.md.
// Tylko zapisy (niezmienne, tożsamość z treści), głowy (porównaj i zamień, prawa według stopni) i dziennik.
// Wszystko inne (porównanie pól, przypięcia, wątki uwag) ma żyć w modułach konsumentów.
import { sha256hex } from '../e1-wersje/sha256.mjs';
import { canonical } from '../e1-wersje/versions.mjs';

export const recordId = (kind, content) => 'z_' + sha256hex(canonical({ kind, content })).slice(0, 16);

// Prawa głowy: 'wlasciciel' (przesuwa tylko właściciel), 'agent:<kto>' (tylko ten agent), 'wspolna' (każdy, ze śladem w dzienniku).
export class Rdzen {
  #zapisy = new Map();
  #glowy = new Map();
  #dziennik = [];

  zapisz(kind, content, kto, links = []) {
    const id = recordId(kind, { content, links });
    if (!this.#zapisy.has(id)) {
      this.#zapisy.set(id, Object.freeze({ id, kind, content: JSON.parse(canonical(content)), links: Object.freeze([...links]), kto: kto.who }));
      this.#log({ typ: 'zapis', id, kind, kto: kto.who });
    }
    return id;
  }
  zapis(id) { return this.#zapisy.get(id) ?? null; }

  zalozGlowe(nazwa, prawa, kto) {
    if (this.#glowy.has(nazwa)) throw new Error('Głowa już istnieje: ' + nazwa);
    this.#glowy.set(nazwa, { na: null, prawa });
    this.#log({ typ: 'glowa', nazwa, prawa, kto: kto.who });
  }
  glowa(nazwa) { return this.#glowy.get(nazwa)?.na ?? null; }

  // Porównaj i zamień: przesuwa tylko wtedy, gdy głowa nadal wskazuje `z`. Stara karta nie nadpisze nowszego stanu.
  przesun(nazwa, z, na, kto, dlaczego = '') {
    const g = this.#glowy.get(nazwa);
    if (!g) throw new Error('Nie ma głowy: ' + nazwa);
    if (!this.#moze(g.prawa, kto)) throw new Error(`${kto.who} nie może przesunąć głowy ${nazwa}`);
    if (!this.#zapisy.has(na)) throw new Error('Nie ma zapisu: ' + na);
    if (g.na !== z) return { ok: false, teraz: g.na };
    g.na = na;
    this.#log({ typ: 'przesun', nazwa, z, na, kto: kto.who, dlaczego });
    return { ok: true };
  }
  #moze(prawa, kto) {
    if (prawa === 'wspolna') return true;
    if (prawa === 'wlasciciel') return kto.role === 'owner';
    if (prawa.startsWith('agent:')) return kto.who === prawa.slice(6);
    return false;
  }

  dziennik(od = 0) { return this.#dziennik.filter(e => e.n > od).map(e => ({ ...e })); }
  #log(e) { this.#dziennik.push({ n: this.#dziennik.length + 1, ...e }); }

  eksport() {
    return JSON.stringify({ format: 'rdzen-r1', wersja: 1, zapisy: [...this.#zapisy.values()], glowy: Object.fromEntries(this.#glowy), dziennik: this.#dziennik });
  }
  static importuj(tekst) {
    const d = JSON.parse(tekst);
    if (d.format !== 'rdzen-r1' || d.wersja !== 1) throw new Error('Nieznany format');
    const r = new Rdzen();
    for (const z of d.zapisy) {
      if (recordId(z.kind, { content: z.content, links: z.links }) !== z.id) throw new Error('Zła tożsamość zapisu: ' + z.id);
      r.#zapisy.set(z.id, Object.freeze({ ...z, links: Object.freeze([...z.links]) }));
    }
    for (const [n, g] of Object.entries(d.glowy)) r.#glowy.set(n, { na: g.na, prawa: g.prawa });
    r.#dziennik = d.dziennik.map(e => ({ ...e }));
    return r;
  }
}
