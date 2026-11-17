// Niezaleznny atak na kanal na zywo (PR 39), druga linia, 17 XI 2026.
// Powod: budowniczy sam napisal, ze atak i psucie uruchamial wlasna reka. To jest ta czesc, ktorej nie da sie
// zaliczyc u siebie. Nic tu nie zapisuje do Miejsca: same polaczenia i wiadomosci.
// Uruchomienie:  node atak-kanal.mjs <adres https> <klucz agenta>
const B = process.argv[2] || 'https://fable-srodowisko-jaskinia.jozzpoly.workers.dev';
const KLUCZ = process.argv[3] || 'podglad-agent-klucz-publiczny';
const WS = B.replace(/^http/, 'ws') + '/api/srodowisko/zywe';
const spij = (ms) => new Promise((r) => setTimeout(r, ms));

function polacz(nazwa) {
  const ws = new WebSocket(WS);
  const stan = { nazwa, odebrane: [], zamkniete: null, otwarte: false, ws };
  ws.addEventListener('open', () => { stan.otwarte = true; });
  ws.addEventListener('message', (e) => { stan.odebrane.push(typeof e.data === 'string' ? e.data : '<bin>'); });
  ws.addEventListener('close', (e) => { stan.zamkniete = { kod: e.code, powod: e.reason }; });
  ws.addEventListener('error', () => { stan.blad = true; });
  return stan;
}
const czekajNaOtwarcie = async (s, ms = 8000) => { const do_ = Date.now() + ms; while (!s.otwarte && !s.zamkniete && Date.now() < do_) await spij(50); return s.otwarte; };
const sj = (s, o) => { try { s.ws.send(typeof o === 'string' ? o : JSON.stringify(o)); } catch { /* zamkniete */ } };
const typy = (s) => s.odebrane.map((x) => { try { return JSON.parse(x).t; } catch { return x; } });
const wynik = [];
const pisz = (nr, co, ocena, szczegol) => { wynik.push([nr, ocena]); console.log(`${ocena === 'ok' ? 'OK  ' : ocena === 'uwaga' ? 'UWAGA' : 'ZLE '} A${nr}. ${co}\n      ${szczegol}`); };

const main = async () => {
  console.log('adres:', WS, '\n');

  // A1. Bez klucza na podgladzie: wedlug opisu slyszy numer aktu i liczbe obecnych, nic wiecej.
  const a = polacz('bez klucza');
  await czekajNaOtwarcie(a); await spij(1500);
  const maImiona = a.odebrane.some((x) => /"lista"/.test(x));
  pisz(1, 'polaczenie bez klucza (podglad)', maImiona ? 'zle' : 'ok',
    `odebrane: ${JSON.stringify(typy(a))}; lista imion obecnych: ${maImiona ? 'JEST (nie powinno)' : 'brak'}`);

  // A2. Podszycie sie imieniem w wiadomosci: imie ma pochodzic z klucza, nie z tresci.
  const b = polacz('podszycie');
  await czekajNaOtwarcie(b);
  sj(b, { t: 'jestem', klucz: KLUCZ, kto: 'obserwator', imie: 'probny-wlasciciel' });
  await spij(1500);
  const witaj = b.odebrane.map((x) => { try { return JSON.parse(x); } catch { return null; } }).find((m) => m && m.t === 'witaj');
  pisz(2, 'proba podania wlasnego imienia przy przedstawieniu sie', witaj && witaj.kto !== 'obserwator' && witaj.kto !== 'probny-wlasciciel' ? 'ok' : 'zle',
    `witaj.kto = ${witaj ? JSON.stringify(witaj.kto) : 'brak'} (klucz nalezy do agenta, wiec tylko jego imie jest poprawne)`);

  // A3. Zle klucze po kolei: po piatym polaczenie ma zniknac.
  const c = polacz('zle klucze po kolei');
  await czekajNaOtwarcie(c);
  for (let i = 0; i < 7 && !c.zamkniete; i++) { sj(c, { t: 'jestem', klucz: 'zly-klucz-drugiej-linii-' + i }); await spij(250); }
  await spij(800);
  pisz(3, 'piec zlych kluczy jeden po drugim', c.zamkniete ? 'ok' : 'zle',
    `zamkniete: ${JSON.stringify(c.zamkniete)}; bledow odebranych: ${typy(c).filter((t) => t === 'blad').length}`);

  // A4. Te same zle klucze WSZYSTKIE NARAZ: licznik zlych prob jest czytany po await skrot(), wiec rownolegle
  // proby moga sie nawzajem nadpisac i licznik nigdy nie dobije do piatki.
  const d = polacz('zle klucze naraz');
  await czekajNaOtwarcie(d);
  for (let i = 0; i < 12; i++) sj(d, { t: 'jestem', klucz: 'rownolegly-zly-klucz-' + i });
  await spij(2500);
  pisz(4, 'dwanascie zlych kluczy wyslanych naraz', d.zamkniete ? 'ok' : 'uwaga',
    `zamkniete: ${JSON.stringify(d.zamkniete)}; bledow odebranych: ${typy(d).filter((t) => t === 'blad').length} (jesli polaczenie stoi, licznik zlych prob gubi sie przy rownoleglosci)`);

  // A5. Zalew wiadomosciami: powyzej 60 na minute polaczenie ma zniknac.
  const e = polacz('zalew');
  await czekajNaOtwarcie(e);
  for (let i = 0; i < 90; i++) sj(e, 'ping');
  await spij(2500);
  pisz(5, 'dziewiecdziesiat wiadomosci w sekunde', e.zamkniete ? 'ok' : 'zle',
    `zamkniete: ${JSON.stringify(e.zamkniete)} (spodziewany kod 4429)`);

  // A6. Obecnosc: czy zwiedzajacy bez klucza widzi, PRZY KTOREJ rzeczy jest uczestnik z kluczem.
  const f = polacz('uczestnik'); const g = polacz('zwiedzajacy');
  await czekajNaOtwarcie(f); await czekajNaOtwarcie(g);
  sj(f, { t: 'jestem', klucz: KLUCZ });
  await spij(800);
  g.odebrane.length = 0;
  sj(f, { t: 'przy', rzecz: 'aaaaaaaaaaaaaaaaaaaaaaaaaa' });
  sj(f, { t: 'przy', rzecz: { zly: 'typ' } });
  sj(f, { t: 'przy', rzecz: 'x'.repeat(5000) });
  await spij(1500);
  const wyciek = g.odebrane.some((x) => /"przy"|"lista"/.test(x));
  pisz(6, 'zwiedzajacy a obecnosc uczestnika (takze przy zlych wartosciach pola rzecz)', wyciek ? 'zle' : 'ok',
    `zwiedzajacy odebral: ${JSON.stringify(g.odebrane.slice(0, 3))}; polaczenie uczestnika ${f.zamkniete ? 'ZAMKNIETE: ' + JSON.stringify(f.zamkniete) : 'stoi'}`);

  // A7. Smiec zamiast JSON i ogromna wiadomosc: ma byc zignorowana, nie ma wywrocic polaczenia.
  const h = polacz('smieci');
  await czekajNaOtwarcie(h);
  sj(h, 'to nie jest json'); sj(h, '{"t":'); sj(h, JSON.stringify({ t: 'jestem', klucz: 'k'.repeat(3000) })); sj(h, 'x'.repeat(100000));
  await spij(1500);
  pisz(7, 'smieci i wiadomosc 100 kB', h.zamkniete && h.zamkniete.kod !== 1006 ? 'uwaga' : 'ok',
    `polaczenie: ${h.zamkniete ? 'zamkniete ' + JSON.stringify(h.zamkniete) : 'stoi'}; odebrane: ${JSON.stringify(typy(h))}`);

  for (const s of [a, b, c, d, e, f, g, h]) { try { s.ws.close(); } catch {} }
  await spij(300);
  console.log('\npodsumowanie:', wynik.map(([n, o]) => `A${n}=${o}`).join(' '));
};
main().then(() => process.exit(0), (e) => { console.error('WYWROTKA:', e); process.exit(1); });
