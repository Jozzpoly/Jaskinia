// Gospodarz środowiska: strona, która pokazuje, co jest w Miejscu, i otwiera gości w oknach (17 XI 2026). Próba.
// To jedyny kod działający pod adresem Miejsca. Wszystko, co pokazuje, czyta z tych samych drzwi co agenci
// (/api/srodowisko/…), a z gośćmi rozmawia umową okna (opis: /umowa-okna). Dane trafiają na stronę wyłącznie jako
// tekst (textContent), nigdy jako HTML.
(() => {
  'use strict';
  const PAMIEC = 'jaskinia:srodowisko:widziany-akt';
  const $ = (id) => document.getElementById(id);
  const el = (znacznik, cechy = {}, ...dzieci) => {
    const e = document.createElement(znacznik);
    for (const [k, w] of Object.entries(cechy)) {
      if (w === null || w === undefined || w === false) continue;
      if (k === 'tekst') e.textContent = w; else if (k === 'klik') e.addEventListener('click', w); else if (k === 'klasa') e.className = w; else e.setAttribute(k, w === true ? '' : w);
    }
    for (const d of dzieci.flat()) if (d !== null && d !== undefined && d !== false) e.append(d);
    return e;
  };
  // Klucz uczestnika zostaje w pamięci tej przeglądarki, pod adresem Miejsca. Goście w ramkach go nie widzą:
  // kod z Miejsca nie ma własnego adresu, a obce strony mają inny.
  const KLUCZ = 'jaskinia:srodowisko:klucz';
  let klucz = localStorage.getItem(KLUCZ) || '';
  const naglowki = (dod = {}) => ({ accept: 'application/json', ...(klucz ? { authorization: 'Bearer ' + klucz } : {}), ...dod });
  const czytaj = async (sciezka) => {
    let o = await fetch(sciezka, { headers: naglowki(), cache: 'no-store' });
    // Klucz, którego Miejsce już nie zna, nie może zamknąć strony: zapominamy go i czytamy jak zwiedzający.
    if (o.status === 401 && klucz) { klucz = ''; localStorage.removeItem(KLUCZ); komunikat('Ten klucz nie jest już znany w tym Miejscu. Wejdź jeszcze raz.', true); o = await fetch(sciezka, { headers: naglowki(), cache: 'no-store' }); }
    const d = await o.json().catch(() => null);
    if (!o.ok || !d || d.ok === false) throw new Error((d && (d.blad || d.error)) || 'odpowiedź ' + o.status);
    return d;
  };
  // Zdanie o tym, co się właśnie stało (albo dlaczego się nie stało): nakładka nad dokiem, więc nie przesuwa
  // układu strony i palec nie trafia w pustkę. Dotknięcie ją zamyka; sama znika po kilku sekundach.
  function komunikat(tekst, zly = false) {
    const k = $('komunikat');
    if (!k) return;
    k.textContent = tekst || '';
    k.className = zly ? 'komunikat zly' : 'komunikat';
    k.hidden = !tekst;
    clearTimeout(komunikat.zegar);
    if (tekst) komunikat.zegar = setTimeout(() => { k.hidden = true; }, zly ? 12000 : 5000);
  }
  $('komunikat').addEventListener('click', () => { clearTimeout(komunikat.zegar); $('komunikat').hidden = true; });
  let licznikOp = 0;
  const nowyOp = () => 'reka-' + Date.now().toString(36) + '-' + (++licznikOp).toString(36) + Math.random().toString(36).slice(2, 8);
  // Jeden ruch ręki przez te same drzwi, którymi chodzą agenci. Odpowiedź drzwi mówi po polsku, co się stało.
  // opcje.zrodlo: guzik, który wysłał ruch; on i jego sąsiedzi w grupie są nieczynni do końca ruchu (bez drugiego
  // wysłania i bez dotknięcia starego stanu). opcje.sukces: co zrobić po przyjęciu ruchu, ZANIM strona się odświeży
  // (np. wyczyścić szkic pola, żeby przerysowanie nie pokazało starego tekstu).
  async function ruch(cialo, dobrze, opcje = {}) {
    if (!klucz) { komunikat('Żeby coś zmienić, najpierw wejdź: guzik "Wejdź" na górze strony.', true); return null; }
    const grupa = opcje.zrodlo && opcje.zrodlo.parentElement ? [...opcje.zrodlo.parentElement.querySelectorAll('button, textarea')] : [];
    const bylo = grupa.map((x) => x.disabled);
    grupa.forEach((x) => { x.disabled = true; });
    try {
      const o = await fetch('/api/srodowisko/ruch', { method: 'POST', headers: naglowki({ 'content-type': 'application/json', 'x-cialo': 'strona gospodarza' }), body: JSON.stringify({ op: nowyOp(), ...cialo }) });
      const d = await o.json().catch(() => null);
      if (!o.ok || !d || d.ok === false) { komunikat((d && d.blad) || 'Drzwi odpowiedziały: ' + o.status, true); return null; }
      if (opcje.sukces) opcje.sukces();
      let zdanie = d.skutek === 'propozycja' ? 'Poszło jako propozycja (' + (d.powod || 'czeka na rozstrzygnięcie') + ').' : (dobrze || 'Zrobione.');
      // Najpierw ekran, potem zdanie o skutku: inaczej przez chwilę strona mówi dwie różne rzeczy.
      try { await odswiez(); if (kr.id) await odswiezKarte(); } catch (blad) { zdanie += ' (Strony nie udało się odświeżyć: ' + blad.message + ')'; }
      komunikat(zdanie);
      return d;
    } catch (blad) { komunikat('Nie udało się połączyć: ' + blad.message, true); return null; }
    finally { grupa.forEach((x, i) => { x.disabled = bylo[i]; }); }
  }
  const kiedy = (iso) => {
    const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (!Number.isFinite(min)) return '';
    if (min < 1) return 'przed chwilą';
    if (min < 60) return min + ' min temu';
    if (min < 60 * 36) return Math.round(min / 60) + ' godz. temu';
    const dni = Math.round(min / 1440);
    return dni < 60 ? dni + ' dni temu' : Math.round(dni / 30) + ' mies. temu';
  };
  // Im żywszy projekt, tym bardziej zielony: kolor paska bierze się z wieku ostatniej zmiany u źródła.
  const kolorZycia = (iso) => {
    const dni = (Date.now() - Date.parse(iso)) / 86400000;
    if (!Number.isFinite(dni)) return null;
    const t = Math.max(0, Math.min(1, 1 - Math.log10(1 + dni) / Math.log10(181)));
    return `color-mix(in srgb, var(--zywe) ${Math.round(t * 100)}%, var(--stare))`;
  };

  let opis = null, rzeczy = [], akt = 0;
  let widziany = Number(localStorage.getItem(PAMIEC) || 0) || 0;
  const okna = new Map(); // id okna -> { ramka, sekcja, guzik, gosc, chce, nazwa }
  let nrOkna = 0;

  // --- okna gości ----------------------------------------------------------------------------------------------
  // Trzy poziomy zaufania do tego, co otwieramy w ramce:
  //   'kod'   : kod gościa zapisany w Miejscu (piaskownica bez własnego adresu, pamięci i sieci);
  //   'obcy'  : adres podany przez kogoś innego niż właściciel (skrypty tak, własna pamięć i wyskakujące okna nie);
  //   'swoj'  : adres w rzeczy, którą dołożył i ostatnio zmienił właściciel (gra ma własną pamięć pod swoim adresem).
  const PIASKOWNICE = { kod: 'allow-scripts allow-pointer-lock', obcy: 'allow-scripts allow-pointer-lock', swoj: 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups' };
  function otworz({ klucz, tytul, adres, piaskownica, gosc = null }) {
    for (const [id, o] of okna) if (o.klucz === klucz) return pokaz(id, true);
    const id = 'okno-' + ++nrOkna;
    const ramka = el('iframe', { src: adres, title: tytul, referrerpolicy: 'no-referrer', allow: 'fullscreen; gamepad', sandbox: PIASKOWNICE[piaskownica] || PIASKOWNICE.obcy });
    const mowi = el('span', { klasa: 'mowi' });
    const tyt = el('span', { klasa: 'tytul', tekst: tytul });
    const sekcja = el('section', { klasa: 'okno', 'aria-label': tytul },
      el('div', { klasa: 'pasek' }, tyt, mowi,
        el('a', { klasa: 'guzik', href: adres, target: '_blank', rel: 'noopener', tekst: 'nowa karta' }),
        el('button', { tekst: 'zwiń', title: 'Zwiń do guzika na dole; okno zostaje załadowane', klik: () => pokaz(id, false) }),
        el('button', { tekst: '×', title: 'Zamknij okno', klik: () => zamknij(id) })),
      ramka);
    const guzik = el('button', { tekst: tytul, klik: () => pokaz(id, sekcja.hidden) });
    okna.set(id, { klucz, ramka, sekcja, guzik, tyt, mowi, gosc, chce: [], nazwa: tytul });
    ramka.addEventListener('load', () => ramka.contentWindow && ramka.contentWindow.postMessage({ jaskinia: 1, type: 'hi', v: 2 }, '*'));
    $('okna').append(sekcja);
    $('dok').append(guzik);
    pokaz(id, true);
  }
  function pokaz(id, widac) {
    for (const [inne, o] of okna) {
      const ma = inne === id ? widac : (widac ? false : !o.sekcja.hidden);
      if (o.sekcja.hidden === !ma) continue;
      o.sekcja.hidden = !ma;
      o.guzik.classList.toggle('widoczne', ma);
      o.ramka.contentWindow && o.ramka.contentWindow.postMessage({ jaskinia: 1, type: 'visible', visible: ma }, '*');
    }
    const o = okna.get(id);
    if (o) o.guzik.classList.toggle('widoczne', !o.sekcja.hidden);
  }
  function zamknij(id) {
    const o = okna.get(id);
    if (!o) return;
    o.sekcja.remove(); o.guzik.remove(); okna.delete(id);
  }
  // Rozmowa z gośćmi. Przyjmujemy wiadomości tylko od ramek, które sami otworzyliśmy.
  addEventListener('message', async (e) => {
    const m = e.data;
    if (!m || typeof m !== 'object' || m.jaskinia !== 1 || typeof m.type !== 'string') return;
    const o = [...okna.values()].find((x) => x.ramka.contentWindow === e.source);
    if (!o) return;
    const odp = (w) => e.source.postMessage({ jaskinia: 1, ...w }, '*');
    if (m.type === 'hello') {
      if (typeof m.name === 'string' && m.name.trim()) { o.nazwa = m.name.trim().slice(0, 60); o.tyt.textContent = o.nazwa; o.guzik.textContent = o.nazwa; }
      o.chce = Array.isArray(m.wants) ? m.wants.filter((x) => typeof x === 'string').slice(0, 8) : [];
    } else if (m.type === 'state') {
      o.mowi.textContent = typeof m.text === 'string' ? m.text.slice(0, 240) : '';
    } else if (m.type === 'read') {
      try {
        let dane;
        if (m.what === 'spis') {
          const p = new URLSearchParams();
          if (typeof m.rodzaj === 'string') p.set('rodzaj', m.rodzaj);
          if (typeof m.obszar === 'string' || m.obszar === null) p.set('obszar', m.obszar || '');
          if (Number.isInteger(m.pomin) && m.pomin > 0) p.set('pomin', String(m.pomin));
          const d = await czytaj('/api/srodowisko/spis?' + p);
          dane = { rzeczy: d.rzeczy, razem: d.razem, pokazane: d.pokazane, pominiete: d.pominiete, wszystko: d.wszystko };
        } else if (m.what === 'rzecz') {
          const d = await czytaj('/api/srodowisko/rzecz?id=' + encodeURIComponent(String(m.rzecz || '')));
          dane = { rzecz: d.rzecz, historia: d.historia, wskazuja: d.wskazuja };
        } else if (m.what === 'ksztalty') {
          dane = { ksztalty: (await czytaj('/api/srodowisko/ksztalty')).ksztalty };
        } else if (m.what === 'ja') {
          dane = { uczestnik: opis ? opis.czytasz_jako : null, gosc: o.gosc ? { rzecz: o.gosc.id, nazwa: o.gosc.nazwa } : null };
        } else throw new Error('nie znam takiego czytania: ' + String(m.what) + '; znane: spis, rzecz, ksztalty, ja');
        odp({ type: 'result', id: m.id, ok: true, data: dane });
      } catch (blad) { odp({ type: 'result', id: m.id, ok: false, error: String(blad && blad.message || blad).slice(0, 300) }); }
    }
    // signals, event, flag i wszystko nieznane: na razie pomijamy bez błędu (umowa okna, pokolenie 2)
  });

  // --- strona --------------------------------------------------------------------------------------------------
  const lp = (n, a, b, c) => `${n} ${n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c)}`;
  // Most do starej Jaskini (Opus Code, 17 XI 2026). Ta strona jest gospodarzem dla swoich gosci, ale sama
  // bywa gosciem: stara Jaskinia umie otworzyc dowolny adres w oknie i rozmawia ta sama umowa (hello, state,
  // signals, event, flag). Bez tych kilku linii nowe srodowisko otwarte w jej oknie dzialaloby "po cichu":
  // bez nazwy, bez stanu i bez liczb. Dzieki nim jedno miejsce jest prawda od pierwszego dnia, a stara
  // Jaskinia nie wymaga ani jednej zmiany.
  // Znani rodzice. Uwaga Fable, 17 XI: strona w ramce ma mowic stan tylko temu, kogo zna. Pierwsza wersja
  // tego mostu wysylala stan przez postMessage z celem '*', czyli komukolwiek, kto nas osadzi. Dopoki wszystko
  // tu jest publiczne, nic to nie kosztuje; w dniu, w ktorym wejdzie pierwsza prywatna rzecz, byloby to okno
  // na cudza strone. Dlatego: nigdy '*', nigdy pierwsi do nieznajomego, a stan tylko do adresu z tej listy.
  const ZNANI_RODZICE = [
    'https://jozzpoly.github.io',   // stara Jaskinia i laby wlasciciela
    location.origin,                // to samo Miejsce osadzone w sobie (podglad, proby)
  ];
  const znanyRodzic = (adres) => typeof adres === 'string' && ZNANI_RODZICE.includes(adres);
  const gospodarzOnad = window.parent && window.parent !== window ? window.parent : null;
  // Adres rodzica poznajemy dopiero z wiadomosci od niego (origin ramki jest nieczytelny z drugiej strony).
  // Przed pierwsza wiadomoscia mozemy go zgadnac z referrera - i tylko wtedy, gdy jest na liscie, odzywamy sie pierwsi.
  let adresRodzica = null;
  let ostatniStan = null;
  const doGospodarza = (w) => {
    if (!gospodarzOnad || !znanyRodzic(adresRodzica)) return;
    try { gospodarzOnad.postMessage({ jaskinia: 1, ...w }, adresRodzica); } catch { /* okno moglo zniknac */ }
  };
  function przedstawSie() {
    doGospodarza({ type: 'hello', name: 'Jaskinia: srodowisko', version: '1', wants: [] });
    if (ostatniStan) powiedzStan();
  }
  function powiedzStan() {
    if (!ostatniStan) return;
    doGospodarza({ type: 'state', text: ostatniStan.tekst });
    doGospodarza({ type: 'signals', values: { rzeczy: ostatniStan.rzeczy, czeka: ostatniStan.czeka, akt: ostatniStan.akt } });
  }
  if (gospodarzOnad) {
    addEventListener('message', (e) => {
      const m = e.data;
      if (e.source !== gospodarzOnad || !m || m.jaskinia !== 1) return;
      if (!znanyRodzic(e.origin)) return;   // nieznajomy nie uslyszy od nas nic, nawet ze tu jestesmy
      adresRodzica = e.origin;
      if (m.type === 'hi') przedstawSie();
      else if (m.type === 'state?') powiedzStan();
      else if (m.type === 'remark' && typeof m.text === 'string') doGospodarza({ type: 'event', text: 'uwaga wlasciciela trafila do srodowiska: ' + m.text.slice(0, 120), level: 'info' });
    });
    // Odzywamy sie pierwsi tylko do znanego adresu z referrera: umowa nie rozstrzyga, kto zaczyna,
    // a stara Jaskinia potrafi wyslac 'hi', zanim ten skrypt zdazy sie zaladowac.
    try {
      const r = document.referrer ? new URL(document.referrer).origin : null;
      if (znanyRodzic(r)) { adresRodzica = r; przedstawSie(); }
    } catch { /* bez referrera czekamy na jego pierwsze slowo */ }
  }

  // --- wejście: kim jestem na tej stronie -----------------------------------------------------------------------
  function wejdz(nowy) {
    klucz = String(nowy || '').trim();
    if (klucz) localStorage.setItem(KLUCZ, klucz); else localStorage.removeItem(KLUCZ);
    $('wejscie-panel').hidden = true;
    return odswiez().then(() => komunikat(klucz ? 'Jesteś jako ' + (opis.czytasz_jako.imie || '?') + ' (' + opis.czytasz_jako.rola + ').' : 'Wyszedłeś. Czytasz jako zwiedzający.'), (blad) => komunikat('Nie udało się wejść: ' + blad.message, true));
  }
  function rysujWejscie() {
    const d = opis, p = $('wejscie-panel'), g = $('wejscie');
    const imie = d.czytasz_jako.imie;
    g.textContent = klucz && imie ? imie + ' · wyjdź' : 'Wejdź';
    p.textContent = '';
    if (klucz && imie) { g.onclick = () => wejdz(''); return; }
    g.onclick = () => { p.hidden = !p.hidden; };
    const pole = el('input', { type: 'password', id: 'pole-klucza', placeholder: 'Twój klucz', autocomplete: 'current-password', 'aria-label': 'Klucz uczestnika' });
    p.append(el('p', { tekst: 'Wejście jest potrzebne tylko do zmian. Klucz zostaje w tej przeglądarce.' }),
      d.klucz_probny_wlasciciela ? el('button', { klasa: 'glowny', tekst: 'Wejdź jako właściciel próbny', title: 'Na podglądzie klucze próbne są jawne; nic tu nie jest prywatne', klik: () => wejdz(d.klucz_probny_wlasciciela) }) : null,
      d.klucz_probny ? el('button', { tekst: 'Wejdź jako agent próbny', klik: () => wejdz(d.klucz_probny) }) : null,
      el('div', { klasa: 'rzad' }, pole, el('button', { tekst: 'Wejdź kluczem', klik: () => wejdz(pole.value) })));
  }
  const jestemWlascicielem = () => Boolean(opis && klucz && opis.czytasz_jako.rola === 'wlasciciel');
  const rzeczO = (id) => rzeczy.find((r) => r.id === id) || null;

  // --- to, co ręka właśnie robi, przeżywa przerysowanie ------------------------------------------------------------
  // Strona przerysowuje całą treść przy każdej zmianie w Miejscu (niedługo często). Wpisany tekst, otwarte pola,
  // rozwinięte <details>, fokus i przewinięcie nie mogą przez to znikać. Szkice trzymamy poza elementami.
  const szkice = new Map();          // klucz pola -> { tekst, otwarte }
  const rozwiniete = new Set();      // rodzaje rozwiniętych <details>
  let pokazWszystkieNowe = false;
  function zachowaj(przewijany, buduj) {
    const a = document.activeElement;
    const fk = a && a.dataset ? a.dataset.pole : null;
    const zaznaczenie = fk && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null;
    const y = window.scrollY, gora = przewijany ? przewijany.scrollTop : 0;
    buduj();
    if (przewijany) przewijany.scrollTop = gora;
    if (window.scrollY !== y) window.scrollTo(0, y);
    if (fk) {
      const n = document.querySelector('[data-pole="' + CSS.escape(fk) + '"]');
      if (n && n.offsetParent !== null) { n.focus({ preventScroll: true }); if (zaznaczenie) { try { n.setSelectionRange(zaznaczenie[0], zaznaczenie[1]); } catch { /* pole bez zaznaczenia */ } } }
    }
  }
  // Małe pole z jednym guzikiem: rozwija się pod wierszem albo kartą, wysyła i zwija się samo. Szkic (tekst i to, czy
  // pole jest otwarte) żyje pod kluczem, więc nowy egzemplarz pola po przerysowaniu wraca do tego, co ręka zostawiła.
  // wyslij(tekst, opcje) ma oddać ruch(…, opcje): wtedy guzik jest nieczynny w trakcie, a po sukcesie szkic znika.
  function pole(klucz, napis, podpowiedz, wyslij) {
    const sz = szkice.get(klucz) || { tekst: '', otwarte: false };
    const tekst = el('textarea', { rows: '2', placeholder: podpowiedz, 'aria-label': podpowiedz, 'data-pole': klucz });
    tekst.value = sz.tekst;
    const zapisz = () => { if (tekst.value || !pudlo.hidden) szkice.set(klucz, { tekst: tekst.value, otwarte: !pudlo.hidden }); else szkice.delete(klucz); };
    tekst.addEventListener('input', zapisz);
    const pudlo = el('div', { klasa: 'pole', hidden: !sz.otwarte }, tekst, el('button', { klasa: 'glowny', tekst: napis, klik: async (e) => {
      const w = tekst.value.trim(); if (!w) return;
      if (await wyslij(w, { zrodlo: e.currentTarget, sukces: () => szkice.delete(klucz) })) { tekst.value = ''; pudlo.hidden = true; szkice.delete(klucz); }
    } }));
    return { pudlo, pokaz: () => { pudlo.hidden = !pudlo.hidden; zapisz(); if (!pudlo.hidden) tekst.focus(); } };
  }
  // Ruch, którego nie cofa się jednym dotknięciem bez namysłu: pierwsze dotknięcie zmienia napis na pytanie na kilka
  // sekund, drugie wykonuje. Zamiast okna confirm(), które na telefonie łatwo zatwierdzić odruchem.
  function dwaDotkniecia(napis, pytanie, etykieta, akcja) {
    let zegar = null;
    const g = el('button', { tekst: napis, 'aria-label': napis + ' ' + etykieta, klik: (e) => {
      if (zegar) { clearTimeout(zegar); zegar = null; g.textContent = napis; g.classList.remove('pytanie'); g.setAttribute('aria-label', napis + ' ' + etykieta); akcja(e.currentTarget); return; }
      g.textContent = pytanie; g.classList.add('pytanie'); g.setAttribute('aria-label', pytanie + ' ' + napis + ' ' + etykieta);
      zegar = setTimeout(() => { zegar = null; g.textContent = napis; g.classList.remove('pytanie'); g.setAttribute('aria-label', napis + ' ' + etykieta); }, 5000);
    } });
    return g;
  }
  const slowaPrzy = (id) => rzeczy.filter((r) => r.rodzaj.startsWith('slowo/') && Array.isArray(r.cechy.dotyczy) && r.cechy.dotyczy.includes(id)).sort((a, b) => String(b.utworzono).localeCompare(String(a.utworzono)));
  // Słowo przy rzeczy: uwaga albo pomysł zostawiony dokładnie tam, gdzie dotyczy, a nie w rozmowie.
  function slowoPrzy(r) {
    const sa = slowaPrzy(r.id);
    const p = pole('slowo:' + r.id, 'Zostaw słowo', 'Twoje słowo przy tej rzeczy', (w, o) => ruch({ co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: w, dotyczy: [r.id] } }, 'Słowo zostawione przy: ' + r.tytul, o));
    return [el('div', { klasa: 'ruchy' }, el('button', { tekst: sa.length ? 'słowo (' + sa.length + ')' : 'słowo', title: 'Zostaw słowo przy tej rzeczy', klik: p.pokaz })),
      p.pudlo,
      sa.length ? el('ul', { klasa: 'slowa' }, sa.slice(0, 3).map((s) => el('li', {}, el('span', { tekst: s.cechy.tresc }), el('span', { klasa: 'bok', tekst: s.utworzyl + ' · ' + kiedy(s.utworzono) })))) : null];
  }
  const STOPNIE = [['nic', 'nic'], ['proponowac', 'proponować'], ['porzadkowac', 'porządkować'], ['prowadzic', 'prowadzić']];
  const CO_ZNACZY = { nic: 'ruchy agentów są odrzucane', proponowac: 'każdy ruch agenta czeka na Ciebie jako propozycja', porzadkowac: 'agenci układają sami, a zmianę treści proponują', prowadzic: 'agenci dokładają i zmieniają sami' };
  // Ile wolno agentom w obszarze: cztery guziki, bieżący jest zaznaczony. Zmiana jest zwykłym ruchem na rzeczy obszaru.
  function wierszObszaru(x) {
    const teraz = x.ustawienia.ile_wolno.wartosc;
    const rz = x.id ? rzeczO(x.id) : null;
    return el('li', { klasa: 'obszar' },
      el('div', {}, el('b', { tekst: x.nazwa }), el('span', { klasa: 'bok', tekst: ' · ' + lp(x.ile, 'rzecz', 'rzeczy', 'rzeczy') + ' · agentom wolno: ' + teraz + ' (' + CO_ZNACZY[teraz] + ')' })),
      rz ? el('div', { klasa: 'wybor', role: 'group', 'aria-label': 'Ile wolno agentom w obszarze ' + x.nazwa }, STOPNIE.map(([w, napis]) => el('button', { klasa: w === teraz ? 'wybrany' : null, 'aria-pressed': w === teraz ? 'true' : 'false', tekst: napis, title: CO_ZNACZY[w],
        klik: (e) => { if (w !== teraz) ruch({ co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: rz.rodzaj, cechy: { ...rz.cechy, ile_wolno: w } }, 'W obszarze ' + x.nazwa + ' agentom wolno teraz: ' + napis + '.', { zrodlo: e.currentTarget }); } }))) : null);
  }
  // Co propozycja chce zrobić, jednym zdaniem: nazwa rzeczy, której dotyczy, a przy nowej jej przyszła nazwa.
  // p: {id, rzecz, co, rodzaj}; pr: rzecz-propozycja (na karcie bierzemy ją z drzwi, nie ze spisu).
  function coProponuje(p, pr = rzeczO(p.id)) {
    const stara = p.rzecz ? rzeczO(p.rzecz) : null;
    const tresc = pr && pr.cechy.tresc && pr.cechy.tresc.cechy ? pr.cechy.tresc.cechy : {};
    const nazwa = tresc.nazwa || tresc.imie || tresc.tresc || tresc.dla || '';
    const czyn = { odloz: 'odłożyć', przywroc: 'przywrócić', cofnij: 'cofnąć do wcześniejszej wersji' }[p.co];
    if (stara) return (czyn ? czyn + ': ' : 'zmienić: ') + stara.tytul + (!czyn && nazwa && nazwa !== stara.tytul ? ' → ' + String(nazwa).slice(0, 80) : '');
    return 'dołożyć (' + p.rodzaj + ')' + (nazwa ? ': ' + String(nazwa).slice(0, 80) : '');
  }
  // Ruchy właściciela na czekającej propozycji; te same w liście i na karcie. Guzik mówi, co przyjmuje (aria-label).
  function ruchyPropozycji(id, co, kluczPola) {
    const odm = pole(kluczPola, 'Odrzuć z powodem', 'Dlaczego nie (zostanie przy propozycji)', (w, o) => ruch({ co: 'odrzuc', propozycja: id, powod: w }, 'Propozycja odrzucona.', o));
    const ruchy = el('div', { klasa: 'ruchy' },
      el('button', { klasa: 'glowny', tekst: 'Przyjmij', 'aria-label': 'Przyjmij: ' + co, klik: (e) => ruch({ co: 'przyjmij', propozycja: id }, 'Propozycja przyjęta.', { zrodlo: e.currentTarget }) }),
      el('button', { tekst: 'Odrzuć', 'aria-label': 'Odrzuć: ' + co, klik: (e) => ruch({ co: 'odrzuc', propozycja: id }, 'Propozycja odrzucona.', { zrodlo: e.currentTarget }) }),
      el('button', { tekst: 'z powodem', 'aria-label': 'Odrzuć z powodem: ' + co, klik: odm.pokaz }));
    return { ruchy, pudlo: odm.pudlo };
  }

  function rysuj() {
    const t = $('tresc');
    const d = opis;
    rysujWejscie();
    $('stan').textContent = `${lp(d.razem, 'rzecz', 'rzeczy', 'rzeczy')} · akt ${d.miejsce.akt} · ${d.czytasz_jako.imie || 'zwiedzający'}`;
    const czekaIle = d.czeka.propozycje.length + d.czeka.prosby.length;
    const ileRzeczy = Number(d.razem) || 0;
    ostatniStan = { rzeczy: ileRzeczy, czeka: czekaIle, akt: (d.miejsce && d.miejsce.akt) || 0,
      tekst: ileRzeczy + ' rzeczy' + (czekaIle ? ', ' + czekaIle + ' czeka na Ciebie' : '') };
    powiedzStan();
    zachowaj(null, () => { t.textContent = ''; rysujTresc(t, d, czekaIle); });
    // Otwarta karta czyta swoją rzecz od nowa tylko wtedy, gdy Miejsce poszło dalej: inaczej niczego jej nie ruszamy.
    if (kr.id && kr.akt !== akt) odswiezKarte();
  }
  function rysujTresc(t, d, czekaIle) {
    if (d.miejsce.podglad) t.append(el('p', { klasa: 'uwaga', tekst: 'Podgląd: wszystko tutaj jest publiczne do czytania i niczego prywatnego tu nie ma. To jest środowisko, w którym Jaskinia ma rosnąć; Start jeszcze nie istnieje.' }));
    const ja = jestemWlascicielem();
    // 1. Czeka na właściciela: to, na co ręka ma odpowiedzieć, jest pierwsze.
    if (czekaIle) t.append(el('section', {}, el('h2', {}, 'Czeka na właściciela ', el('span', { klasa: 'ile', tekst: String(czekaIle) })),
      el('ul', { klasa: 'lista czeka' },
        d.czeka.prosby.map((p) => {
          const rz = rzeczO(p.id);
          const odp = pole('odp:' + p.id, 'Odpowiedz', 'Twoja odpowiedź', (w, o) => rz && ruch({ co: 'poloz', rzecz: rz.id, wersja: rz.wersja, rodzaj: rz.rodzaj, cechy: { ...rz.cechy, odpowiedz: w, stan: 'zalatwiona' } }, 'Odpowiedź zapisana przy prośbie.', o));
          return el('li', {}, el('div', {}, el('a', { href: '/rzecz/' + p.id, tekst: p.tresc }), el('span', { klasa: 'bok', tekst: ` prośba od ${p.od} · ${kiedy(p.kiedy)}` }), odp.pudlo),
            ja && rz ? el('div', { klasa: 'ruchy' }, el('button', { klasa: 'glowny', tekst: 'Odpowiedz', 'aria-label': 'Odpowiedz na prośbę: ' + String(p.tresc).slice(0, 80), klik: odp.pokaz })) : null);
        }),
        d.czeka.propozycje.map((p) => {
          const co = coProponuje(p);
          const r = ja ? ruchyPropozycji(p.id, co, 'odm:' + p.id) : null;
          return el('li', {}, el('div', {}, el('a', { href: '/rzecz/' + p.id, tekst: co }),
            // propozycja, która zmienia prawa albo uczestników, ma inną wagę niż zmiana nazwy: mówi to od razu
            p.wymaga === 'wlasciciel' ? el('span', { klasa: 'nowe', tekst: ' zmienia prawa albo uczestników' }) : null,
            el('span', { klasa: 'bok', tekst: ` propozycja od ${p.od} · ${kiedy(p.kiedy)}` }), r ? r.pudlo : null),
            r ? r.ruchy : null);
        })),
      ja ? null : el('p', { klasa: 'ciche', tekst: 'Rozstrzyga właściciel. Jeśli to Ty: wejdź guzikiem na górze strony.' })));

    // 2. Nowe od ostatniej wizyty: najnowsze pierwsze, pięć na start.
    const swieze = rzeczy.filter((r) => r.wersja > widziany && widziany > 0).sort((a, b) => b.wersja - a.wersja);
    if (swieze.length) {
      const widac = pokazWszystkieNowe ? swieze : swieze.slice(0, 5);
      t.append(el('section', {}, el('h2', {}, 'Nowe od Twojej ostatniej wizyty ', el('span', { klasa: 'ile', tekst: String(swieze.length) }),
        el('button', { tekst: 'widziałem', klik: () => { widziany = akt; localStorage.setItem(PAMIEC, String(akt)); rysuj(); } })),
        el('ul', { klasa: 'lista' }, widac.map((r) => el('li', {}, el('a', { href: '/rzecz/' + r.id, tekst: r.tytul }), el('span', { klasa: 'bok', tekst: `${r.rodzaj} · ${r.zmienil} · ${kiedy(r.zmieniono)}` })))),
        swieze.length > 5 ? el('div', { klasa: 'ruchy' }, el('button', { tekst: pokazWszystkieNowe ? 'pokaż mniej' : 'pokaż pozostałe (' + (swieze.length - 5) + ')', 'aria-expanded': pokazWszystkieNowe ? 'true' : 'false', klik: () => { pokazWszystkieNowe = !pokazWszystkieNowe; rysuj(); } })) : null));
    }

    // 3. Projekty, 4. Organy i narzędzia
    const projekty = rzeczy.filter((r) => r.rodzaj.startsWith('projekt/')).sort((a, b) => String(b.cechy.zycie || '').localeCompare(String(a.cechy.zycie || '')));
    const pr = d.przeniesienie;
    t.append(el('section', {}, el('h2', {}, 'Projekty ', el('span', { klasa: 'ile', tekst: pr.publiczne_repozytoria ? `${projekty.length} w środku na ${pr.publiczne_repozytoria.ile} publicznych repozytoriów` : `${projekty.length} w środku` })),
      projekty.length ? el('div', { klasa: 'siatka' }, projekty.map(kartaProjektu)) : el('p', { klasa: 'ciche', tekst: 'Jeszcze żadnego. Projekt dokłada się jednym ruchem: /co-tu-jest, punkt 5.' })));

    const goscie = rzeczy.filter((r) => r.rodzaj.startsWith('gosc/'));
    t.append(el('section', {}, el('h2', {}, 'Organy i narzędzia ', el('span', { klasa: 'ile', tekst: String(goscie.length) })),
      goscie.length ? el('div', { klasa: 'siatka' }, goscie.map(kartaGoscia)) : el('p', { klasa: 'ciche', tekst: 'Jeszcze żadnego.' })));

    // 5. Obszary: ile wolno agentom
    t.append(el('section', {}, el('h2', {}, 'Obszary: ile wolno agentom'),
      el('ul', { klasa: 'lista obszary' }, d.obszary.map(wierszObszaru)),
      ja ? null : el('p', { klasa: 'ciche', tekst: 'Ustawienie zmienia właściciel; ruch kogoś innego staje się propozycją do niego.' })));

    // 6. Pozostałe rzeczy: rozwinięte <details> zostają rozwinięte po przerysowaniu
    const reszta = new Map();
    for (const r of rzeczy) { if (r.rodzaj.startsWith('projekt/') || r.rodzaj.startsWith('gosc/') || r.rodzaj.startsWith('zdolnosc/')) continue; if (!reszta.has(r.rodzaj)) reszta.set(r.rodzaj, []); reszta.get(r.rodzaj).push(r); }
    t.append(el('section', {}, el('h2', {}, 'Pozostałe rzeczy'),
      [...reszta].sort((a, b) => a[0].localeCompare(b[0])).map(([rodzaj, lista]) => {
        const det = el('details', { open: rozwiniete.has(rodzaj) }, el('summary', {}, rodzaj + ' ', el('span', { klasa: 'ile', tekst: String(lista.length) })),
          el('div', {}, el('ul', { klasa: 'lista' }, lista.map((r) => el('li', {}, el('a', { href: '/rzecz/' + r.id, tekst: r.tytul }), el('span', { klasa: 'bok', tekst: `${r.zmienil} · ${kiedy(r.zmieniono)}` }))))));
        det.addEventListener('toggle', () => { if (det.open) rozwiniete.add(rodzaj); else rozwiniete.delete(rodzaj); });
        return det;
      })));

    // 7. Stan budowy
    const stany = [['stoi', 'Stoi'], ['cienko', 'Cienko'], ['brak', 'Jeszcze nie ma']];
    t.append(el('section', {}, el('h2', {}, 'Stan budowy środowiska'),
      el('div', { klasa: 'trzy' }, stany.map(([s, napis]) => el('div', { klasa: 'kolumna ' + s }, el('h3', { tekst: napis.toUpperCase() }),
        d.zdolnosci.filter((z) => z.stan === s).sort((a, b) => a.nazwa.localeCompare(b.nazwa)).map((z) => el('p', {}, el('b', { tekst: z.nazwa + '. ' }), el('span', { tekst: z.opis + (z.jak ? ' ' + z.jak : '') }))))))));
  }
  function kartaProjektu(r) {
    const c = r.cechy;
    const k = el('article', { klasa: 'karta' });
    const kolor = c.zycie ? kolorZycia(c.zycie) : null;
    if (kolor) k.style.borderLeftColor = kolor;
    k.append(el('div', { klasa: 'nazwa', tekst: r.tytul }));
    if (typeof c.opis === 'string' && c.opis) k.append(el('div', { klasa: 'opis', tekst: c.opis }));
    const ruchy = el('div', { klasa: 'ruchy' });
    const swoja = odWlasciciela(r);
    if (typeof c.zagraj === 'string' && /^https:\/\//.test(c.zagraj)) ruchy.append(el('button', { klasa: 'glowny', tekst: 'Zagraj', title: swoja ? c.zagraj : 'Adres podał ' + r.zmienil + ', nie właściciel: otworzy się bez własnej pamięci. ' + c.zagraj, klik: () => otworz({ klucz: 'p:' + r.id, tytul: r.tytul, adres: c.zagraj, piaskownica: swoja ? 'swoj' : 'obcy' }) }));
    if (typeof c.zrodlo === 'string' && /^https:\/\//.test(c.zrodlo)) ruchy.append(el('a', { klasa: 'guzik', href: c.zrodlo, target: '_blank', rel: 'noopener', tekst: 'źródło' }));
    if (ruchy.childNodes.length) k.append(ruchy);
    k.append(el('div', { klasa: 'meta' }, r.wersja > widziany && widziany > 0 ? el('span', { klasa: 'nowe', tekst: 'nowe' }) : null,
      c.zycie ? el('span', { tekst: 'żyje: ' + kiedy(c.zycie) }) : el('span', { tekst: 'brak daty życia' }),
      // skąd rzecz pochodzi: kto ją dołożył i kto ostatnio zmienił; rzecz nie od właściciela jest oznaczona
      el('span', { klasa: swoja ? null : 'nowe', tekst: swoja ? 'od właściciela' : 'dołożył ' + r.utworzyl + (r.zmienil !== r.utworzyl ? ', zmienił ' + r.zmienil : '') }),
      el('a', { href: '/rzecz/' + r.id, tekst: 'szczegóły' })));
    k.append(...slowoPrzy(r).filter(Boolean));
    return k;
  }
  // Rzecz "od właściciela": on ją dołożył i on ostatnio zmienił. Każdą inną mógł dołożyć albo zmienić agent.
  const odWlasciciela = (r) => Boolean(opis && opis.wlasciciel && r.utworzyl === opis.wlasciciel && r.zmienil === opis.wlasciciel);
  function kartaGoscia(r) {
    const c = r.cechy;
    const kod = typeof c.kod === 'string' && /^[0-9a-f]{64}$/.test(c.kod) ? '/gosc/' + c.kod : null;
    const adres = !kod && typeof c.adres === 'string' && /^https:\/\//.test(c.adres) ? c.adres : null;
    const k = el('article', { klasa: 'karta' }, el('div', { klasa: 'nazwa', tekst: r.tytul }), el('div', { klasa: 'opis', tekst: typeof c.opis === 'string' ? c.opis : '' }));
    k.style.borderLeftColor = 'var(--akcent)';
    k.append(el('div', { klasa: 'ruchy' }, kod || adres ? el('button', { klasa: 'glowny', tekst: 'Otwórz', klik: () => otworz({ klucz: 'g:' + r.id + ':' + (kod || adres), tytul: r.tytul, adres: kod || adres, piaskownica: kod ? 'kod' : (odWlasciciela(r) ? 'swoj' : 'obcy'), gosc: { id: r.id, nazwa: r.tytul } }) }) : el('span', { klasa: 'ciche', tekst: 'bez kodu i adresu' })),
      el('div', { klasa: 'meta' }, r.wersja > widziany && widziany > 0 ? el('span', { klasa: 'nowe', tekst: 'nowe' }) : null, el('span', { tekst: `dołożył ${r.utworzyl} · ${kiedy(r.utworzono)}` }), el('a', { href: '/rzecz/' + r.id, tekst: 'szczegóły' })));
    k.append(...slowoPrzy(r).filter(Boolean));
    return k;
  }

  // --- karta rzeczy: odnośnik do rzeczy otwiera ją tu, na stronie, a nie jako goły tekst dla agentów ---------------
  // href zostaje (agent i "otwórz w nowej karcie" działają jak dotąd); dla ręki łapiemy zwykłe dotknięcie jedną
  // wspólną obsługą. Karta żyje poza #tresc, więc przerysowanie strony jej nie rusza; sama czyta rzecz od nowa tylko
  // wtedy, gdy rzecz (albo to, co ją otacza) naprawdę się zmieniła.
  const ID_RZECZY = /^[0-9a-z]{26}$/;
  const kr = { id: null, pierwszy: null, pierwszyId: null, nr: 0, podpis: '', akt: -1, sekcja: null, tresc: null, tyt: null, rodz: null };
  function szkieletKarty() {
    if (kr.sekcja) return;
    kr.tyt = el('span', { klasa: 'tytul' });
    kr.rodz = el('span', { klasa: 'mowi' });
    kr.tresc = el('div', { klasa: 'kr-tresc', tabindex: '-1' });
    kr.sekcja = el('section', { klasa: 'okno karta-rzeczy', role: 'dialog', 'aria-label': 'Karta rzeczy', hidden: true },
      el('div', { klasa: 'pasek' }, kr.tyt, kr.rodz, el('button', { tekst: '×', title: 'Zamknij kartę', 'aria-label': 'Zamknij kartę', klik: zamknijKarte })),
      kr.tresc);
    $('okna').append(kr.sekcja);
  }
  function otworzKarte(id, opener) {
    szkieletKarty();
    // fokus wróci do odnośnika, z którego karta została otwarta po raz pierwszy, nawet gdy potem chodzimy po odnośnikach w karcie
    if (!kr.id) { kr.pierwszy = opener || null; kr.pierwszyId = id; }
    kr.id = id; kr.podpis = ''; kr.akt = -1;
    kr.sekcja.hidden = false;
    kr.tyt.textContent = 'Czytam…'; kr.rodz.textContent = '';
    kr.tresc.replaceChildren(el('p', { klasa: 'ciche', tekst: 'Czytam rzecz…' }));
    kr.tresc.scrollTop = 0;
    return odswiezKarte().then(() => { const h = kr.tresc.querySelector('.kr-tytul'); if (h && kr.id === id) h.focus({ preventScroll: true }); });
  }
  function zamknijKarte() {
    if (!kr.id) return;
    const wracam = kr.pierwszy, idPierwszej = kr.pierwszyId;
    kr.id = null; kr.nr++; kr.podpis = ''; kr.pierwszy = null;
    kr.sekcja.hidden = true;
    // odnośnik, z którego otwarto, mógł zniknąć przy przerysowaniu: szukamy go po adresie
    const cel = wracam && wracam.isConnected ? wracam : [...document.querySelectorAll('#tresc a[href^="/rzecz/"]')].find((a) => a.getAttribute('href') === '/rzecz/' + idPierwszej);
    if (cel) cel.focus({ preventScroll: true });
  }
  // Czyta rzecz z drzwi i przerysowuje kartę. Kolejne wywołania wyprzedzają poprzednie (numer nr), a niezmieniony
  // odczyt nie rusza niczego: ani wpisanego tekstu, ani zapytania "Na pewno?" w połowie.
  async function odswiezKarte() {
    const id = kr.id;
    if (!id) return;
    const nr = ++kr.nr;
    try {
      const d = await czytaj('/api/srodowisko/rzecz?id=' + encodeURIComponent(id));
      if (kr.nr !== nr || kr.id !== id) return;
      kr.akt = akt;
      const wokol = [slowaPrzy(id).map((s) => [s.id, s.wersja]), (d.wskazuja || []).map((w) => [w.od, rzeczO(w.od) && rzeczO(w.od).tytul]),
        Object.values(d.rzecz.cechy).filter((w) => typeof w === 'string' && ID_RZECZY.test(w)).map((w) => rzeczO(w) && rzeczO(w).tytul),
        jestemWlascicielem(), opis.obszary.map((o) => [o.id, o.nazwa])];
      const podpis = JSON.stringify([d, wokol]);
      if (podpis === kr.podpis) return;
      kr.podpis = podpis;
      zachowaj(kr.tresc, () => rysujKarte(d));
    } catch (blad) {
      if (kr.nr !== nr || kr.id !== id) return;
      // gdy karta już coś pokazuje, błąd odczytu w tle jej nie psuje; pusta dostaje zdanie, dlaczego
      if (!kr.podpis) { kr.tyt.textContent = 'Nie ma tej rzeczy'; kr.tresc.replaceChildren(el('p', { klasa: 'uwaga', tekst: 'Nie udało się przeczytać tej rzeczy: ' + blad.message }), el('p', {}, el('a', { href: '/rzecz/' + id, target: '_blank', rel: 'noopener', tekst: 'tekstem' }))); }
    }
  }
  // Czytelny tekst z wartości cechy: lista w jednej linii, obiekt jako "nazwa: wartość" z wcięciami.
  function tekstWartosci(w, wc = '') {
    if (w === null || w === undefined) return '—';
    if (typeof w === 'boolean') return w ? 'tak' : 'nie';
    if (typeof w !== 'object') return String(w);
    if (Array.isArray(w) && w.every((x) => x === null || typeof x !== 'object')) return w.length ? w.map((x) => tekstWartosci(x)).join(', ') : '(pusta lista)';
    const pozycje = Array.isArray(w) ? w.map((x) => [null, x]) : Object.entries(w);
    if (!pozycje.length) return '(pusty)';
    return pozycje.map(([k, v]) => {
      const zlozona = v !== null && typeof v === 'object' && (Array.isArray(v) ? v.length > 0 && v.some((x) => x !== null && typeof x === 'object') : Object.keys(v).length > 0);
      return wc + (k === null ? '- ' : k + ': ') + (zlozona ? '\n' : '') + tekstWartosci(v, wc + '  ');
    }).join('\n');
  }
  // Tytułem propozycji jest jej rodzaj, co nic nie mówi: w odnośniku nazywamy ją tym, co proponuje.
  const nazwaRzeczy = (r) => r.rodzaj === 'propozycja/1' ? 'Propozycja: ' + coProponuje({ id: r.id, rzecz: r.cechy.rzecz || null, co: r.cechy.co || 'poloz', rodzaj: r.cechy.rodzaj }, r) : r.tytul;
  const odnosnikRzeczy = (id) => el('a', { href: '/rzecz/' + id, tekst: rzeczO(id) ? nazwaRzeczy(rzeczO(id)) : id });
  // Wartość cechy jako węzły: identyfikator innej rzeczy (obecnej w spisie) jest odnośnikiem z jej tytułem.
  function wartoscWezel(w) {
    const jestId = (x) => typeof x === 'string' && ID_RZECZY.test(x) && rzeczO(x);
    if (jestId(w)) return odnosnikRzeczy(w);
    if (Array.isArray(w) && w.length && w.some(jestId) && w.every((x) => x === null || typeof x !== 'object')) {
      const wynik = [];
      w.forEach((x, i) => { if (i) wynik.push(', '); wynik.push(jestId(x) ? odnosnikRzeczy(x) : String(x)); });
      return el('span', { klasa: 'kr-tekst' }, wynik);
    }
    return el('span', { klasa: 'kr-tekst', tekst: tekstWartosci(w) });
  }
  const listaCech = (cechy, pomin = []) => {
    const wpisy = Object.entries(cechy || {}).filter(([k]) => !pomin.includes(k));
    return wpisy.length ? el('dl', { klasa: 'kr-cechy' }, wpisy.flatMap(([k, w]) => [el('dt', { tekst: k }), el('dd', {}, wartoscWezel(w))])) : el('p', { klasa: 'ciche', tekst: 'Bez cech.' });
  };
  function rysujKarte(d) {
    const r = d.rzecz, ja = jestemWlascicielem(), c = r.cechy || {};
    const ob = opis.obszary.find((o) => (r.obszar ? o.id === r.obszar : o.glowny));
    // propozycja nie ma własnej nazwy (jej tytułem jest rodzaj), więc karta nazywa ją tym, co proponuje
    const prop = r.rodzaj === 'propozycja/1' ? { id: r.id, rzecz: c.rzecz || null, co: c.co || 'poloz', rodzaj: c.rodzaj } : null;
    const co = prop ? coProponuje(prop, r) : '';
    const tytulKarty = prop ? 'Propozycja: ' + co : r.tytul;
    kr.tyt.textContent = tytulKarty; kr.rodz.textContent = r.rodzaj;
    kr.sekcja.setAttribute('aria-label', 'Karta rzeczy: ' + tytulKarty);
    const k = [];
    k.push(el('h3', { klasa: 'kr-tytul', tabindex: '-1', tekst: tytulKarty }));
    k.push(el('p', { klasa: 'kr-meta' }, el('b', { tekst: r.rodzaj }), ' · obszar: ' + (ob ? ob.nazwa : (r.obszar || 'główny'))));
    if (r.odlozone) k.push(el('p', { klasa: 'kr-odlozona' }, el('b', { tekst: 'ODŁOŻONA' }), r.powod ? ' z powodu: ' + r.powod : ' (bez podanego powodu)', el('span', { klasa: 'bok', tekst: ' Zniknęła z list, ale zostaje tu i w historii.' })));
    k.push(el('p', { klasa: 'kr-meta' }, 'Dołożył ' + r.utworzyl + ' ', el('span', { title: r.utworzono, tekst: kiedy(r.utworzono) }),
      '. Ostatnio zmienił ' + r.zmienil + ' ', el('span', { title: r.zmieniono, tekst: kiedy(r.zmieniono) }), '. Wersja ' + r.numer + '.'));

    if (prop) {
      const p = prop;
      k.push(el('p', { klasa: 'kr-zdanie' }, el('b', { tekst: 'Proponuje: ' }), co));
      const nowe = c.tresc && c.tresc.cechy ? c.tresc.cechy : null;
      if (nowe) {
        const stara = p.rzecz ? rzeczO(p.rzecz) : null;
        k.push(el('h4', { tekst: 'Co dokładnie się zmieni' }));
        k.push(el('dl', { klasa: 'kr-cechy' }, Object.entries(nowe).flatMap(([n, w]) => {
          const bylo = stara && Object.prototype.hasOwnProperty.call(stara.cechy, n) ? stara.cechy[n] : undefined;
          const zmiana = stara && JSON.stringify(bylo) !== JSON.stringify(w);
          return [el('dt', { tekst: n }), el('dd', {}, wartoscWezel(w), zmiana ? el('span', { klasa: 'ciche kr-bylo', tekst: bylo === undefined ? 'nowa cecha' : 'teraz: ' + tekstWartosci(bylo).slice(0, 200) }) : null)];
        })));
      }
      if (c.stan === 'czeka') {
        if (ja) { const rp = ruchyPropozycji(r.id, co, 'k:odm:' + r.id); k.push(rp.ruchy, rp.pudlo); }
        else k.push(el('p', { klasa: 'ciche', tekst: 'Czeka na właściciela. Jeśli to Ty: wejdź guzikiem na górze strony.' }));
      } else k.push(el('p', { klasa: 'kr-meta' }, el('b', { tekst: 'Stan: ' + (c.stan || '?') }), c.rozstrzygnal ? ' · rozstrzygnął ' + c.rozstrzygnal : ''));
    }
    if (r.rodzaj === 'prosba/1' && c.stan === 'czeka') {
      if (ja) {
        const odp = pole('k:odp:' + r.id, 'Odpowiedz', 'Twoja odpowiedź', (w, o) => ruch({ co: 'poloz', rzecz: r.id, wersja: r.wersja, rodzaj: r.rodzaj, cechy: { ...c, odpowiedz: w, stan: 'zalatwiona' } }, 'Odpowiedź zapisana przy prośbie.', o));
        k.push(el('div', { klasa: 'ruchy' }, el('button', { klasa: 'glowny', tekst: 'Odpowiedz', 'aria-label': 'Odpowiedz na prośbę: ' + String(c.tresc || r.tytul).slice(0, 80), klik: odp.pokaz })), odp.pudlo);
      } else k.push(el('p', { klasa: 'ciche', tekst: 'Czeka na odpowiedź właściciela.' }));
    }

    k.push(el('h4', { tekst: 'Cechy' }), listaCech(c, r.rodzaj === 'propozycja/1' ? ['tresc'] : []));

    // ruchy na samej rzeczy; odłożenie jest dwudotykowe, przywrócenie nie (nic nie niszczy)
    if (ja && r.rodzaj !== 'propozycja/1') {
      k.push(el('div', { klasa: 'ruchy' }, r.odlozone
        ? el('button', { tekst: 'Przywróć', 'aria-label': 'Przywróć rzecz: ' + r.tytul, klik: (e) => ruch({ co: 'przywroc', rzecz: r.id, wersja: r.wersja }, 'Przywrócone: ' + r.tytul + '.', { zrodlo: e.currentTarget }) })
        : dwaDotkniecia('Odłóż', 'Na pewno odłożyć?', 'rzecz: ' + r.tytul, (g) => ruch({ co: 'odloz', rzecz: r.id, wersja: r.wersja }, 'Odłożone: ' + r.tytul + '. Da się je przywrócić z tej karty.', { zrodlo: g }))));
    }

    const sa = slowaPrzy(r.id);
    const sl = pole('k:slowo:' + r.id, 'Zostaw słowo', 'Twoje słowo przy tej rzeczy', (w, o) => ruch({ co: 'poloz', rodzaj: 'slowo/1', cechy: { tresc: w, dotyczy: [r.id] } }, 'Słowo zostawione przy: ' + r.tytul, o));
    k.push(el('h4', { tekst: sa.length ? 'Słowa przy tej rzeczy (' + sa.length + ')' : 'Słowa przy tej rzeczy' }),
      sa.length ? el('ul', { klasa: 'slowa kr-slowa' }, sa.map((s) => el('li', {}, el('span', { klasa: 'kr-tekst', tekst: s.cechy.tresc }), el('span', { klasa: 'bok', tekst: s.utworzyl + ' · ' + kiedy(s.utworzono) })))) : el('p', { klasa: 'ciche', tekst: 'Jeszcze żadnych.' }),
      el('div', { klasa: 'ruchy' }, el('button', { tekst: 'Zostaw słowo', klik: sl.pokaz })), sl.pudlo);

    if ((d.wskazuja || []).length) k.push(el('h4', { tekst: 'Wskazują na tę rzecz' }),
      el('ul', { klasa: 'lista kr-wskazuja' }, d.wskazuja.map((w) => el('li', {}, odnosnikRzeczy(w.od), el('span', { klasa: 'bok', tekst: 'przez cechę: ' + w.cecha })))));

    // historia: ostatnie pięć wersji od najnowszej; powrót do starszej tylko dla właściciela i dwudotykowo
    k.push(el('h4', { tekst: 'Historia' }),
      el('ul', { klasa: 'lista kr-historia' }, d.historia.slice(-5).reverse().map((h) => el('li', {},
        el('span', {}, 'wersja ' + h.numer + ' · ' + h.kto + ' · ', el('span', { title: h.kiedy, tekst: kiedy(h.kiedy) }), h.numer === r.numer ? el('b', { tekst: ' (teraz)' }) : null),
        ja && h.numer !== r.numer && !prop ? dwaDotkniecia('wróć do tej wersji', 'Na pewno wrócić?', 'do wersji ' + h.numer, (g) => ruch({ co: 'cofnij', rzecz: r.id, wersja: r.wersja, do: h.akt }, 'Wróciło do wersji ' + h.numer + ' (jako nowa wersja).', { zrodlo: g })) : null))));

    k.push(el('p', { klasa: 'kr-stopka' }, el('a', { href: '/rzecz/' + r.id, target: '_blank', rel: 'noopener', tekst: 'tekstem', title: 'Ta sama rzecz jako goły tekst, w nowej karcie przeglądarki' })));
    kr.tresc.replaceChildren(...k.flat());
  }
  // Jedna obsługa dla każdego odnośnika do rzeczy na stronie i w karcie. Klawisze modyfikujące, środkowy przycisk
  // i target=_blank zostają przeglądarce.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element ? e.target.closest('a[href^="/rzecz/"]') : null;
    if (!a || (a.target && a.target !== '_self')) return;
    const id = a.getAttribute('href').slice('/rzecz/'.length);
    if (!/^[0-9a-z]+$/.test(id)) return;
    e.preventDefault();
    otworzKarte(id, kr.id ? null : a);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && kr.id && !e.defaultPrevented) zamknijKarte(); });

  async function odswiez() {
    const [o, s] = await Promise.all([czytaj('/api/srodowisko/opis'), czytaj('/api/srodowisko/spis')]);
    // spis przychodzi kawałkami po 1000; czytamy do końca, żeby strona nie udawała, że pierwszy kawałek to wszystko
    const wszystkie = s.rzeczy;
    for (let kawalek = s; !kawalek.wszystko && wszystkie.length < 20000;) { kawalek = await czytaj('/api/srodowisko/spis?pomin=' + wszystkie.length); wszystkie.push(...kawalek.rzeczy); if (!kawalek.rzeczy.length) break; }
    opis = o; rzeczy = wszystkie; akt = o.miejsce.akt;
    if (!widziany) { widziany = akt; localStorage.setItem(PAMIEC, String(akt)); }
    rysuj();
  }
  // Zmiany na żywo, cienko: gdy karta jest widoczna, co kilka sekund pytamy o numer ostatniego aktu.
  let czeka = 5000;
  async function puls() {
    if (document.visibilityState === 'visible') {
      try {
        const p = await czytaj('/api/srodowisko/puls');
        if (p.akt !== akt) {
          await odswiez();
          czeka = 5000;
          for (const o of okna.values()) if (o.chce.includes('rzeczy') && o.ramka.contentWindow) o.ramka.contentWindow.postMessage({ jaskinia: 1, type: 'changed', akt }, '*');
        } else czeka = Math.min(30000, czeka + 1000);
      } catch { czeka = 30000; }
    }
    setTimeout(puls, czeka);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') czeka = 5000; });
  odswiez().then(() => setTimeout(puls, czeka), (blad) => { $('tresc').textContent = ''; $('tresc').append(el('p', { klasa: 'uwaga', tekst: 'Nie udało się przeczytać Miejsca: ' + blad.message })); $('stan').textContent = 'brak połączenia'; });
})();
