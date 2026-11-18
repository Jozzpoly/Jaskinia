// Stan oka przy słowie (18 XI 2026; wiersz 12 listy wyjścia z gruntu). Status: próba (TYMCZASOWE.md).
// Słowo zostawione ręką jest najczęściej uwagą o tym, co widać i czuć. Bez wiedzy, na co autor patrzył, agent nie
// odtworzy tego, co on widział: nie wie, w której wersji twarzy, przy którym stanie Miejsca, w jakim widoku i na jakim
// ekranie. Twarz dopisuje więc do słowa stan oka (cecha oko): {twarz, wersja, akt, widok?, ekran?, ciemny?,
// bezpiecznie?, stan?}. `wersja` to odcisk plików twarzy, które naprawdę chodziły w przeglądarce (public/oko.mjs),
// `akt` to numer aktu, który twarz znała, a `stan` to to, co twarz sama uważa za ważne (kamera, układ).
// Po tym agent odtwarza widok: położenia z tamtej chwili daje GET /api/srodowisko/widok-w-chwili?widok=&akt=.
// Czego tu nie ma: ustawień (wyglądu) z tamtej chwili; dziś da się je odtworzyć tylko z historii wartości.

export function sprawdzOko(s, rodzaj, cechy) {
  if (rodzaj !== 'slowo/1' || !('oko' in cechy) || cechy.oko === null) return null;
  const o = cechy.oko;
  const zle = (t) => ({ blad: 'oko: ' + t + '; stan oka to {twarz, wersja, akt, widok?, ekran?, ciemny?, bezpiecznie?, stan?}' });
  if (!o || typeof o !== 'object' || Array.isArray(o)) return zle('ma być obiektem');
  if (JSON.stringify(o).length > 2000) return zle('najwyżej 2000 znaków zapisu');
  if (typeof o.twarz !== 'string' || !/^[a-z][a-z0-9_-]{0,39}$/.test(o.twarz)) return zle('twarz: krótka nazwa twarzy, z której pisano (np. start)');
  if (typeof o.wersja !== 'string' || !o.wersja || o.wersja.length > 80) return zle('wersja: odcisk albo numer wersji twarzy');
  if (!Number.isInteger(o.akt) || o.akt < 0 || o.akt > s.ostatniNr()) return zle('akt: numer aktu, który twarz znała, gdy pisano (nie z przyszłości)');
  if ('widok' in o && !(typeof o.widok === 'string' && /^[0-9a-z]{26}$/.test(o.widok))) return zle('widok: identyfikator widoku');
  return null;
}
