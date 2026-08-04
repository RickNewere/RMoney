/**
 * RMoney - Backend (Google Apps Script)
 * API leggera che l'app RMoney chiama per:
 *   - leggere le categorie di un tab           GET  ?action=categorie&gid=...
 *   - aggiungere una spesa in append           POST { gid, data, spesa, categoria, nota }
 *
 * Va creato dentro il foglio: Estensioni > Apps Script.
 * Poi: Distribuisci > Nuova distribuzione > Applicazione web.
 */

// ID del foglio (sta nell'URL tra /d/ e /edit)
var SPREADSHEET_ID = '10NT_nAkXRX12sEzFdpa6khSnONfjwm-NHGguoDm215U';

// gid del foglio nascosto con le pivot sorgente (andamento risparmio mensile).
var GID_PIVOT = 1943088578;

// Le 15 categorie di SPESA (come nelle tabelle SPESE dei fogli SOMMARIO), in
// minuscolo. Tutto cio' che non e' spesa e non e' "storni/rimborsi" e' entrata.
var SPESE_CATS = ['spesa', 'meeve e kimi', 'trasporti', 'casa', 'affitto',
  'bollette', 'uscite', 'abbigliamento', 'spese mediche', 'palestra',
  'vacanze', 'abbonamenti', 'extra', 'investimenti', 'tasse'];
// Nomi visualizzati delle categorie di spesa, nell'ordine dei fogli.
var SPESE_CATS_LABEL = ['Spesa', 'Meeve e Kimi', 'Trasporti', 'Casa', 'Affitto',
  'Bollette', 'Uscite', 'Abbigliamento', 'Spese Mediche', 'Palestra',
  'Vacanze', 'Abbonamenti', 'Extra', 'Investimenti', 'Tasse'];

// gid dei fogli LOG (le stesse schede su cui si inseriscono le spese).
var LOG_GIDS = {
  Euro:    { Roberta: 1888286288, Riccardo: 113020932 },
  Franchi: { Roberta: 1063479927, Riccardo: 650699013 }
};

// Marcatore di versione: serve per verificare cosa e' effettivamente online.
var VERSION = 'v23';

// Prima riga che l'app puo' riordinare per data, per ogni foglio LOG.
// Fissata il 27/07/2026 all'ultima riga allora presente + 1: tutto cio' che
// esisteva prima resta dov'e' per sempre, l'ordinamento tocca solo le righe
// scritte da qui in avanti. Non ricalcolare questi numeri: se li si alza si
// perde l'ordinamento gia' fatto, se li si abbassa si rimescola lo storico.
var SORT_FROM = {
  113020932: 775,   // LOG RICCARDO
  1888286288: 565,  // LOG ROBERTA
  650699013: 105,   // LOG RICCARDO CHF
  1063479927: 106   // LOG ROBERTA CHF
};

// ---------- Router ----------
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'categorie') {
    var gid = parseInt(e.parameter.gid, 10);
    return _json({ ok: true, version: VERSION, categorie: getCategorie(gid) });
  }
  if (action === 'catdebug') {
    var gidC = parseInt(e.parameter.gid, 10);
    return _json({ ok: true, version: VERSION, dettaglio: _categorieDettaglio(gidC) });
  }
  if (action === 'debug') {
    var gid2 = parseInt(e.parameter.gid, 10);
    var sh = _getSheetByGid(gid2);
    var nRows = Math.min(sh.getLastRow(), 4);
    var nCols = Math.max(sh.getLastColumn(), 1);
    var prime = nRows > 0 ? sh.getRange(1, 1, nRows, nCols).getValues() : [];
    var ultima = sh.getLastRow() > 0
      ? sh.getRange(sh.getLastRow(), 1, 1, nCols).getDisplayValues()[0]
      : [];
    return _json({
      ok: true,
      version: VERSION,
      nomeTab: sh.getName(),
      righe: sh.getLastRow(),
      colonne: nCols,
      primeRighe: prime,
      ultimaRigaVisuale: ultima
    });
  }
  if (action === 'debito') {
    var gidD = parseInt(e.parameter.gid, 10);
    var gidP = e.parameter.gidPartner ? parseInt(e.parameter.gidPartner, 10) : null;
    return _json({ ok: true, version: VERSION, debito: getDebito(gidD, gidP) });
  }
  // Elenco riga per riga delle spese condivise, per verificare il debito a mano.
  if (action === 'condivise') {
    var gidL = parseInt(e.parameter.gid, 10);
    return _json({ ok: true, version: VERSION, condivise: elencoCondivise(gidL) });
  }
  if (action === 'riepilogo') {
    var gidS = parseInt(e.parameter.gid, 10);
    return _json({ ok: true, version: VERSION, riepilogo: getRiepilogo(gidS) });
  }
  // Riepilogo per periodo scelto, ricalcolato dai fogli LOG.
  if (action === 'riep') {
    var conto = e.parameter.conto || 'Euro';
    var tipo = e.parameter.tipo || 'annuale';
    var oggi = new Date();
    var anno = parseInt(e.parameter.anno, 10) || oggi.getFullYear();
    var mese = parseInt(e.parameter.mese, 10) || (oggi.getMonth() + 1);
    return _json({ ok: true, version: VERSION, riepilogo: getRiepCalc(conto, tipo, anno, mese) });
  }
  // Elenco riga per riga delle spese di UNA categoria (drill-down dal
  // riepilogo: click su una categoria -> lista delle singole spese).
  if (action === 'spese') {
    var contoSp = e.parameter.conto || 'Euro';
    var tipoSp = e.parameter.tipo || 'annuale';
    var oggiSp = new Date();
    var annoSp = parseInt(e.parameter.anno, 10) || oggiSp.getFullYear();
    var meseSp = parseInt(e.parameter.mese, 10) || (oggiSp.getMonth() + 1);
    var personaSp = e.parameter.persona || 'Insieme';
    var categoriaSp = e.parameter.categoria || '';
    return _json({ ok: true, version: VERSION, spese: elencoSpeseCategoria(contoSp, tipoSp, annoSp, meseSp, personaSp, categoriaSp) });
  }
  // TEMP: valida il ricalcolo dai LOG contro i numeri dei fogli SOMMARIO.
  if (action === 'riepvalida') {
    var calc = getRiepCalc('Euro', 'annuale', 2025, 1);
    var som = getRiepilogo(738641296);
    var rob = _riepAggPersona(LOG_GIDS.Euro.Roberta, new Date(2025, 0, 1), new Date(2026, 0, 1));
    var ric = _riepAggPersona(LOG_GIDS.Euro.Riccardo, new Date(2025, 0, 1), new Date(2026, 0, 1));
    return _json({
      ok: true, version: VERSION,
      calc: { overview: calc.overview, entrate: calc.entrate, risparmio: calc.risparmio, spese: calc.spese },
      som:  { overview: som.overview,  entrate: som.entrate,  risparmio: som.risparmio,  spese: som.spese },
      entByCat: { roberta: rob.entByCat, riccardo: ric.entByCat }
    });
  }
  // Nessun parametro action: l'app web e' servita da GitHub Pages. Qui
  // rispondiamo solo con un piccolo JSON informativo (nessun file HTML lato
  // Apps Script, per evitare l'errore "No HTML file named App").
  return _json({ ok: true, version: VERSION, hint: 'Usa ?action=categorie|debito|debug, oppure POST per aggiungere/saldare.' });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.op === 'salda') {
      var res = saldaFoglio(parseInt(body.gid, 10));
      return _json({ ok: true, azzerate: res.azzerate, annullabile: res.annullabile });
    }
    if (body.op === 'annullaSalda') {
      return _json(annullaSalda(parseInt(body.gid, 10)));
    }
    if (body.op === 'elimina') {
      return _json(svuotaRiga(parseInt(body.gid, 10), parseInt(body.riga, 10), body.atteso));
    }
    aggiungiSpesa(body);
    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: String((err && err.message) || err) });
  }
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- Helpers ----------
function _ss() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function _getSheetByGid(gid) {
  var sheets = _ss().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) return sheets[i];
  }
  throw new Error('Tab con gid ' + gid + ' non trovato.');
}

// Trova automaticamente la riga delle intestazioni (puo' non essere la 1a
// perche' spesso la riga 1 e' un titolo). Restituisce riga (1-based),
// intestazioni in minuscolo e numero di colonne.
function _findHeader(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var maxScan = Math.min(Math.max(sheet.getLastRow(), 1), 8);
  var block = sheet.getRange(1, 1, maxScan, lastCol).getValues();
  var kw = ['data', 'categor', 'dettagl', 'importo', 'spesa', 'euro',
            'costo', '€', 'chf', 'franc', 'note', 'nota', 'descriz'];
  var best = -1, bestRow = 1, bestHeaders = block[0]
    .map(function (h) { return String(h).toLowerCase().trim(); });
  for (var r = 0; r < block.length; r++) {
    var row = block[r].map(function (h) { return String(h).toLowerCase().trim(); });
    var score = 0;
    row.forEach(function (cell) {
      if (!cell) return;
      kw.forEach(function (k) { if (cell.indexOf(k) !== -1) score++; });
    });
    if (score > best) { best = score; bestRow = r + 1; bestHeaders = row; }
  }
  return { row: bestRow, headers: bestHeaders, lastCol: lastCol };
}

function _colFor(headers, possibili) {
  for (var i = 0; i < headers.length; i++) {
    for (var j = 0; j < possibili.length; j++) {
      if (headers[i].indexOf(possibili[j]) !== -1) return i; // 0-based
    }
  }
  return -1;
}

function _pulisci(arr) {
  var seen = {}, out = [];
  arr.forEach(function (v) {
    var s = String(v).trim();
    if (s && !seen[s.toLowerCase()]) { seen[s.toLowerCase()] = true; out.push(s); }
  });
  return out;
}

// ---------- Categorie (lette dal foglio) ----------
// Usa le categorie REALMENTE usate nella colonna (i valori distinti).
function getCategorie(gid) {
  var d = _categorieDettaglio(gid);
  return d.usate;
}

// Restituisce sia i valori usati nella colonna sia l'eventuale lista del
// menu a tendina, per capire cosa c'e' nel foglio.
function _categorieDettaglio(gid) {
  var sheet = _getSheetByGid(gid);
  var h = _findHeader(sheet);
  var idxCat = _colFor(h.headers, ['categor']);
  if (idxCat < 0) return { usate: [], menuTendina: [], headerRow: h.row };
  var col = idxCat + 1;
  var firstDataRow = h.row + 1;

  // valori realmente presenti nella colonna
  var usate = [];
  var last = sheet.getLastRow();
  if (last >= firstDataRow) {
    var vals = sheet.getRange(firstDataRow, col, last - firstDataRow + 1, 1).getValues()
      .map(function (r) { return r[0]; });
    usate = _pulisci(vals);
    usate.sort(function (a, b) { return a.localeCompare(b); });
  }

  // eventuale lista del menu a tendina (convalida dati) sulla 1a cella dati
  var menu = [];
  var rule = sheet.getRange(firstDataRow, col).getDataValidation();
  if (rule) {
    var crit = String(rule.getCriteriaType());
    var args = rule.getCriteriaValues();
    if (crit.indexOf('VALUE_IN_LIST') !== -1 && Array.isArray(args[0])) {
      menu = _pulisci(args[0]);
    } else if (crit.indexOf('VALUE_IN_RANGE') !== -1 && args[0]) {
      menu = _pulisci(args[0].getValues().map(function (r) { return r[0]; }));
    }
  }

  return { usate: usate, menuTendina: menu, headerRow: h.row };
}

// ---------- Append spesa ----------
function aggiungiSpesa(dati) {
  var gid = parseInt(dati.gid, 10);
  var sheet = _getSheetByGid(gid);
  var h = _findHeader(sheet);
  var headers = h.headers;
  var lastCol = h.lastCol;

  var idxData  = _colFor(headers, ['data']);
  var idxSpesa = _colFor(headers, ['€', 'chf', 'importo', 'spesa', 'euro', 'franc', 'costo']);
  var idxCat   = _colFor(headers, ['categor']);
  var idxNota  = _colFor(headers, ['dettagl', 'nota', 'note', 'descriz']);

  // se l'importo non ha un'intestazione riconosciuta, sta subito dopo la data
  if (idxSpesa < 0 && idxData >= 0) idxSpesa = idxData + 1;

  var dataVal = dati.data ? new Date(dati.data + 'T12:00:00') : new Date();
  var spesaVal = parseFloat(String(dati.spesa).replace(',', '.'));
  if (isNaN(spesaVal)) throw new Error('Importo non valido.');

  var riga = new Array(lastCol).fill('');
  if (idxData  >= 0) riga[idxData]  = dataVal;
  if (idxSpesa >= 0) riga[idxSpesa] = spesaVal;
  if (idxCat   >= 0) riga[idxCat]   = dati.categoria || '';
  if (idxNota  >= 0) riga[idxNota]  = dati.nota || '';

  // se non trova nessuna intestazione, usa l'ordine: Data, Importo, Categoria, Nota
  if (idxData < 0 && idxSpesa < 0 && idxCat < 0 && idxNota < 0) {
    riga = [dataVal, spesaVal, dati.categoria || '', dati.nota || ''];
    idxData = 0;
    idxNota = 3;
  }

  // Spesa condivisa: la casella "split" va gestita DOPO appendRow, perche' se
  // la cella non ha la data validation da checkbox, scrivere true la mostra
  // come testo "true". Qui prepariamo solo il fallback "-" (colonna assente).
  var idxSplit = _colFor(headers, ['split']);
  if (dati.segno && idxSplit < 0 && idxNota >= 0) {
    var cDx = idxNota + 1;
    while (riga.length <= cDx) riga.push('');
    riga[cDx] = '-';
  }

  // Se una cancellazione ha lasciato una riga vuota nella zona ordinabile la
  // si riusa, altrimenti si accoda. Cosi' il foglio non cresce di una riga per
  // ogni spesa cancellata e reinserita.
  while (riga.length < lastCol) riga.push('');
  var r = _primaRigaLibera(sheet, h, SORT_FROM[gid]);
  if (r) {
    sheet.getRange(r, 1, 1, lastCol).setValues([riga.slice(0, lastCol)]);
  } else {
    sheet.appendRow(riga);
    r = sheet.getLastRow();
  }

  // La riga nuova deve essere identica alle precedenti. appendRow non applica
  // formati: eredita solo quelli gia' presenti nella riga di destinazione.
  // I fogli hanno il formato contabile (" € 9,50 ") applicato a un intervallo
  // finito, quindi quando i dati lo superano le nuove righe nascono senza
  // formato e l'importo appare come "1" invece di " € 1,00 " (successo davvero
  // su LOG RICCARDO dalla riga 770).
  // Il modello e' la PRIMA riga di dati, non quella precedente: se le ultime
  // righe sono gia' rotte, copiare da li' propagherebbe il difetto.
  _copiaFormatoRiga(sheet, h.row + 1, r, lastCol);

  // Formatta la data come "giorno mese anno" (es. 20 lug 2026), senza orario.
  if (idxData >= 0) {
    sheet.getRange(r, idxData + 1).setNumberFormat('d mmm yyyy');
  }

  // La cella "split" deve sempre avere una checkbox vera, come tutte le altre
  // righe: insertCheckboxes() imposta la data validation e mette il valore a
  // false, quindi il setValue(true) successivo la lascia spuntata. Senza questo,
  // una riga non condivisa restava una cella vuota senza casella.
  if (idxSplit >= 0) {
    var cell = sheet.getRange(r, idxSplit + 1);
    cell.insertCheckboxes();
    if (dati.segno) cell.setValue(true);
  }

  // Rimette in ordine di data la sola coda del foglio.
  _ordinaCoda(sheet, gid, h);

  _scadeCacheDebito(gid);
}

// ---------- Ordinamento della sola coda del foglio ----------
// Riordina per data SOLO le righe dalla soglia SORT_FROM in giu'. Le righe
// precedenti non vengono mai lette ne' spostate: lo storico e' congelato.
// Le celle vuote finiscono in fondo all'intervallo ordinato, quindi il buco
// lasciato da una cancellazione si sposta da solo alla fine e lo spazio torna
// utilizzabile senza dover cercare la riga libera.
function _ordinaCoda(sheet, gid, h) {
  var da = SORT_FROM[gid];
  if (!da) return 0; // foglio non configurato: non si ordina nulla
  if (da <= h.row) return 0; // paranoia: mai sopra le intestazioni
  var last = sheet.getLastRow();
  var n = last - da + 1;
  if (n < 2) return 0; // meno di due righe: niente da ordinare

  var idxData = _colFor(h.headers, ['data']);
  if (idxData < 0) return 0; // senza colonna data non si puo' ordinare

  var rng = sheet.getRange(da, 1, n, h.lastCol);
  rng.sort({ column: idxData + 1, ascending: true });

  // L'ordinamento sposta i valori: la colonna split va riallineata alle righe
  // nella loro nuova posizione.
  var idxSplit = _colFor(h.headers, ['split']);
  if (idxSplit >= 0) {
    _sistemaCheckboxCoda(sheet, h, da, n, idxSplit);
  }
  return n;
}

// Riallinea la colonna "split" nella zona ordinabile: checkbox vera sulle righe
// che contengono una spesa, nessuna checkbox su quelle vuote.
// Servono due passaggi opposti. Sulle righe piene la casella va riconfermata,
// altrimenti dopo uno spostamento puo' restare il testo "true"/"false" al posto
// della casella. Sulle righe vuote va invece tolta: una casella superstite e'
// un residuo visibile e tiene in vita la riga agli occhi di getLastRow().
function _sistemaCheckboxCoda(sheet, h, da, n, idxSplit) {
  var idxData  = _colFor(h.headers, ['data']);
  var idxSpesa = _colFor(h.headers, ['€', 'chf', 'importo', 'spesa', 'euro', 'franc', 'costo']);
  var idxCat   = _colFor(h.headers, ['categor']);
  var idxNota  = _colFor(h.headers, ['dettagl', 'nota', 'note', 'descriz']);
  if (idxSpesa < 0 && idxData >= 0) idxSpesa = idxData + 1;

  var vals = sheet.getRange(da, 1, n, h.lastCol).getValues();

  // Ultima riga che contiene ancora qualcosa. Le celle vuote finiscono in fondo
  // all'intervallo ordinato, quindi sopra questo indice non ci sono buchi.
  var ultimaPiena = -1;
  for (var i = 0; i < n; i++) {
    var row = vals[i];
    var vuota = [idxData, idxSpesa, idxCat, idxNota].every(function (k) {
      return k < 0 || String(row[k]).trim() === '';
    });
    if (!vuota) ultimaPiena = i;
  }

  // removeCheckboxes() azzera anche il valore della cella: le spunte vanno
  // lette prima di toccare la colonna.
  var flags = vals.map(function (row) {
    var v = row[idxSplit];
    return [v === true || String(v).trim().toLowerCase() === 'true'];
  });

  var col = sheet.getRange(da, idxSplit + 1, n, 1);
  col.removeCheckboxes();
  col.clearContent();

  if (ultimaPiena >= 0) {
    var piene = sheet.getRange(da, idxSplit + 1, ultimaPiena + 1, 1);
    piene.insertCheckboxes();
    piene.setValues(flags.slice(0, ultimaPiena + 1));
  }
  return ultimaPiena + 1;
}

// Prima riga completamente vuota nella zona ordinabile, o 0 se non ce n'e'.
// Serve a riusare lo spazio di una spesa cancellata invece di allungare il
// foglio ogni volta.
function _primaRigaLibera(sheet, h, da) {
  if (!da) return 0;
  var last = sheet.getLastRow();
  if (last < da) return 0;
  var idxData = _colFor(h.headers, ['data']);
  var idxSpesa = _colFor(h.headers, ['€', 'chf', 'importo', 'spesa', 'euro', 'franc', 'costo']);
  var idxCat = _colFor(h.headers, ['categor']);
  var idxNota = _colFor(h.headers, ['dettagl', 'nota', 'note', 'descriz']);
  if (idxSpesa < 0 && idxData >= 0) idxSpesa = idxData + 1;

  var vals = sheet.getRange(da, 1, last - da + 1, h.lastCol).getValues();
  for (var i = 0; i < vals.length; i++) {
    var row = vals[i];
    var vuota = [idxData, idxSpesa, idxCat, idxNota].every(function (k) {
      return k < 0 || String(row[k]).trim() === '';
    });
    if (vuota) return da + i;
  }
  return 0;
}

// Copia i SOLI formati (valuta, font, allineamento, bordi) da una riga modello
// a una riga di destinazione. Non tocca nessun valore.
function _copiaFormatoRiga(sheet, rigaModello, rigaDest, lastCol) {
  if (rigaModello < 1 || rigaModello === rigaDest) return;
  sheet.getRange(rigaModello, 1, 1, lastCol).copyTo(
    sheet.getRange(rigaDest, 1, 1, lastCol),
    SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
    false
  );
}

/**
 * Ripara la formattazione di righe gia' scritte male, senza toccare i valori.
 * Da lanciare a mano dall'editor Apps Script (menu Esegui).
 *
 * Per ogni riga dell'intervallo: copia i formati dalla prima riga di dati,
 * riapplica il formato data e rimette la checkbox nella colonna split
 * conservando le spunte gia' presenti.
 *
 * Scrive SOLO formattazione e checkbox: date, importi, categorie e note
 * restano esattamente come sono.
 */
function sistemaFormatoRighe(gid, daRiga, aRiga) {
  var sheet = _getSheetByGid(gid);
  var h = _findHeader(sheet);
  var lastCol = h.lastCol;
  var modello = h.row + 1; // prima riga di dati: sempre formattata bene
  var n = aRiga - daRiga + 1;
  if (n < 1) throw new Error('Intervallo righe non valido.');
  if (daRiga <= h.row) throw new Error('Non toccare le righe di intestazione.');

  var idxSplit = _colFor(h.headers, ['split']);
  var idxData = _colFor(h.headers, ['data']);

  // insertCheckboxes() azzera il valore: salviamo prima quali erano spuntate.
  var spunte = [];
  if (idxSplit >= 0) {
    var cur = sheet.getRange(daRiga, idxSplit + 1, n, 1).getValues();
    for (var i = 0; i < n; i++) {
      var v = cur[i][0];
      spunte.push([v === true || String(v).trim() === '-']);
    }
  }

  for (var k = 0; k < n; k++) {
    _copiaFormatoRiga(sheet, modello, daRiga + k, lastCol);
  }

  if (idxData >= 0) {
    sheet.getRange(daRiga, idxData + 1, n, 1).setNumberFormat('d mmm yyyy');
  }

  if (idxSplit >= 0) {
    var rng = sheet.getRange(daRiga, idxSplit + 1, n, 1);
    rng.insertCheckboxes();
    rng.setValues(spunte);
  }

  return 'Sistemate ' + n + ' righe (' + daRiga + '-' + aRiga + ') su ' + sheet.getName();
}

// Scorciatoia per il caso concreto: LOG RICCARDO euro, righe 770-774.
// Selezionala nell'editor Apps Script e premi Esegui.
function sistemaRigheRotteRiccardoEuro() {
  return sistemaFormatoRighe(113020932, 770, 774);
}

// ---------- Debito condiviso (righe col trattino) ----------
// SOLO LETTURA: queste funzioni non scrivono, non cancellano e non formattano
// nulla sul foglio. Usano esclusivamente getRange(...).getValues().
//
// Una riga e' "condivisa" (spesa da dividere a meta') se la casella "split" e'
// spuntata (true) oppure contiene il vecchio marcatore "-". Se la colonna
// "split" non esiste ancora, si ripiega sul vecchio metodo: qualsiasi "-" da
// destra della nota in poi.
function _isCondivisa(row, idxSplit, idxNota, lastCol) {
  if (idxSplit >= 0) {
    var s = row[idxSplit];
    return (s === true || String(s).trim() === '-');
  }
  for (var c = idxNota + 1; c < lastCol; c++) {
    if (String(row[c]).trim() === '-') return true;
  }
  return false;
}

function _totaleCondivise(gid) {
  var sheet = _getSheetByGid(gid);
  var h = _findHeader(sheet);
  var headers = h.headers;
  var lastCol = h.lastCol;

  var idxData  = _colFor(headers, ['data']);
  var idxSpesa = _colFor(headers, ['€', 'chf', 'importo', 'spesa', 'euro', 'franc', 'costo']);
  var idxNota  = _colFor(headers, ['dettagl', 'nota', 'note', 'descriz']);
  var idxSplit = _colFor(headers, ['split']);
  if (idxSpesa < 0 && idxData >= 0) idxSpesa = idxData + 1;
  if (idxSpesa < 0 || idxNota < 0) return { totale: 0, meta: 0, conteggio: 0 };

  var firstData = h.row + 1;
  var last = sheet.getLastRow();
  if (last < firstData) return { totale: 0, meta: 0, conteggio: 0 };

  var vals = sheet.getRange(firstData, 1, last - firstData + 1, lastCol).getValues();
  var tot = 0, cnt = 0;
  for (var i = 0; i < vals.length; i++) {
    var row = vals[i];
    if (!_isCondivisa(row, idxSplit, idxNota, lastCol)) continue;
    var v = row[idxSpesa];
    var n = (typeof v === 'number')
      ? v
      : parseFloat(String(v).replace(/[^0-9,.\-]/g, '').replace(',', '.'));
    if (!isNaN(n)) { tot += Math.abs(n); cnt++; }
  }
  return { totale: tot, meta: tot / 2, conteggio: cnt };
}

// SOLO LETTURA: elenca una per una le righe considerate condivise, con il
// numero di riga del foglio, per poter verificare a mano il totale del debito.
// Usa esattamente gli stessi criteri di _totaleCondivise.
function elencoCondivise(gid) {
  var sheet = _getSheetByGid(gid);
  var h = _findHeader(sheet);
  var headers = h.headers;
  var lastCol = h.lastCol;

  var idxData  = _colFor(headers, ['data']);
  var idxSpesa = _colFor(headers, ['€', 'chf', 'importo', 'spesa', 'euro', 'franc', 'costo']);
  var idxCat   = _colFor(headers, ['categor']);
  var idxNota  = _colFor(headers, ['dettagl', 'nota', 'note', 'descriz']);
  var idxSplit = _colFor(headers, ['split']);
  if (idxSpesa < 0 && idxData >= 0) idxSpesa = idxData + 1;
  if (idxSpesa < 0 || idxNota < 0) return { tab: sheet.getName(), righe: [], totale: 0 };

  var firstData = h.row + 1;
  var last = sheet.getLastRow();
  if (last < firstData) return { tab: sheet.getName(), righe: [], totale: 0 };

  var vals = sheet.getRange(firstData, 1, last - firstData + 1, lastCol).getValues();
  var out = [], tot = 0;
  for (var i = 0; i < vals.length; i++) {
    var row = vals[i];
    if (!_isCondivisa(row, idxSplit, idxNota, lastCol)) continue;
    var v = row[idxSpesa];
    var n = (typeof v === 'number')
      ? v
      : parseFloat(String(v).replace(/[^0-9,.\-]/g, '').replace(',', '.'));
    if (isNaN(n)) continue;
    var d = row[idxData];
    tot += Math.abs(n);
    out.push({
      riga: firstData + i,
      data: (d instanceof Date) ? _fmtDate(d) : String(d),
      importo: Math.abs(n),
      categoria: idxCat >= 0 ? String(row[idxCat]).trim() : '',
      nota: String(row[idxNota]).trim(),
      split: String(row[idxSplit >= 0 ? idxSplit : idxNota + 1])
    });
  }
  return { tab: sheet.getName(), righe: out, totale: tot, meta: tot / 2 };
}

// Compone il debito del foglio selezionato e (se passato) del foglio partner
// della stessa valuta. netto = meta(mio) - meta(partner):
//   > 0  -> la persona del foglio partner deve alla persona del foglio "mio"
//   < 0  -> viceversa
// Il calcolo scorre l'intera colonna split di due fogli e sotto carico Apps
// Script ci mette da 3 a 45 secondi. Il risultato pero' cambia solo quando
// qualcuno scrive, quindi si tiene in cache lato server: il primo che chiede
// paga il conto, tutti gli altri (iPhone, app Android, widget) rispondono
// subito. E' la correzione che conta di piu' per l'iPhone, dove iOS cancella
// periodicamente il salvataggio locale e la cache del browser spesso non c'e'.
var DEBITO_TTL_S = 600;

function getDebito(gid, gidPartner) {
  var chiave = _chiaveDebito(gid, gidPartner);
  var cache = CacheService.getScriptCache();
  try {
    var pronto = cache.get(chiave);
    if (pronto) return JSON.parse(pronto);
  } catch (e) {
    // cache illeggibile: si ricalcola
  }

  var mio = _totaleCondivise(gid);
  var partner = (gidPartner != null && !isNaN(gidPartner))
    ? _totaleCondivise(gidPartner)
    : { totale: 0, meta: 0, conteggio: 0 };
  var res = { mio: mio, partner: partner, netto: mio.meta - partner.meta };

  try {
    cache.put(chiave, JSON.stringify(res), DEBITO_TTL_S);
  } catch (e) {
    // non riuscire a salvare non deve far fallire la lettura
  }
  return res;
}

function _chiaveDebito(gid, gidPartner) {
  return 'debito_' + gid + '_' + (gidPartner == null || isNaN(gidPartner) ? 'x' : gidPartner);
}

// Da chiamare dopo OGNI scrittura che tocca la colonna split o gli importi:
// senza questo la cache terrebbe in vita il valore vecchio fino a scadenza e
// una spesa appena inserita non comparirebbe. Si azzerano tutte le
// combinazioni che coinvolgono il foglio toccato e il suo partner di valuta.
function _scadeCacheDebito(gid) {
  try {
    var partner = _partnerDiValuta(gid);
    var chiavi = [_chiaveDebito(gid, partner), _chiaveDebito(gid, null)];
    if (partner != null) {
      chiavi.push(_chiaveDebito(partner, gid));
      chiavi.push(_chiaveDebito(partner, null));
    }
    CacheService.getScriptCache().removeAll(chiavi);
  } catch (e) {
    // se non si riesce a invalidare, il dato si aggiorna comunque entro il TTL
  }
}

// L'altro foglio della stessa valuta, o null se il gid non e' fra i LOG noti.
function _partnerDiValuta(gid) {
  var valute = Object.keys(LOG_GIDS);
  for (var i = 0; i < valute.length; i++) {
    var coppia = LOG_GIDS[valute[i]];
    if (coppia.Roberta === gid) return coppia.Riccardo;
    if (coppia.Riccardo === gid) return coppia.Roberta;
  }
  return null;
}

// ---------- Riepilogo (sola lettura) ----------
// Legge un foglio SOMMARIO (ANNUALE/MENSILE, euro o CHF) e ne estrae:
//   - overview: entrate, uscite, totale, e il periodo (data inizio/fine)
//   - entrate e risparmio per persona (Roberta/Riccardo/Totale)
//   - spese per categoria, separate per persona
//   - andamento: solo per i fogli ANNUALE, serie mensile del risparmio letta
//     dal foglio pivot nascosto (GID_PIVOT).
// Non scrive nulla: usa solo getValues/getDisplayValues.
function getRiepilogo(gid) {
  var sheet = _getSheetByGid(gid);
  var name = sheet.getName();
  var valuta = /CHF/i.test(name) ? 'CHF' : '€';

  var lastR = Math.max(sheet.getLastRow(), 1);
  var lastC = Math.max(sheet.getLastColumn(), 1);
  var rng = sheet.getRange(1, 1, lastR, lastC);
  var vals = rng.getValues();
  var disp = rng.getDisplayValues();

  var out = {
    nome: name,
    valuta: valuta,
    tipo: /ANNUALE/i.test(name) ? 'annuale' : 'mensile',
    periodo: _riepPeriodo(vals, disp),
    overview: _riepOverview(vals),
    entrate: _riepPersone(vals, 'ENTRATE'),
    risparmio: _riepPersone(vals, 'RISPARMIO'),
    spese: {
      roberta: _riepCategorie(vals, 'SPESE ROBERTA'),
      riccardo: _riepCategorie(vals, 'SPESE RICCARDO')
    }
  };
  if (/ANNUALE/i.test(name)) out.andamento = _riepAndamento(valuta);
  return out;
}

// Numero robusto: getValues restituisce gia' numeri (il "-" contabile e' 0).
function _riepNum(v) {
  if (typeof v === 'number') return v;
  if (v === '' || v == null) return 0;
  var s = String(v).replace(/€|chf/gi, '').trim();
  if (!/\d/.test(s)) return 0;
  var fd = s.search(/\d/);
  var neg = s.slice(0, fd).indexOf('-') !== -1;
  var n = parseFloat(s.slice(fd).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  if (isNaN(n)) return 0;
  return neg ? -n : n;
}

// Trova la prima cella il cui testo (trim) e' esattamente uguale a "text".
function _riepFind(vals, text) {
  for (var r = 0; r < vals.length; r++) {
    for (var c = 0; c < vals[r].length; c++) {
      if (String(vals[r][c]).trim() === text) return { r: r, c: c };
    }
  }
  return null;
}

function _riepPeriodo(vals, disp) {
  var a = _riepFind(vals, 'OVERVIEW');
  if (!a) return { inizio: '', fine: '' };
  var inizio = '', fine = '';
  for (var r = a.r + 1; r < Math.min(a.r + 8, vals.length); r++) {
    var lbl = String(vals[r][a.c]).trim().toLowerCase();
    if (lbl === 'data inizio') inizio = disp[r][a.c + 1];
    if (lbl === 'data fine') fine = disp[r][a.c + 1];
  }
  return { inizio: inizio, fine: fine };
}

function _riepOverview(vals) {
  var a = _riepFind(vals, 'OVERVIEW');
  var o = { entrate: 0, uscite: 0, totale: 0 };
  if (!a) return o;
  for (var r = a.r + 1; r < Math.min(a.r + 8, vals.length); r++) {
    var lbl = String(vals[r][a.c]).trim().toLowerCase();
    var val = _riepNum(vals[r][a.c + 1]);
    if (lbl === 'entrate') o.entrate = val;
    if (lbl === 'uscite') o.uscite = val;
    if (lbl === 'totale') o.totale = val;
  }
  return o;
}

// Tabella con righe Roberta/Riccardo/Totale sotto un'intestazione (ENTRATE/RISPARMIO).
function _riepPersone(vals, anchor) {
  var a = _riepFind(vals, anchor);
  var o = { roberta: 0, riccardo: 0, totale: 0 };
  if (!a) return o;
  for (var r = a.r + 1; r < Math.min(a.r + 8, vals.length); r++) {
    var lbl = String(vals[r][a.c]).trim().toLowerCase();
    var val = _riepNum(vals[r][a.c + 1]);
    if (lbl === 'roberta') o.roberta = val;
    else if (lbl === 'riccardo') o.riccardo = val;
    else if (lbl === 'totale') { o.totale = val; break; }
  }
  return o;
}

// Tabella categoria->importo sotto "SPESE ROBERTA"/"SPESE RICCARDO".
// Categoria nella colonna dell'ancora, importo nella colonna a destra.
// Si ferma alla riga "Totale".
function _riepCategorie(vals, anchor) {
  var a = _riepFind(vals, anchor);
  var lista = [];
  if (!a) return lista;
  for (var r = a.r + 1; r < vals.length; r++) {
    var lbl = String(vals[r][a.c]).trim();
    if (!lbl) continue;
    if (lbl.toLowerCase() === 'totale') break;
    lista.push({ categoria: lbl, importo: _riepNum(vals[r][a.c + 1]) });
  }
  return lista;
}

// Andamento risparmio mensile dal foglio pivot nascosto.
// Le intestazioni mese stanno su una riga (token tipo "AUG 24"/"SEP24"); sotto,
// tre righe Roberta/Riccardo/Totale. La prima tabella e' in euro, la seconda CHF.
function _riepAndamento(valuta) {
  var sh = _getSheetByGid(GID_PIVOT);
  var v = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), Math.max(sh.getLastColumn(), 1)).getValues();
  var headerRows = [];
  var mese = /^[A-Z]{3}\s?\d{2}$/i;
  for (var r = 0; r < v.length; r++) {
    if (mese.test(String(v[r][2]).trim())) headerRows.push(r);
  }
  var hr = (valuta === 'CHF') ? headerRows[1] : headerRows[0];
  if (hr == null) return null;

  var mesi = [], cols = [];
  for (var c = 2; c < v[hr].length; c++) {
    var m = String(v[hr][c]).trim();
    if (!m) break;
    mesi.push(m); cols.push(c);
  }
  function serie(label) {
    for (var r = hr + 1; r < Math.min(hr + 5, v.length); r++) {
      if (String(v[r][1]).trim().toLowerCase() === label) {
        return cols.map(function (c) { return _riepNum(v[r][c]); });
      }
    }
    return [];
  }
  return { mesi: mesi, roberta: serie('roberta'), riccardo: serie('riccardo'), totale: serie('totale') };
}

// ---------- Riepilogo per periodo (ricalcolato dai LOG, sola lettura) ----------
// Legge i due fogli LOG della valuta scelta e aggrega su un periodo arbitrario
// (un mese o un anno), replicando la logica dei fogli SOMMARIO:
//   entrata  = riga la cui categoria NON e' di spesa e NON e' storni/rimborsi
//   spesa    = riga con categoria tra le 15 di SPESE_CATS
//   storni   = escluso da entrate e spese
//   risparmio = entrate - spese
function _fmtDate(d) {
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
}

// Righe di un LOG normalizzate: { date:Date, amount:Number, cat:String }.
function _riepLogRows(gid) {
  var sheet = _getSheetByGid(gid);
  var h = _findHeader(sheet);
  var headers = h.headers, lastCol = h.lastCol;
  var idxData = _colFor(headers, ['data']);
  var idxImp = _colFor(headers, ['€', 'chf', 'importo', 'spesa', 'euro', 'franc', 'costo']);
  var idxCat = _colFor(headers, ['categor']);
  var idxNota = _colFor(headers, ['dettagl', 'nota', 'note', 'descriz']);
  if (idxImp < 0 && idxData >= 0) idxImp = idxData + 1;
  if (idxData < 0 || idxCat < 0) return [];
  var first = h.row + 1, last = sheet.getLastRow();
  if (last < first) return [];
  var vals = sheet.getRange(first, 1, last - first + 1, lastCol).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var d = vals[i][idxData];
    if (!(d instanceof Date)) {
      if (!d) continue;
      d = new Date(d);
      if (isNaN(d.getTime())) continue;
    }
    var cat = String(vals[i][idxCat]).trim();
    if (!cat) continue;
    var amt = vals[i][idxImp];
    amt = (typeof amt === 'number') ? amt : _riepNum(amt);
    out.push({
      date: d,
      amount: Math.abs(amt),
      cat: cat,
      nota: idxNota >= 0 ? String(vals[i][idxNota]).trim() : '',
      riga: first + i
    });
  }
  return out;
}

// SOLO LETTURA: singole spese di una categoria nel periodo scelto, ordinate
// dalla piu' recente. persona = 'Riccardo' | 'Roberta' | 'Insieme'.
// Alimenta il drill-down del riepilogo (click su una categoria).
function elencoSpeseCategoria(conto, tipo, anno, mese, persona, categoria) {
  var gids = LOG_GIDS[conto] || LOG_GIDS.Euro;
  var start, end;
  if (tipo === 'mensile') { start = new Date(anno, mese - 1, 1); end = new Date(anno, mese, 1); }
  else { start = new Date(anno, 0, 1); end = new Date(anno + 1, 0, 1); }

  var quali = persona === 'Riccardo' ? ['Riccardo']
    : persona === 'Roberta' ? ['Roberta']
      : ['Riccardo', 'Roberta'];
  var cercata = String(categoria).trim().toLowerCase();

  var out = [], tot = 0;
  quali.forEach(function (chi) {
    var rows = _riepLogRows(gids[chi]);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.date < start || r.date >= end) continue;
      if (r.cat.toLowerCase() !== cercata) continue;
      tot += r.amount;
      out.push({
        data: _fmtDate(r.date),
        ts: r.date.getTime(),
        importo: r.amount,
        nota: r.nota,
        persona: chi,
        riga: r.riga,
        gid: gids[chi] // il client deve sapere su quale foglio sta agendo
      });
    }
  });
  out.sort(function (a, b) { return b.ts - a.ts; });

  return {
    categoria: categoria,
    persona: persona,
    valuta: conto === 'Franchi' ? 'CHF' : '€',
    periodo: { inizio: _fmtDate(start), fine: _fmtDate(new Date(end.getTime() - 86400000)) },
    righe: out,
    totale: tot,
    conteggio: out.length
  };
}

// true se la categoria e' una delle 15 di spesa. Tutto il resto (stipendi,
// tredicesime, storni e rimborsi) conta come entrata, come sui fogli SOMMARIO.
function _isSpesa(cat) {
  return SPESE_CATS.indexOf(cat.toLowerCase()) !== -1;
}

// Aggrega un LOG su [start, end): entrate, spese, risparmio, spese per categoria.
function _riepAggPersona(gid, start, end) {
  var rows = _riepLogRows(gid);
  var entrate = 0, spese = 0, byCat = {}, entByCat = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.date < start || r.date >= end) continue;
    var lc = r.cat.toLowerCase();
    if (_isSpesa(r.cat)) { spese += r.amount; byCat[lc] = (byCat[lc] || 0) + r.amount; }
    else { entrate += r.amount; entByCat[r.cat] = (entByCat[r.cat] || 0) + r.amount; }
  }
  return { entrate: entrate, spese: spese, risparmio: entrate - spese, byCat: byCat, entByCat: entByCat };
}

// Risparmio (entrate - spese) di un set di righe gia' lette, su [start, end).
function _risparmioPeriodo(rows, start, end) {
  var entrate = 0, spese = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.date < start || r.date >= end) continue;
    if (_isSpesa(r.cat)) spese += r.amount; else entrate += r.amount;
  }
  return entrate - spese;
}

// Andamento risparmio: 12 mesi dell'anno scelto, per persona + totale.
function _riepAndamentoCalc(gids, anno) {
  var rowsR = _riepLogRows(gids.Roberta), rowsI = _riepLogRows(gids.Riccardo);
  var nomi = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
  var mesi = [], rob = [], ricc = [], tot = [];
  for (var m = 0; m < 12; m++) {
    var s = new Date(anno, m, 1), e = new Date(anno, m + 1, 1);
    var rr = _risparmioPeriodo(rowsR, s, e), ri = _risparmioPeriodo(rowsI, s, e);
    mesi.push(nomi[m] + ' ' + String(anno).slice(2));
    rob.push(rr); ricc.push(ri); tot.push(rr + ri);
  }
  return { mesi: mesi, roberta: rob, riccardo: ricc, totale: tot };
}

function getRiepCalc(conto, tipo, anno, mese) {
  var gids = LOG_GIDS[conto] || LOG_GIDS.Euro;
  var valuta = conto === 'Franchi' ? 'CHF' : '€';
  var start, end;
  if (tipo === 'mensile') { start = new Date(anno, mese - 1, 1); end = new Date(anno, mese, 1); }
  else { start = new Date(anno, 0, 1); end = new Date(anno + 1, 0, 1); }

  var rob = _riepAggPersona(gids.Roberta, start, end);
  var ricc = _riepAggPersona(gids.Riccardo, start, end);

  function listaCat(byCat) {
    return SPESE_CATS_LABEL.map(function (lbl, i) {
      return { categoria: lbl, importo: byCat[SPESE_CATS[i]] || 0 };
    });
  }

  var out = {
    valuta: valuta,
    tipo: tipo === 'mensile' ? 'mensile' : 'annuale',
    anno: anno,
    mese: tipo === 'mensile' ? mese : null,
    periodo: { inizio: _fmtDate(start), fine: _fmtDate(new Date(end.getTime() - 86400000)) },
    overview: {
      entrate: rob.entrate + ricc.entrate,
      uscite: rob.spese + ricc.spese,
      totale: (rob.entrate + ricc.entrate) - (rob.spese + ricc.spese)
    },
    entrate: { roberta: rob.entrate, riccardo: ricc.entrate, totale: rob.entrate + ricc.entrate },
    risparmio: { roberta: rob.risparmio, riccardo: ricc.risparmio, totale: rob.risparmio + ricc.risparmio },
    spese: { roberta: listaCat(rob.byCat), riccardo: listaCat(ricc.byCat) }
  };
  if (tipo !== 'mensile') out.andamento = _riepAndamentoCalc(gids, anno);
  return out;
}

// ---------- Salda: azzera le spunte "split" di UN foglio ----------
// SCRITTURA LIMITATA: tocca esclusivamente la colonna "split". Non modifica
// date, importi, categorie, note o altre colonne. Le spese restano; vengono
// solo tolte le spunte di condivisione.
function saldaFoglio(gid) {
  var sheet = _getSheetByGid(gid);
  var h = _findHeader(sheet);
  var idxSplit = _colFor(h.headers, ['split']);
  if (idxSplit < 0) throw new Error('Colonna "split" non trovata: esegui prima setupSplitColumn().');

  var firstData = h.row + 1;
  var last = sheet.getLastRow();
  if (last < firstData) return { azzerate: 0 };

  var col = idxSplit + 1; // 1-based
  var rng = sheet.getRange(firstData, col, last - firstData + 1, 1);
  var vals = rng.getValues();
  var out = [], n = 0, spuntate = [];
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i][0];
    if (v === true || String(v).trim() === '-') {
      n++;
      spuntate.push(firstData + i); // numero di riga reale, per poter tornare indietro
    }
    out.push([false]);
  }
  rng.setValues(out);      // un'unica scrittura, solo la colonna split
  rng.insertCheckboxes();  // garantisce la checkbox (niente testo "false")

  // Prima di questa versione l'operazione era IRREVERSIBILE: toglieva le spunte
  // senza registrare quali fossero, e l'unico modo di tornare indietro era la
  // cronologia di Google Sheets. E' successo davvero, su 29 righe. Ora l'elenco
  // delle righe spuntate viene salvato, cosi' un annullamento le rimette tutte.
  _ricordaSalda(gid, spuntate);
  _scadeCacheDebito(gid);

  return { azzerate: n, annullabile: spuntate.length > 0 };
}

// ---------- Annullamento dell'ultimo "saldato" ----------
var _CHIAVE_SALDA = 'ultimoSalda_';

function _ricordaSalda(gid, righe) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      _CHIAVE_SALDA + gid,
      JSON.stringify({ righe: righe, quando: new Date().toISOString() })
    );
  } catch (e) {
    // Se non si riesce a salvare, l'azzeramento resta valido: si perde solo la
    // possibilita' di annullarlo, e non vale la pena far fallire tutto.
  }
}

// Rimette le spunte tolte dall'ultimo saldaFoglio() su quel foglio.
function annullaSalda(gid) {
  var sheet = _getSheetByGid(gid);
  var h = _findHeader(sheet);
  var idxSplit = _colFor(h.headers, ['split']);
  if (idxSplit < 0) throw new Error('Colonna "split" non trovata.');

  var grezzo = PropertiesService.getScriptProperties().getProperty(_CHIAVE_SALDA + gid);
  if (!grezzo) throw new Error('Nessun azzeramento da annullare su questo foglio.');

  var dati = JSON.parse(grezzo);
  var righe = (dati && dati.righe) || [];
  if (!righe.length) throw new Error('L\'ultimo azzeramento non aveva spunte da rimettere.');

  var last = sheet.getLastRow();
  var rimesse = 0;
  for (var i = 0; i < righe.length; i++) {
    var r = righe[i];
    if (r <= h.row || r > last) continue; // riga non piu' valida: si salta
    var cella = sheet.getRange(r, idxSplit + 1);
    cella.insertCheckboxes();
    cella.setValue(true);
    rimesse++;
  }

  // Si consuma: annullare due volte di fila non ha senso e rimetterebbe spunte
  // su righe che nel frattempo potrebbero essere state cambiate a mano.
  PropertiesService.getScriptProperties().deleteProperty(_CHIAVE_SALDA + gid);
  _scadeCacheDebito(gid);

  return { ok: true, version: VERSION, rimesse: rimesse, quando: dati.quando };
}

// ---------- Elimina una spesa: svuota la riga, non la rimuove ----------
// SCRITTURA MIRATA A UNA SOLA RIGA. Svuota i contenuti di data, importo,
// categoria e nota e riporta la checkbox split a non spuntata. La riga resta
// al suo posto, vuota e con la sua formattazione: cancellare la riga vera
// sposterebbe tutte quelle sotto e invaliderebbe ogni numero di riga gia'
// mostrato nell'app (i "riga" restituiti da elencoSpeseCategoria).
//
// Il numero di riga da solo non basta come indirizzo: se il foglio e' cambiato
// da quando l'app ha caricato l'elenco, quel numero puo' puntare a un'altra
// spesa. Per questo la chiamata porta con se' i valori attesi e la riga viene
// svuotata solo se combaciano ancora.
function svuotaRiga(gid, riga, atteso) {
  var sheet = _getSheetByGid(gid);
  var h = _findHeader(sheet);
  var headers = h.headers, lastCol = h.lastCol;

  if (!riga || riga <= h.row) throw new Error('Riga non valida.');
  if (riga > sheet.getLastRow()) throw new Error('Riga oltre la fine del foglio.');

  var idxData  = _colFor(headers, ['data']);
  var idxSpesa = _colFor(headers, ['€', 'chf', 'importo', 'spesa', 'euro', 'franc', 'costo']);
  var idxCat   = _colFor(headers, ['categor']);
  var idxNota  = _colFor(headers, ['dettagl', 'nota', 'note', 'descriz']);
  var idxSplit = _colFor(headers, ['split']);
  if (idxSpesa < 0 && idxData >= 0) idxSpesa = idxData + 1;

  var row = sheet.getRange(riga, 1, 1, lastCol).getValues()[0];

  // Verifica che la riga sia ancora quella che l'utente ha visto.
  if (atteso) {
    if (atteso.importo != null && idxSpesa >= 0) {
      var v = row[idxSpesa];
      var n = (typeof v === 'number') ? v : _riepNum(v);
      if (Math.abs(Math.abs(n) - Math.abs(parseFloat(atteso.importo))) > 0.005) {
        throw new Error('La riga ' + riga + ' non contiene piu\' l\'importo atteso: ricarica l\'elenco.');
      }
    }
    if (atteso.nota != null && idxNota >= 0) {
      if (String(row[idxNota]).trim() !== String(atteso.nota).trim()) {
        throw new Error('La riga ' + riga + ' non contiene piu\' la nota attesa: ricarica l\'elenco.');
      }
    }
    if (atteso.categoria != null && idxCat >= 0) {
      if (String(row[idxCat]).trim().toLowerCase() !== String(atteso.categoria).trim().toLowerCase()) {
        throw new Error('La riga ' + riga + ' non e\' piu\' di questa categoria: ricarica l\'elenco.');
      }
    }
  }

  // Cosa stiamo per cancellare, per poterlo riferire (e riscrivere a mano).
  var prima = {
    data: (row[idxData] instanceof Date) ? _fmtDate(row[idxData]) : String(row[idxData]),
    importo: idxSpesa >= 0 ? row[idxSpesa] : '',
    categoria: idxCat >= 0 ? String(row[idxCat]) : '',
    nota: idxNota >= 0 ? String(row[idxNota]) : ''
  };

  // clearContent() toglie i valori ma lascia intatta la formattazione, cosi'
  // la riga vuota resta identica alle altre e un reinserimento futuro eredita
  // il formato corretto.
  [idxData, idxSpesa, idxCat, idxNota].forEach(function (i) {
    if (i >= 0) sheet.getRange(riga, i + 1).clearContent();
  });

  // La checkbox va tolta del tutto, non lasciata vuota: una casella su una riga
  // senza spesa e' un residuo visibile, e per Google conta come contenuto,
  // quindi getLastRow() non si accorcia e il foglio continua a dichiarare righe
  // che non esistono piu'. La checkbox non serve conservarla: aggiungiSpesa la
  // reinserisce sulla riga di destinazione a ogni scrittura.
  if (idxSplit >= 0) {
    var cell = sheet.getRange(riga, idxSplit + 1);
    cell.removeCheckboxes();
    cell.clearContent();
  }

  // Se la riga svuotata sta nella zona ordinabile, riordinando la coda il
  // buco scivola in fondo e lo spazio torna disponibile. Sopra la soglia non
  // si tocca niente e la riga resta vuota dov'e'.
  var ordinate = 0;
  if (SORT_FROM[gid] && riga >= SORT_FROM[gid]) {
    ordinate = _ordinaCoda(sheet, gid, h);
  }

  _scadeCacheDebito(gid);

  return {
    ok: true, version: VERSION, riga: riga, tab: sheet.getName(),
    eliminato: prima, righeRiordinate: ordinate
  };
}

// ---------- Recupero delle spunte da una copia del foglio ----------
// Serve quando le spunte "split" sono state perse e non c'e' un annullamento
// da usare (per esempio perche' l'azzeramento e' avvenuto con una versione del
// backend che non le registrava).
//
// Procedura:
//   1. Nel foglio: File > Cronologia versioni > Mostra cronologia versioni.
//   2. Scegli una versione precedente alla perdita, tre puntini, "Crea una copia".
//   3. Apri la copia e prendi il suo ID dall'URL (la parte fra /d/ e /edit).
//   4. Qui nell'editor esegui: ripristinaSplitDaCopia('ID_DELLA_COPIA')
//
// I fogli sono accoppiati per NOME, non per gid, perche' una copia ha gid suoi.
// L'operazione e' ADDITIVA: mette le spunte dove la copia ce l'aveva e non
// toglie nulla, quindi non puo' cancellare spese o spunte messe nel frattempo.
function ripristinaSplitDaCopia(idCopia, soloTab) {
  if (!idCopia) throw new Error('Serve l\'ID della copia del foglio.');
  var copia = SpreadsheetApp.openById(idCopia);
  var esito = [];

  Object.keys(SORT_FROM).forEach(function (k) {
    var gid = parseInt(k, 10);
    var vivo = _getSheetByGid(gid);
    var nome = vivo.getName();
    if (soloTab && nome !== soloTab) return;

    var vecchio = copia.getSheetByName(nome);
    if (!vecchio) { esito.push(nome + ': non presente nella copia'); return; }

    var h = _findHeader(vivo);
    var idxSplit = _colFor(h.headers, ['split']);
    if (idxSplit < 0) { esito.push(nome + ': colonna split assente'); return; }

    var hv = _findHeader(vecchio);
    var idxSplitV = _colFor(hv.headers, ['split']);
    if (idxSplitV < 0) { esito.push(nome + ': colonna split assente nella copia'); return; }

    var daRiga = h.row + 1;
    var quante = Math.min(
      vivo.getLastRow() - daRiga + 1,
      vecchio.getLastRow() - (hv.row + 1) + 1
    );
    if (quante < 1) { esito.push(nome + ': nessuna riga da confrontare'); return; }

    var vecchie = vecchio.getRange(hv.row + 1, idxSplitV + 1, quante, 1).getValues();
    var col = vivo.getRange(daRiga, idxSplit + 1, quante, 1);
    var attuali = col.getValues();

    var nuovi = [], rimesse = 0;
    for (var i = 0; i < quante; i++) {
      var eraSpuntata = vecchie[i][0] === true || String(vecchie[i][0]).trim() === '-';
      var eSpuntata = attuali[i][0] === true;
      if (eraSpuntata && !eSpuntata) rimesse++;
      nuovi.push([eSpuntata || eraSpuntata]);
    }

    col.insertCheckboxes();
    col.setValues(nuovi);
    esito.push(nome + ': rimesse ' + rimesse + ' spunte su ' + quante + ' righe');
  });

  Logger.log(esito.join('\n'));
  return esito;
}

// ---------- Manutenzione una-tantum: ripulisce i residui ----------
// Toglie le checkbox rimaste sulle righe vuote in coda ai quattro fogli. Serve
// solo a ripulire cio' che le versioni fino alla v20 lasciavano dietro: da v21
// svuotaRiga non lascia piu' residui, quindi questa va eseguita una volta sola.
// Da lanciare dall'editor Apps Script (Esegui), non e' esposta come endpoint.
function pulisciCheckboxVuote() {
  var out = [];
  Object.keys(SORT_FROM).forEach(function (k) {
    var gid = parseInt(k, 10);
    var sheet = _getSheetByGid(gid);
    var h = _findHeader(sheet);
    var idxSplit = _colFor(h.headers, ['split']);
    var da = SORT_FROM[gid];
    var prima = sheet.getLastRow();
    if (idxSplit >= 0 && prima >= da) {
      _sistemaCheckboxCoda(sheet, h, da, prima - da + 1, idxSplit);
      SpreadsheetApp.flush();
    }
    // Sotto la soglia il codice non ordina mai nulla, ma qualche riga vuota con
    // checkbox e' rimasta li' dalle riparazioni fatte a mano (sistemaFormatoRighe
    // applica la casella a tutto l'intervallo, righe vuote comprese). Quelle in
    // fondo vanno tolte lo stesso, altrimenti il foglio continua a dichiarare
    // righe che non contengono niente. Si tolgono solo le righe vuote FINALI: ci
    // si ferma alla prima che contiene una spesa, cosi' lo storico non si tocca.
    if (idxSplit >= 0) _togliCodaVuota(sheet, h, idxSplit);
    out.push(sheet.getName() + ': ' + prima + ' -> ' + sheet.getLastRow());
  });
  Logger.log(out.join('\n'));
  return out;
}

// Toglie la checkbox dalle righe vuote che stanno in fondo al foglio, una alla
// volta, finche' l'ultima riga non contiene una spesa vera. Non tocca nessun
// valore: agisce solo sulla colonna split.
function _togliCodaVuota(sheet, h, idxSplit) {
  var idxData  = _colFor(h.headers, ['data']);
  var idxSpesa = _colFor(h.headers, ['€', 'chf', 'importo', 'spesa', 'euro', 'franc', 'costo']);
  var idxCat   = _colFor(h.headers, ['categor']);
  var idxNota  = _colFor(h.headers, ['dettagl', 'nota', 'note', 'descriz']);
  if (idxSpesa < 0 && idxData >= 0) idxSpesa = idxData + 1;

  var tolte = 0;
  for (var giro = 0; giro < 50; giro++) {
    var last = sheet.getLastRow();
    if (last <= h.row) break;
    var row = sheet.getRange(last, 1, 1, h.lastCol).getValues()[0];
    var vuota = [idxData, idxSpesa, idxCat, idxNota].every(function (k) {
      return k < 0 || String(row[k]).trim() === '';
    });
    if (!vuota) break; // arrivati a una spesa vera: si smette
    var cell = sheet.getRange(last, idxSplit + 1);
    cell.removeCheckboxes();
    cell.clearContent();
    SpreadsheetApp.flush();
    // Se il foglio non si accorcia, la riga e' tenuta in vita da un'altra
    // colonna: inutile insistere, si uscirebbe in loop.
    if (sheet.getLastRow() >= last) break;
    tolte++;
  }
  return tolte;
}

// ---------- Setup una-tantum: crea la colonna "split" con checkbox ----------
// Da lanciare UNA volta dall'editor Apps Script (Esegui > setupSplitColumn).
// Per i 4 fogli noti mette l'intestazione "split" nella colonna a destra di
// DETTAGLI, converte i "-" gia' presenti in spunta (true) e applica la
// checkbox. Tocca solo l'intestazione e quella singola colonna.
function setupSplitColumn() {
  var GIDS = [113020932, 1888286288, 650699013, 1063479927];
  var report = [];
  for (var g = 0; g < GIDS.length; g++) {
    var sheet = _getSheetByGid(GIDS[g]);
    var h = _findHeader(sheet);
    var idxNota = _colFor(h.headers, ['dettagl', 'nota', 'note', 'descriz']);
    if (idxNota < 0) { report.push(sheet.getName() + ': colonna nota non trovata, SALTATO'); continue; }
    var splitCol = idxNota + 2; // 1-based: colonna subito a destra della nota

    sheet.getRange(h.row, splitCol).setValue('split'); // intestazione

    var firstData = h.row + 1;
    var last = sheet.getLastRow();
    var convertiti = 0;
    if (last >= firstData) {
      var rng = sheet.getRange(firstData, splitCol, last - firstData + 1, 1);
      var vals = rng.getValues();
      var out = [];
      for (var i = 0; i < vals.length; i++) {
        var v = vals[i][0];
        var checked = (v === true || String(v).trim() === '-');
        if (checked) convertiti++;
        out.push([checked]);
      }
      rng.setValues(out);
      rng.insertCheckboxes();
    }
    report.push(sheet.getName() + ': colonna ' + splitCol + ', spunte convertite ' + convertiti);
  }
  Logger.log(report.join('\n'));
  return report;
}
