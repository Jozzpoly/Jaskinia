// Ksztalty zapisow i op-ow. W tej paczce (P2) jest TYLKO to, co dotyczy op (docs/krok-1-umowa.md, 5.1 i zasada 3).
// Reszta ksztaltow (kanon, sprawdzRzecz, sprawdzMiejsceKarty, sprawdzSlowo, czytaj, nazwy glow i inne) dojdzie
// w paczce P0, a ten plik zostanie wtedy z nia scalony. Do tego czasu jest probą (wpis w TYMCZASOWE.md).

// Kropka i dwukropek sa zastrzezone dla czynnosci zlozonych serwera, wiec op klienta ich nie moze zawierac:
// inaczej klient podszylby sie pod cofniecie albo pod druga polowe cudzej pary.
const WZOR_OP_KLIENTA = /^[A-Za-z0-9_-]{8,100}$/;
// Pelny wzor, nie przedrostek: 'cofnij.akt:2.p' i 'cofnij.akt:2x' maja zostac zwyklymi op.
// Numer bez zer wiodacych, nie zero, najwyzej 15 cyfr: zadne dwa teksty nie wskazuja tego samego aktu,
// a 15 cyfr miesci sie w dokladnej liczbie calkowitej JS, wiec budowanie i rozpoznanie sa symetryczne.
const NAJWIEKSZY_NUMER = 999999999999999;
const WZOR_COFNIECIA = /^cofnij\.akt:([1-9]\d{0,14})$/;
const WZOR_PONOWIENIA = /^ponow\.akt:([1-9]\d{0,14})$/;

export function opKlienta(s) {
  return typeof s === 'string' && WZOR_OP_KLIENTA.test(s);
}

// Tylko dokleja koncowki; sprawdzenie op klienta nalezy do drzwi.
export function opPary(op) {
  return { z: `${op}.z`, p: `${op}.p` };
}

const dodatniaCalkowita = (nr) => Number.isInteger(nr) && nr > 0 && nr <= NAJWIEKSZY_NUMER;

export function opCofniecia(nr) {
  return dodatniaCalkowita(nr) ? `cofnij.akt:${nr}` : null;
}

export function opPonowienia(nr) {
  return dodatniaCalkowita(nr) ? `ponow.akt:${nr}` : null;
}

export function rozbierzOp(op) {
  if (typeof op === 'string') {
    const c = WZOR_COFNIECIA.exec(op);
    if (c) return { rodzaj: 'cofnij', akt: Number(c[1]) };
    const p = WZOR_PONOWIENIA.exec(op);
    if (p) return { rodzaj: 'ponow', akt: Number(p[1]) };
  }
  return { rodzaj: 'zwykly', akt: null };
}
