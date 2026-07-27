import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { formattaImporto, formattaOra } from './debitoData';

function tavolozza(tema) {
  if (tema === 'dark') {
    return {
      sfondo: '#0f1115',
      riquadro: '#1a1d24',
      titolo: '#e5e7eb',
      attenuato: '#8b93a1',
      riccardo: '#fbbf24',
      roberta: '#60a5fa',
      pari: '#9ca3af',
    };
  }
  return {
    sfondo: '#ffffff',
    riquadro: '#f2f4f7',
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

function Colonna({ voce, p }) {
  return (
    <FlexWidget
      style={{
        flex: 1,
        height: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: p.riquadro,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginHorizontal: 4,
      }}
    >
      <TextWidget
        text={voce.valuta.toUpperCase()}
        style={{ fontSize: 10, fontWeight: '500', color: p.attenuato }}
      />
      <TextWidget
        text={formattaImporto(voce.importo) + ' ' + voce.simbolo}
        style={{ fontSize: 20, fontWeight: '700', color: coloreDi(voce.debitore, p) }}
      />
      <TextWidget
        text={voce.debitore ? voce.debitore + ' deve' : 'in pari'}
        style={{ fontSize: 11, color: p.attenuato }}
      />
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
        borderRadius: 18,
        paddingHorizontal: 10,
        paddingVertical: 10,
      }}
      clickAction="OPEN_APP"
    >
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 4,
          marginBottom: 8,
        }}
      >
        <TextWidget
          text="Debito condiviso"
          style={{ fontSize: 13, fontWeight: '700', color: p.titolo }}
        />
        {/* Android non aggiorna un widget piu' di una volta ogni 30 minuti, quindi
            serve un modo esplicito per forzare la lettura. */}
        <FlexWidget
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
          clickAction="AGGIORNA"
        >
          <TextWidget
            text={
              !dati || !dati.aggiornato
                ? 'aggiorna'
                : (dati.vecchio ? 'vecchio · ' : '') + formattaOra(dati.aggiornato)
            }
            style={{ fontSize: 10, color: p.attenuato }}
          />
        </FlexWidget>
      </FlexWidget>

      {voci && voci.length ? (
        <FlexWidget
          style={{
            width: 'match_parent',
            flex: 1,
            flexDirection: 'row',
            alignItems: 'stretch',
          }}
        >
          {voci.map((v) => (
            <Colonna key={v.valuta} voce={v} p={p} />
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
