// Drzwi Miejsca dla Startu: czytanie, ruch i kanał na żywo w jednym małym module (17 XI 2026). Status: próba.
// Robi to samo, co strona gospodarza (srodowisko.js): czyta całość raz, potem tylko zmiany po swoim akcie, a o tym,
// że coś się zmieniło, dowiaduje się z połączenia na żywo (gdy nie stoi, pyta o puls). Dwie kopie tej logiki to dług
// zapisany w TYMCZASOWE.md: docelowo jeden moduł dla obu stron.
const KLUCZ = 'jaskinia:srodowisko:klucz';
const CICHO = 'jaskinia:srodowisko:cicho';

export class Drzwi {
  constructor({ naZmiane = () => {}, naStan = () => {} } = {}) {
    this.naZmiane = naZmiane;   // rzeczy albo opis się zmieniły
    this.naStan = naStan;       // zmienił się stan połączenia, obecni albo to, kim jestem
    this.klucz = localStorage.getItem(KLUCZ) || '';
    this.cicho = localStorage.getItem(CICHO) === 'tak';
    this.opis = null;
    this.rzeczy = new Map();
    this.akt = 0;
    this.zywe = false;
    this.obecni = { lista: [], ilu: null };
    this._g = null; this._proba = 0; this._zegar = null; this._ping = null; this._pong = null; this._zlyKlucz = null;
    this._goni = false; this._znowu = false; this._zalegle = false; this._zegarGonienia = null; this._przy = undefined; this._czeka = 5000;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      this._czeka = 5000;
      if (!this._g) { this._proba = 0; this.polacz(); }
      if (this._zalegle) { this._zalegle = false; this.zaplanujDogonienie(0); }
    });
  }

  get imie() { return this.opis ? this.opis.czytasz_jako.imie : null; }
  get rola() { return this.opis ? this.opis.czytasz_jako.rola : 'zwiedzajacy'; }
  naglowki(dod = {}) { return { accept: 'application/json', ...(this.klucz ? { authorization: 'Bearer ' + this.klucz } : {}), ...dod }; }

  async czytaj(sciezka) {
    let o = await fetch(sciezka, { headers: this.naglowki(), cache: 'no-store' });
    // Klucz, którego Miejsce już nie zna, nie może zamknąć strony: zapominamy go i czytamy jak zwiedzający.
    if (o.status === 401 && this.klucz) { this.klucz = ''; localStorage.removeItem(KLUCZ); o = await fetch(sciezka, { headers: this.naglowki(), cache: 'no-store' }); }
    const d = await o.json().catch(() => null);
    if (!o.ok || !d || d.ok === false) throw new Error((d && (d.blad || d.error)) || 'odpowiedź ' + o.status);
    return d;
  }

  // Całość: opis i cały spis (kawałkami po tysiąc).
  async wszystko() {
    const [o, s] = await Promise.all([this.czytaj('/api/srodowisko/opis'), this.czytaj('/api/srodowisko/spis')]);
    const lista = s.rzeczy;
    for (let k = s; !k.wszystko && lista.length < 20000;) { k = await this.czytaj('/api/srodowisko/spis?pomin=' + lista.length); lista.push(...k.rzeczy); if (!k.rzeczy.length) break; }
    this.opis = o;
    this.rzeczy = new Map(lista.map((r) => [r.id, r]));
    this.akt = Math.min(o.miejsce.akt, Number.isInteger(s.akt) ? s.akt : o.miejsce.akt);
    this.naZmiane();
  }

  // Doganianie: opis i tylko rzeczy zmienione po moim akcie (z odłożonymi, żeby je zdjąć).
  async dogon() {
    if (!this.opis) return this.wszystko();
    const od = this.akt;
    const [o, s] = await Promise.all([this.czytaj('/api/srodowisko/opis'), this.czytaj('/api/srodowisko/spis?odlozone=razem&po=' + od)]);
    if (o.miejsce.akt < od || !s.wszystko || !Number.isInteger(s.akt)) return this.wszystko();
    for (const r of s.rzeczy) { if (r.odlozone) this.rzeczy.delete(r.id); else this.rzeczy.set(r.id, r); }
    this.opis = o;
    this.akt = Math.min(o.miejsce.akt, s.akt);
    this.naZmiane();
  }

  zaplanujDogonienie(ms = 250) {
    if (document.visibilityState !== 'visible') { this._zalegle = true; return; }
    if (this._goni) { this._znowu = true; return; }
    clearTimeout(this._zegarGonienia);
    this._zegarGonienia = setTimeout(async () => {
      this._goni = true;
      try { await this.dogon(); } catch { /* następny sygnał albo puls spróbuje jeszcze raz */ }
      this._goni = false;
      if (this._znowu) { this._znowu = false; this.zaplanujDogonienie(400); }
    }, ms);
  }

  // Jeden ruch przez te same drzwi, którymi chodzą agenci. Zwraca { ok, dane } albo { ok: false, blad }.
  async ruch(cialo) {
    if (!this.klucz) return { ok: false, blad: 'Żeby coś zmienić, najpierw wejdź: guzik "Wejdź" u góry.' };
    try {
      const op = 'start-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      const o = await fetch('/api/srodowisko/ruch', { method: 'POST', headers: this.naglowki({ 'content-type': 'application/json', 'x-cialo': 'Start' }), body: JSON.stringify({ op, ...cialo }) });
      const d = await o.json().catch(() => null);
      if (!o.ok || !d || d.ok === false) return { ok: false, blad: (d && d.blad) || 'Drzwi odpowiedziały: ' + o.status };
      return { ok: true, dane: d };
    } catch (blad) { return { ok: false, blad: 'Nie udało się połączyć: ' + blad.message }; }
  }

  async wejdz(klucz) {
    this.klucz = String(klucz || '').trim();
    if (this.klucz) localStorage.setItem(KLUCZ, this.klucz); else localStorage.removeItem(KLUCZ);
    this._zlyKlucz = null;
    this._przedstawSie();
    await this.wszystko();
    this.naStan();
  }

  // --- kanał na żywo ---------------------------------------------------------------------------------------------
  _mow(w) {
    if (!this._g || this._g.readyState !== 1) return false;
    try { this._g.send(typeof w === 'string' ? w : JSON.stringify(w)); return true; } catch { return false; }
  }
  _przedstawSie() {
    this._przy = undefined;
    if (!this.klucz) { this._mow({ t: 'wychodze' }); return; }
    if (this.klucz !== this._zlyKlucz) this._mow({ t: 'jestem', klucz: this.klucz, cicho: this.cicho });
  }
  // Przy której rzeczy jestem; idzie do kanału tylko wtedy, gdy się zmienia i gdy mnie widać.
  przy(id) {
    this._chcePrzy = id || null;
    if (this.cicho || !this.klucz || this._chcePrzy === this._przy) return;
    if (this._mow({ t: 'przy', rzecz: this._chcePrzy })) this._przy = this._chcePrzy;
  }
  ustawCicho(tak) {
    this.cicho = !!tak;
    localStorage.setItem(CICHO, this.cicho ? 'tak' : 'nie');
    this._mow({ t: 'cicho', cicho: this.cicho });
    this._przy = undefined;
    this.przy(this._chcePrzy);
    this.naStan();
  }
  _ustawZywe(tak) { this.zywe = tak; if (!tak) this.obecni = { lista: [], ilu: null }; this.naStan(); }
  _zaplanujPolaczenie(najmniej = 0) {
    clearTimeout(this._zegar);
    const ms = Math.max(najmniej, Math.min(60000, 1000 * 2 ** Math.min(this._proba, 6)) * (0.7 + Math.random() * 0.6));
    this._proba++;
    this._zegar = setTimeout(() => this.polacz(), ms);
  }
  polacz() {
    clearTimeout(this._zegar);
    if (this._g || !('WebSocket' in window) || document.visibilityState !== 'visible') return;
    let g;
    try { g = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/srodowisko/zywe'); } catch { this._zaplanujPolaczenie(); return; }
    this._g = g;
    g.addEventListener('open', () => {
      if (this._g !== g) return;
      this._proba = 0;
      this._ustawZywe(true);
      this._przedstawSie();
      clearInterval(this._ping);
      this._ping = setInterval(() => {
        if (document.visibilityState !== 'visible' || this._pong || !this._mow('ping')) return;
        this._pong = setTimeout(() => { this._pong = null; try { g.close(); } catch { /* i tak zamknięte */ } }, 10000);
      }, 45000);
    });
    g.addEventListener('message', (e) => {
      if (this._g !== g) return;
      if (e.data === 'pong') { clearTimeout(this._pong); this._pong = null; return; }
      let m = null;
      try { m = JSON.parse(e.data); } catch { return; }
      if (!m || typeof m !== 'object') return;
      if (m.t === 'witaj') this.przy(this._chcePrzy);
      if (m.t === 'akt' || m.t === 'witaj') {
        if (m.calosc) this.wszystko().catch(() => {});
        else if (Number.isInteger(m.akt) && m.akt !== this.akt) this.zaplanujDogonienie();
      } else if (m.t === 'obecni') {
        this.obecni = { lista: Array.isArray(m.lista) ? m.lista.filter((x) => x && typeof x.kto === 'string') : [], ilu: Number.isInteger(m.ilu) ? m.ilu : null };
        this.naStan();
      }
    });
    g.addEventListener('close', (e) => {
      if (this._g !== g) return;
      this._g = null;
      clearInterval(this._ping); clearTimeout(this._pong); this._pong = null;
      this._ustawZywe(false);
      if (e.code === 4401) this._zlyKlucz = this.klucz;
      this._zaplanujPolaczenie(e.code === 4429 || e.code === 4503 ? 60000 : 0);
    });
    g.addEventListener('error', () => { try { g.close(); } catch { /* i tak zamknięte */ } });
  }
  // Bez połączenia na żywo: gdy karta jest widoczna, co kilka sekund pytamy o numer ostatniego aktu.
  async _puls() {
    if (!this.zywe && document.visibilityState === 'visible') {
      try {
        const p = await this.czytaj('/api/srodowisko/puls');
        if (p.akt !== this.akt) { await this.dogon(); this._czeka = 5000; } else this._czeka = Math.min(30000, this._czeka + 1000);
      } catch { this._czeka = 30000; }
    }
    setTimeout(() => this._puls(), this.zywe ? 5000 : this._czeka);
  }
  async start() {
    await this.wszystko();
    this.polacz();
    setTimeout(() => this._puls(), this._czeka);
  }
}
