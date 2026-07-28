import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { formattaImporto, formattaOra } from './debitoData';

// Sopra questa larghezza in dp ci sta la frase intera ("Riccardo deve a
// Roberta"); sotto va usata quella corta o viene tagliata a meta'.
const LARGHEZZA_FRASE_INTERA = 200;

function tavolozza(tema) {
  if (tema === 'dark') {
    return {
      sfondo: '#12141a',
      riga: '#1c1f27',
      titolo: '#f3f4f6',
      attenuato: '#7c8496',
      riccardo: '#fbbf24',
      roberta: '#5eb0f7',
      pari: '#9ca3af',
    };
  }
  return {
    sfondo: '#ffffff',
    riga: '#f4f6f9',
    titolo: '#0f1720',
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

// Blocco verticale: valuta, importo, chi deve. Impilati invece che affiancati
// perche' in un 2x2 la larghezza e' la risorsa scarsa, non l'altezza.
function Blocco({ voce, p, largo }) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: p.riga,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginTop: 5,
      }}
    >
      <TextWidget
        text={voce.simbolo}
        style={{ fontSize: 9, fontWeight: '700', color: p.attenuato }}
      />
      <TextWidget
        text={formattaImporto(voce.importo)}
        style={{ fontSize: 18, fontWeight: '700', color: coloreDi(voce.debitore, p) }}
      />
      <TextWidget
        text={largo ? voce.frase : voce.fraseCorta}
        style={{ fontSize: 9, color: p.attenuato }}
      />
    </FlexWidget>
  );
}

export function DebitoWidget({ dati, tema = 'light', larghezza = 0 }) {
  const p = tavolozza(tema);
  const voci = dati && dati.voci;
  const largo = larghezza >= LARGHEZZA_FRASE_INTERA;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: p.sfondo,
        borderRadius: 16,
        paddingHorizontal: 8,
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
          text={largo ? 'Debito condiviso' : 'Debito'}
          style={{ fontSize: 10, fontWeight: '700', color: p.titolo }}
        />
        {/* Android non ridisegna un widget piu' di una volta ogni 30 minuti,
            quindi serve un tocco esplicito per forzare la lettura. */}
        <FlexWidget
          style={{ paddingHorizontal: 4, paddingVertical: 2 }}
          clickAction="AGGIORNA"
        >
          <TextWidget
            text={
              !dati || !dati.aggiornato
                ? 'agg.'
                : (dati.vecchio ? '! ' : '') + formattaOra(dati.aggiornato)
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
            <Blocco key={v.valuta} voce={v} p={p} largo={largo} />
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
            style={{ fontSize: 13, fontWeight: '500', color: p.titolo }}
          />
          <TextWidget
            text="tocca per riprovare"
            style={{ fontSize: 9, color: p.attenuato }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
