// ============================================================
//  CONFIGURAZIONE RMoney
//  Incolla qui l'URL dell'app web di Apps Script (finisce con /exec)
//  Lo ottieni dopo aver distribuito il backend (vedi README.md).
// ============================================================
export const API_URL = 'https://script.google.com/macros/s/AKfycbw-3l5Xiac68ygkkASkgwifyMkhOJ8vDI0OVRCfvuYd6qFCe-tNGI82mxysS17-KvPqkA/exec';

// Mappa Persona + Conto -> gid del tab su cui scrivere.
export const TABS = {
  Riccardo: { Euro: 113020932, Franchi: 650699013 },
  Roberta:  { Euro: 1888286288, Franchi: 1063479927 },
};

export const PERSONE = ['Riccardo', 'Roberta'];
export const CONTI = ['Euro', 'Franchi'];
