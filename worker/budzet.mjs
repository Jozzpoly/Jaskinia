// Budżet wierszy: licznik tego, ile wierszy bazy to Miejsce przeczytało i zapisało, oraz dobowy bezpiecznik zapisów
// (17 XI 2026). Status: próba (TYMCZASOWE.md).
// Po co: darmowy plan liczy wiersze na dobę WSPÓLNIE dla całego konta (100 000 zapisanych, 5 000 000 czytanych).
// Jedno Miejsce, w którym agent zapętli ruchy albo obserwator przyniesie setki rzeczy naraz, zatrzymałoby zapis we
// wszystkich pozostałych aż do północy czasu UTC. Dlatego każde Miejsce mierzy swoje wiersze u źródła (baza sama
// podaje przy każdym zapytaniu, ile wierszy przeczytało i zapisało) i może mieć własny dobowy limit zapisów.
// Liczba bez polecenia, którym da się ją powtórzyć, nie jest pomiarem: koszt każdego żądania wychodzi w nagłówku
// odpowiedzi (x-koszt), a suma doby stoi w /co-tu-jest.
// Czego ten licznik NIE wie: ile zapisały inne Miejsca na tym samym koncie. Zna tylko siebie.
// Ten plik nie zna Cloudflare: dostaje obiekt sql z metodą exec, jak jądro.

export const LIMIT_KONTA = { zapisane: 100000, czytane: 5000000 };
const PRZEDROSTEK = 'budzet:';
const dzienZ = (ms) => new Date(ms).toISOString().slice(0, 10);

// Owija sql tak, żeby każde zapytanie doliczało swoje wiersze do wspólnego licznika. Baza podaje liczby na kursorze
// (rowsRead, rowsWritten) i mogą one rosnąć, dopóki wynik jest czytany, więc doliczamy po każdym użyciu kursora.
// Poza Cloudflare (sprawdziany w Node) kursor tych liczb nie ma i licznik stoi na zerze.
export function liczacySql(sql) {
  const licznik = { czytane: 0, zapisane: 0 };
  return {
    licznik,
    get databaseSize() { return sql.databaseSize; },
    // transakcja bazy przechodzi bez zmian (w sprawdzianach daje ją sql-node.mjs; w obiekcie daje ją ctx.storage)
    ...(typeof sql.transakcja === 'function' ? { transakcja: (fn) => sql.transakcja(fn) } : {}),
    exec(zapytanie, ...p) {
      const k = sql.exec(zapytanie, ...p);
      let cz = 0, zap = 0;
      const dolicz = () => {
        const c = Number(k.rowsRead) || 0, z = Number(k.rowsWritten) || 0;
        licznik.czytane += c - cz; licznik.zapisane += z - zap;
        cz = c; zap = z;
      };
      dolicz();
      return new Proxy(k, {
        get(cel, nazwa) {
          const w = Reflect.get(cel, nazwa, cel);
          if (typeof w !== 'function') return w;
          return (...a) => { const wynik = w.apply(cel, a); dolicz(); return wynik; };
        },
      });
    },
  };
}

// Suma doby i bezpiecznik. `rdzen` daje meta/ustawMeta (trwały zapis sumy), `licznik` to bieżące liczby z liczacySql.
// Suma zapisuje się na koniec każdego żądania, które coś zapisało (kosztuje to dwa wiersze, więc samo czytanie jej nie
// rusza: wiersze czytane między zapisami doliczą się przy następnym zapisie albo przepadną, gdy obiekt zaśnie).
export class Budzet {
  constructor(rdzen, licznik, { limit = null, teraz = () => Date.now() } = {}) {
    this.r = rdzen;
    this.licznik = licznik;
    const n = Math.trunc(Number(limit));
    this.limit = Number.isFinite(n) && n > 0 ? n : null;
    this.teraz = teraz;
    this.stan = null; // { dzien, czytane, zapisane } zapisane trwale
    this.zapisanyLicznik = { czytane: licznik.czytane, zapisane: licznik.zapisane }; // do tego miejsca licznik jest już w sumie
  }

  _dzis() {
    const dzien = dzienZ(this.teraz());
    if (!this.stan || this.stan.dzien !== dzien) {
      let s = null;
      try { s = JSON.parse(this.r.meta(PRZEDROSTEK + dzien) || 'null'); } catch { /* zapis uszkodzony: liczymy od zera */ }
      this.stan = { dzien, czytane: Number(s && s.czytane) || 0, zapisane: Number(s && s.zapisane) || 0 };
      // nowa doba zaczyna od tego, co licznik pokazuje teraz: wiersze wczorajsze nie przechodzą na dziś
      this.zapisanyLicznik = { czytane: this.licznik.czytane, zapisane: this.licznik.zapisane };
    }
    return this.stan;
  }

  // Ile dziś: suma trwała plus to, co doszło od ostatniego zapisu sumy.
  dzis() {
    const s = this._dzis();
    return { dzien: s.dzien, czytane: s.czytane + this.licznik.czytane - this.zapisanyLicznik.czytane, zapisane: s.zapisane + this.licznik.zapisane - this.zapisanyLicznik.zapisane };
  }

  przekroczony() { return this.limit !== null && this.dzis().zapisane >= this.limit; }

  // Początek żądania: znacznik, od którego liczymy jego koszt.
  otworz() { this._dzis(); return { czytane: this.licznik.czytane, zapisane: this.licznik.zapisane }; }

  // Koniec żądania: jego koszt; jeśli coś zapisało, suma doby idzie do trwałego zapisu. Żądania mogą się przeplatać,
  // więc koszt jednego żądania jest przybliżony; suma doby nie.
  zamknij(znacznik) {
    const koszt = { czytane: this.licznik.czytane - znacznik.czytane, zapisane: this.licznik.zapisane - znacznik.zapisane };
    if (koszt.zapisane > 0) this.utrwal();
    return koszt;
  }

  utrwal() {
    const d = this.dzis();
    this.stan = d;
    this.zapisanyLicznik = { czytane: this.licznik.czytane, zapisane: this.licznik.zapisane };
    try { this.r.ustawMeta(PRZEDROSTEK + d.dzien, JSON.stringify({ czytane: d.czytane, zapisane: d.zapisane })); } catch { /* suma to miara, jej brak nie może zatrzymać ruchu */ }
  }

  // Do /co-tu-jest i do danych: to, co to Miejsce wie o swoim budżecie.
  opis() {
    const d = this.dzis();
    return { dzien: d.dzien, zapisane: d.zapisane, czytane: d.czytane, limit_miejsca: this.limit, limit_konta: LIMIT_KONTA, przekroczony: this.przekroczony() };
  }

  odmowa() {
    const d = this.dzis();
    return { ok: false, status: 429, blad: `to Miejsce zapisało dziś ${d.zapisane} wierszy i doszło do swojego dobowego limitu (${this.limit}); limit chroni wspólny budżet darmowego planu, z którego korzystają wszystkie Miejsca i podglądy; licznik wraca do zera o północy czasu UTC, czytanie działa dalej` };
  }
}

export const naglowekKosztu = (koszt) => `wiersze-czytane=${koszt.czytane}; wiersze-zapisane=${koszt.zapisane}`;
