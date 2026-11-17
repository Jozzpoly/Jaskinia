// Próba kanału na żywo pod adresem podglądu: trzy połączenia, ruchy przez zwykłe drzwi, czas dojścia sygnału,
// obecność, wyłącznik, ping i koszt czytania (nagłówek x-koszt). Klucze próbne podglądu są jawne.
// Użycie: node proby/z3-kanal-na-zywo/proba.mjs [adres podglądu] [ile ruchów]
const A = (process.argv[2] || 'https://fable-srodowisko-jaskinia.jozzpoly.workers.dev').replace(/\/$/, '');
const ILE = Number(process.argv[3]) || 5;
const WS = A.replace(/^http/, 'ws') + '/api/srodowisko/zywe';
const KW = 'podglad-jozz-klucz-publiczny', KA = 'podglad-agent-klucz-publiczny';
const czekaj = (ms) => new Promise((r) => setTimeout(r, ms));
const mediana = (l) => { const s = [...l].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

function polacz(nazwa) {
  return new Promise((ok, zle) => {
    const ws = new WebSocket(WS);
    const p = { nazwa, ws, wiad: [], czekajacy: [], zamkniete: null };
    ws.addEventListener('open', () => ok(p));
    ws.addEventListener('error', () => zle(new Error(nazwa + ': połączenie się nie udało')));
    ws.addEventListener('close', (e) => { p.zamkniete = { kod: e.code, powod: e.reason }; });
    ws.addEventListener('message', (e) => {
      const t = performance.now();
      let m; try { m = JSON.parse(e.data); } catch { m = { t: 'napis', napis: String(e.data) }; }
      if (m === null || typeof m !== 'object') m = { t: 'napis', napis: String(e.data) };
      m._t = t;
      p.wiad.push(m);
      p.czekajacy = p.czekajacy.filter((c) => { if (c.pasuje(m)) { c.ok(m); return false; } return true; });
    });
    // następna wiadomość pasująca do warunku (tylko przyszłe), albo null po czasie
    p.nastepna = (pasuje, ms = 6000) => new Promise((ok2) => {
      const c = { pasuje, ok: ok2 };
      p.czekajacy.push(c);
      setTimeout(() => { if (p.czekajacy.includes(c)) { p.czekajacy = p.czekajacy.filter((x) => x !== c); ok2(null); } }, ms);
    });
    p.mow = (w) => ws.send(typeof w === 'string' ? w : JSON.stringify(w));
  });
}
const naglowki = (klucz) => ({ 'user-agent': 'jaskinia-proba', ...(klucz ? { authorization: 'Bearer ' + klucz, 'content-type': 'application/json', 'x-cialo': 'proba kanalu' } : {}) });
async function czytaj(sciezka, klucz = null) {
  const o = await fetch(A + sciezka, { headers: naglowki(klucz) });
  return { status: o.status, koszt: o.headers.get('x-koszt'), dane: await o.json().catch(() => null) };
}
async function ruch(cialo, klucz = KW) {
  const o = await fetch(A + '/api/srodowisko/ruch', { method: 'POST', headers: naglowki(klucz), body: JSON.stringify(cialo) });
  return { status: o.status, koszt: o.headers.get('x-koszt'), dane: await o.json().catch(() => null) };
}
const wynik = [];
const zapisz = (nazwa, dobrze, szczegoly = '') => { wynik.push(dobrze); console.log((dobrze ? 'OK   ' : 'ZLE  ') + nazwa + (szczegoly ? ' | ' + szczegoly : '')); };

const start = await czytaj('/api/srodowisko/puls');
console.log('adres:', A, '| akt na starcie:', start.dane && start.dane.akt, '| x-koszt pulsu:', start.koszt);

// 1. zwiedzający bez klucza: na podglądzie dostaje numer aktu i samą liczbę obecnych
const zw = await polacz('zwiedzajacy');
await czekaj(700);
zapisz('zwiedzający dostaje numer aktu na wejściu', zw.wiad.some((m) => m.t === 'akt' && Number.isInteger(m.akt)), JSON.stringify(zw.wiad.map((m) => ({ ...m, _t: undefined }))));

// 2. właściciel próbny przedstawia się pierwszą wiadomością
const wl = await polacz('wlasciciel');
const witajW = wl.nastepna((m) => m.t === 'witaj');
wl.mow({ t: 'jestem', klucz: KW });
const ww = await witajW;
zapisz('właściciel przedstawiony kluczem', !!ww && ww.kto === 'probny-wlasciciel', ww ? `kto=${ww.kto} akt=${ww.akt}` : 'brak witaj');

// 3. agent dochodzi: właściciel widzi oba imiona, zwiedzający samą liczbę
const obecniU = wl.nastepna((m) => m.t === 'obecni' && Array.isArray(m.lista) && m.lista.length >= 2);
const obecniZ = zw.nastepna((m) => m.t === 'obecni' && m.ilu >= 2);
const ag = await polacz('agent');
const witajA = ag.nastepna((m) => m.t === 'witaj');
ag.mow({ t: 'jestem', klucz: KA });
const wa = await witajA;
zapisz('agent przedstawiony kluczem', !!wa && wa.kto === 'agent-probny', wa ? `kto=${wa.kto}` : 'brak witaj');
const ou = await obecniU, oz = await obecniZ;
zapisz('właściciel widzi imiona obecnych', !!ou, ou ? JSON.stringify(ou.lista) : 'brak');
zapisz('zwiedzający widzi samą liczbę, bez imion', !!oz && oz.lista === undefined, oz ? `ilu=${oz.ilu}` : 'brak');

// 4. przy której rzeczy jest agent
const spis = await czytaj('/api/srodowisko/spis?ile=1');
const jakas = spis.dane.rzeczy[0];
const zPrzy = wl.nastepna((m) => m.t === 'obecni' && (m.lista || []).some((x) => x.kto === 'agent-probny' && x.przy === jakas.id));
ag.mow({ t: 'przy', rzecz: jakas.id });
zapisz('obecność niesie rzecz, przy której jest uczestnik', !!(await zPrzy), jakas.tytul);

// 5. ruch przez zwykłe drzwi: po jakim czasie każde połączenie wie o zmianie
const czasy = { zwiedzajacy: [], wlasciciel: [], agent: [], odpowiedz: [] };
const dolozone = [];
let aktPrzed = (await czytaj('/api/srodowisko/puls')).dane.akt;
for (let i = 0; i < ILE; i++) {
  const czekam = [zw, wl, ag].map((p) => p.nastepna((m) => m.t === 'akt' && m.akt > aktPrzed));
  const t0 = performance.now();
  const r = await ruch({ op: 'proba-kanalu-' + Date.now().toString(36) + '-' + i, co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'proba kanalu na zywo ' + (i + 1), dotyczy: [] } });
  czasy.odpowiedz.push(performance.now() - t0);
  if (r.status !== 200) { zapisz('ruch ' + (i + 1), false, JSON.stringify(r.dane).slice(0, 200)); break; }
  dolozone.push(r.dane.rzecz);
  const [a, b, c] = await Promise.all(czekam);
  if (a) czasy.zwiedzajacy.push(a._t - t0);
  if (b) czasy.wlasciciel.push(b._t - t0);
  if (c) czasy.agent.push(c._t - t0);
  aktPrzed = Math.max(aktPrzed, ...[a, b, c].filter(Boolean).map((m) => m.akt));
  if (i === 0) console.log('     koszt jednego ruchu (słowo):', r.koszt);
  await czekaj(300);
}
const ms = (l) => (l.length ? Math.round(mediana(l)) + ' ms (od ' + Math.round(Math.min(...l)) + ' do ' + Math.round(Math.max(...l)) + ', n=' + l.length + ')' : 'brak');
zapisz('sygnał o zmianie doszedł do wszystkich trzech połączeń przy każdym ruchu', [czasy.zwiedzajacy, czasy.wlasciciel, czasy.agent].every((l) => l.length === ILE), `zwiedzający ${ms(czasy.zwiedzajacy)}; właściciel ${ms(czasy.wlasciciel)}; agent ${ms(czasy.agent)}; sama odpowiedź drzwi ${ms(czasy.odpowiedz)}`);
zapisz('sygnał dochodzi w mniej niż sekundę od wysłania ruchu (mediana)', [czasy.zwiedzajacy, czasy.wlasciciel, czasy.agent].every((l) => l.length && mediana(l) < 1000));

// 6. czytanie samych zmian
const aktTeraz = (await czytaj('/api/srodowisko/puls')).dane.akt;
const zmiany = await czytaj('/api/srodowisko/spis?odlozone=razem&po=' + (aktTeraz - 2));
zapisz('spis z po=<akt> zwraca tylko ostatnią zmianę', zmiany.status === 200 && zmiany.dane.rzeczy.length === 1 && zmiany.dane.rzeczy[0].id === dolozone.at(-1), `rzeczy=${zmiany.dane.rzeczy.length}; x-koszt: ${zmiany.koszt}`);
const pusto = await czytaj('/api/srodowisko/spis?odlozone=razem&po=' + aktTeraz);
zapisz('spis po ostatnim akcie jest pusty', pusto.dane.rzeczy.length === 0 && pusto.dane.wszystko === true, `x-koszt: ${pusto.koszt}`);

// 7. ping i wyłącznik obecności
const pong = wl.nastepna((m) => m.t === 'napis' && m.napis === 'pong', 4000);
wl.mow('ping');
zapisz('na ping przychodzi pong', !!(await pong));
const bezAgenta = wl.nastepna((m) => m.t === 'obecni' && !(m.lista || []).some((x) => x.kto === 'agent-probny'));
ag.mow({ t: 'cicho' });
zapisz('cichy uczestnik znika z listy obecnych', !!(await bezAgenta));
const dalejSlyszy = ag.nastepna((m) => m.t === 'akt');
const rr = await ruch({ op: 'proba-kanalu-cichy-' + Date.now().toString(36), co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: 'proba kanalu: cichy slyszy', dotyczy: [] } });
if (rr.status === 200) dolozone.push(rr.dane.rzecz);
zapisz('cichy uczestnik dalej słyszy zmiany', !!(await dalejSlyszy));

// 8. zły klucz
const zly = await polacz('zly');
const bl = zly.nastepna((m) => m.t === 'blad');
zly.mow({ t: 'jestem', klucz: 'to-nie-jest-zaden-znany-klucz' });
const b = await bl;
zapisz('zły klucz dostaje odmowę i zostaje zwiedzającym (podgląd)', !!b && !zly.zamkniete, b ? b.blad : 'brak');

// 9. sprzątanie: słowa z próby odkładamy, połączenia zamykamy
for (const id of dolozone) {
  const rz = (await czytaj('/api/srodowisko/rzecz?id=' + id)).dane.rzecz;
  await ruch({ op: 'proba-kanalu-sprzatam-' + id.slice(0, 8) + '-' + rz.wersja, co: 'odloz', rzecz: id, wersja: rz.wersja, powod: 'proba kanalu na zywo: sprzatanie' });
}
for (const p of [zw, wl, ag, zly]) { try { p.ws.close(1000, 'koniec proby'); } catch { /* już zamknięte */ } }
await czekaj(500);

// 10. koszt czytania mierzony u źródła
const o1 = await czytaj('/api/srodowisko/opis', KW);
const o2 = await czytaj('/api/srodowisko/opis', KW);
const o3 = await czytaj('/api/srodowisko/opis');
const caly = await czytaj('/api/srodowisko/spis');
const tekst = await fetch(A + '/co-tu-jest', { headers: naglowki(null) });
console.log(`     rzeczy w Miejscu: ${o1.dane.razem}; opis pierwszy raz po zmianie: ${o1.koszt}; opis drugi raz: ${o2.koszt}; opis zwiedzającego: ${o3.koszt}`);
console.log(`     cały spis (pierwszy tysiąc, ${caly.dane.pokazane} rzeczy): ${caly.koszt}; /co-tu-jest: ${tekst.headers.get('x-koszt')}`);
console.log(`     budżet dziś: ${JSON.stringify(o1.dane.budzet)}`);
console.log(wynik.every(Boolean) ? `\nWYNIK: ${wynik.length} z ${wynik.length}` : `\nWYNIK: ${wynik.filter(Boolean).length} z ${wynik.length} (są błędy)`);
process.exit(wynik.every(Boolean) ? 0 : 1);
