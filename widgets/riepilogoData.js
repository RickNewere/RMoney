// Monthly summary for the wide widget: income, spending and savings.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chiedi, risolviApi } from './debitoData';

const CACHE_KEY = 'RiepilogoWidget:ultimo';
const CACHE_V = 1;

// La torta si legge sui FRANCHI, non sugli euro, e non e' una preferenza: gli
// stipendi sono accreditati sul conto in franchi, quindi il foglio in euro ha
// entrate a zero in ogni mese. Su euro le tre fette sarebbero sempre "tutto
// uscite, risparmio negativo", cioe' un grafico che non dice niente.
const CONTO = 'Franchi';
const SIMBOLO = 'CHF';

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

async function leggiMese(api, anno, mese) {
  const j = await chiedi(
    api + '?action=riep&conto=' + CONTO + '&tipo=mensile&anno=' + anno + '&mese=' + mese
  );
  if (!j || !j.ok || !j.riepilogo) throw new Error('Risposta inattesa dal backend.');
  const r = j.riepilogo;
  return {
    anno: anno,
    mese: mese,
    etichetta: MESI[mese - 1],
    simbolo: SIMBOLO,
    entrate: Number(r.overview.entrate) || 0,
    uscite: Number(r.overview.uscite) || 0,
    risparmio: Number(r.risparmio.totale) || 0,
  };
}

function vuoto(m) {
  return Math.abs(m.entrate) < 0.005 && Math.abs(m.uscite) < 0.005;
}

export async function leggiRiepilogo() {
  try {
    const api = await risolviApi();
    const oggi = new Date();
    let m = await leggiMese(api, oggi.getFullYear(), oggi.getMonth() + 1);

    // Il primo del mese il mese corrente e' vuoto e la torta sarebbe un cerchio
    // grigio. In quel caso si mostra il mese precedente: l'etichetta dice
    // sempre quale mese si sta guardando, quindi non c'e' ambiguita'.
    if (vuoto(m)) {
      const prec = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);
      const p = await leggiMese(api, prec.getFullYear(), prec.getMonth() + 1);
      if (!vuoto(p)) m = p;
    }

    const dati = { v: CACHE_V, mese: m, aggiornato: Date.now(), vecchio: false };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(dati));
    return dati;
  } catch (e) {
    try {
      const cache = await AsyncStorage.getItem(CACHE_KEY);
      if (cache) {
        const dati = JSON.parse(cache);
        if (dati && dati.v === CACHE_V && dati.mese) {
          dati.vecchio = true;
          return dati;
        }
      }
    } catch (e2) {
      // cache illeggibile: stato vuoto
    }
    return { mese: null, aggiornato: null, vecchio: true };
  }
}
