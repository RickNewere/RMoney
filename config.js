// ============================================================
//  CONFIGURAZIONE RMoney
//  Incolla qui l'URL dell'app web di Apps Script (finisce con /exec)
//  Lo ottieni dopo aver distribuito il backend (vedi README.md).
// ============================================================
export const API_URL = 'https://script.google.com/macros/s/AKfycbzovdlOdUg3ljEUUFAPq-N3fuv_bujV18M_enYtVGypoPFb3Zq3E-ZPYNXsSIgNEIDAEA/exec';

// Mappa Persona + Conto -> gid del tab su cui scrivere.
export const TABS = {
  Riccardo: { Euro: 113020932, Franchi: 650699013 },
  Roberta:  { Euro: 1888286288, Franchi: 1063479927 },
};

export const PERSONE = ['Riccardo', 'Roberta'];
export const CONTI = ['Euro', 'Franchi'];
