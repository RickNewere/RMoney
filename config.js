// ============================================================
//  CONFIGURAZIONE RMoney
//  Incolla qui l'URL dell'app web di Apps Script (finisce con /exec)
//  Lo ottieni dopo aver distribuito il backend (vedi README.md).
// ============================================================
export const API_URL = 'https://script.google.com/macros/s/AKfycbyCZycE7BMzAjDDp6-7oh4VURomR1_ZtLkV_vYj9oA34VCvRqMi0AhjGTZ9C9satu8dNA/exec';

// Mappa Persona + Conto -> gid del tab su cui scrivere.
export const TABS = {
  Riccardo: { Euro: 113020932, Franchi: 650699013 },
  Roberta:  { Euro: 1888286288, Franchi: 1063479927 },
};

export const PERSONE = ['Riccardo', 'Roberta'];
export const CONTI = ['Euro', 'Franchi'];
