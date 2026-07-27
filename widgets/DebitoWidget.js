import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { formattaImporto, formattaOra } from './debitoData';

function tavolozza(tema) {
  if (tema === 'dark') {
    return {
      sfondo: '#12141a',
      riga: '#1c1f27',
      badge: '#2a2f3a',
      titolo: '#f3f4f6',
      testo: '#e5e7eb',
      attenuato: '#7c8496',
      riccardo: '#fbbf24',
      roberta: '#5eb0f7',
      pari: '#9ca3af',
    };
  }
  return {
    sfondo: '#ffffff',
    riga: '#f4f6f9',
    badge: '#e4e8ef',
    titolo: '#0f1720',
    testo: '#111827',
    attenuato: '#6b7280',
    riccardo: '#b45309',
    roberta: '#1d4ed8',
    pari: '#6b7280',
  };
}

function coloreDi(debitore, p) {
  if (!debitore) return p.pari;
  return debitore === 'Riccardo' ? p.riccardo : p.roberta;
}

// Una riga per valuta: pastiglia con il simbolo a sinistra, importo e direzione
// a destra. In orizzontale ci sta la frase intera ("Riccardo deve a Roberta"),
// che in colonna veniva tagliata a meta'.
function Riga({ voce, p }) {
  const colore = coloreDi(voce.debitore, p);

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: p.riga,
        borderRadius: 11,
        paddingHorizontal: 9,
        paddingVertical: 5,
        marginTop: 4,
      }}
    >
      <FlexWidget
        style={{
          width: 34,
          height: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: p.badge,
          borderRadius: 7,
          marginRight: 9,
        }}
      >
        <TextWidget
          text={voce.simbolo}
          style={{ fontSize: 10, fontWeight: '700', color: p.attenuato }}
        />
      </FlexWidget>

      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget
          text={formattaImporto(voce.importo)}
          style={{ fontSize: 17, fontWeight: '700', color: colore }}
        />
        <TextWidget
          text={voce.frase}
          style={{ fontSize: 9, color: p.attenuato }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

export function DebitoWidget({ dati, tema = 'light' }) {
  const p = tavolozza(tema);
  const voci = dati && dati.voci;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: p.sfondo,
        borderRadius: 16,
        paddingHorizontal: 9,
        paddingVertical: 7,
      }}
      clickAction="OPEN_APP"
    >
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 2,
        }}
      >
        <TextWidget
          text="Debito condiviso"
          style={{ fontSize: 11, fontWeight: '700', color: p.titolo }}
        />
        {/* Android non ridisegna un widget piu' di una volta ogni 30 minuti,
            quindi serve un tocco esplicito per forzare la lettura. */}
        <FlexWidget
          style={{ paddingHorizontal: 6, paddingVertical: 2 }}
          clickAction="AGGIORNA"
        >
          <TextWidget
            text={
              !dati || !dati.aggiornato
                ? 'tocca per aggiornare'
                : (dati.vecchio ? 'vecchio, ' : 'agg. ') + formattaOra(dati.aggiornato)
            }
            style={{ fontSize: 9, color: p.attenuato }}
          />
        </FlexWidget>
      </FlexWidget>

      {voci && voci.length ? (
        <FlexWidget
          style={{
            width: 'match_parent',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {voci.map((v) => (
            <Riga key={v.valuta} voce={v} p={p} />
          ))}
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{
            width: 'match_parent',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="AGGIORNA"
        >
          <TextWidget
            text="Nessun dato"
            style={{ fontSize: 14, fontWeight: '500', color: p.titolo }}
          />
          <TextWidget
            text="tocca per riprovare"
            style={{ fontSize: 11, color: p.attenuato }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
