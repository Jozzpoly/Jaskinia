// A5 jeszcze raz, osobno: czy granica 60 wiadomosci na minute dziala, gdy wiadomosci NIE sa napisem "ping".
const B = process.argv[2] || 'https://fable-srodowisko-jaskinia.jozzpoly.workers.dev';
const WS = B.replace(/^http/, 'ws') + '/api/srodowisko/zywe';
const spij = (ms) => new Promise((r) => setTimeout(r, ms));
const probuj = async (nazwa, zrobWiadomosc, ile) => {
  const ws = new WebSocket(WS);
  let zamkniete = null, otwarte = false, odebrane = 0;
  ws.addEventListener('open', () => { otwarte = true; });
  ws.addEventListener('message', () => { odebrane++; });
  ws.addEventListener('close', (e) => { zamkniete = { kod: e.code, powod: e.reason }; });
  ws.addEventListener('error', () => {});
  const do_ = Date.now() + 8000;
  while (!otwarte && !zamkniete && Date.now() < do_) await spij(50);
  for (let i = 0; i < ile && !zamkniete; i++) { try { ws.send(zrobWiadomosc(i)); } catch { break; } }
  await spij(3000);
  console.log(`${zamkniete ? 'ZAMKNIETE' : 'STOI     '}  ${nazwa}: wyslane ${ile}, odebrane ${odebrane}, ${JSON.stringify(zamkniete)}`);
  try { ws.close(); } catch {}
  await spij(200);
  return !!zamkniete;
};
const main = async () => {
  console.log('granica w kodzie: NAJWIECEJ_NA_MINUTE = 60\n');
  await probuj('napis "ping" x90', () => 'ping', 90);
  await probuj('napis "pong" x90 (nie jest automatyczna odpowiedzia)', () => 'pong', 90);
  await probuj('JSON {t:"cicho"} x90', (i) => JSON.stringify({ t: 'cicho', cicho: i % 2 === 0 }), 90);
  await probuj('smiec "a" x90', () => 'a', 90);
};
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
