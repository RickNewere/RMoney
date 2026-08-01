// Donut chart for the monthly summary, built as a plain SVG string because
// SvgWidget takes one. Only geometry lives here: the labels are TextWidgets in
// the widget itself, so they use the same font as everything else.

export const COLORE_USCITE = '#f87171';
export const COLORE_RISPARMIO = '#34d399';
export const COLORE_ROSSO = '#ef4444';

// entrate = uscite + risparmio, quindi le due fette sono quote delle entrate.
// Sommare anche le entrate come terza fetta sarebbe contarle due volte: il
// totale della torta E' gia' le entrate.
export function tortaMensile(m, colorePista) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const pista = colorePista || '#2a2f3a';

  const base =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<circle cx="50" cy="50" r="' + R + '" fill="none" stroke="' + pista + '" stroke-width="16"/>';

  const entrate = Number(m && m.entrate) || 0;
  const uscite = Number(m && m.uscite) || 0;

  // Nessuna entrata, o speso piu' di quanto entrato: non esiste una divisione
  // in quote delle entrate. Si mostra l'anello tutto "uscite" invece di
  // disegnare una proporzione inventata.
  if (entrate < 0.005 || uscite >= entrate) {
    return base +
      '<circle cx="50" cy="50" r="' + R + '" fill="none" stroke="' +
      (uscite > 0 ? COLORE_ROSSO : pista) + '" stroke-width="16"/></svg>';
  }

  const quotaUscite = uscite / entrate;
  const lunghUscite = C * quotaUscite;

  return base +
    // Risparmio: tutto l'anello, poi le uscite lo coprono per la loro quota.
    '<circle cx="50" cy="50" r="' + R + '" fill="none" stroke="' + COLORE_RISPARMIO +
    '" stroke-width="16"/>' +
    '<circle cx="50" cy="50" r="' + R + '" fill="none" stroke="' + COLORE_USCITE +
    '" stroke-width="16" stroke-dasharray="' + lunghUscite.toFixed(2) + ' ' +
    (C - lunghUscite).toFixed(2) + '" transform="rotate(-90 50 50)"/>' +
    '</svg>';
}

// Percentuale di entrate che resta come risparmio, per l'etichetta al centro.
export function percentualeRisparmio(m) {
  const entrate = Number(m && m.entrate) || 0;
  if (entrate < 0.005) return null;
  const q = (Number(m.risparmio) || 0) / entrate;
  return Math.round(q * 100);
}
