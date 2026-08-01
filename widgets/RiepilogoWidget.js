import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { formattaImporto, formattaOra } from './debitoData';
import {
  COLORE_RISPARMIO, COLORE_ROSSO, COLORE_USCITE,
  percentualeRisparmio, tortaMensile,
} from './tortaSvg';

function tavolozza(tema) {
  if (tema === 'dark') {
    return {
      sfondo: '#12141a', riga: '#1c1f27', pista: '#2a2f3a',
      titolo: '#f3f4f6', attenuato: '#7c8496',
      riccardo: '#fbbf24', roberta: '#5eb0f7', pari: '#9ca3af',
    };
  }
  return {
    sfondo: '#ffffff', riga: '#f4f6f9', pista: '#e4e8ef',
    titolo: '#0f1720', attenuato: '#6b7280',
    riccardo: '#b45309', roberta: '#1d4ed8', pari: '#6b7280',
  };
}

function coloreDi(debitore, p) {
  if (!debitore) return p.pari;
  return debitore === 'Riccardo' ? p.riccardo : p.roberta;
}

function RigaDebito({ voce, p }) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
      }}
    >
      <TextWidget
        text={voce.simbolo}
        style={{ fontSize: 9, fontWeight: '700', color: p.attenuato, marginRight: 5 }}
      />
      <TextWidget
        text={formattaImporto(voce.importo)}
        style={{ fontSize: 15, fontWeight: '700', color: coloreDi(voce.debitore, p) }}
      />
      <TextWidget
        text={' ' + voce.fraseCorta}
        style={{ fontSize: 9, color: p.attenuato }}
      />
    </FlexWidget>
  );
}

function VoceLegenda({ colore, etichetta, valore, simbolo, p }) {
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
      <FlexWidget
        style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colore, marginRight: 5 }}
      />
      <TextWidget
        text={etichetta}
        style={{ fontSize: 9, color: p.attenuato, marginRight: 4 }}
      />
      <TextWidget
        text={simbolo + ' ' + formattaImporto(valore)}
        style={{ fontSize: 10, fontWeight: '700', color: p.titolo }}
      />
    </FlexWidget>
  );
}

export function RiepilogoWidget({ debito, riepilogo, tema = 'light' }) {
  const p = tavolozza(tema);
  const voci = debito && debito.voci;
  const m = riepilogo && riepilogo.mese;
  const perc = m ? percentualeRisparmio(m) : null;
  const ora = (debito && debito.aggiornato) || (riepilogo && riepilogo.aggiornato);
  const vecchio = (debito && debito.vecchio) || (riepilogo && riepilogo.vecchio);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: p.sfondo,
        borderRadius: 16,
        paddingHorizontal: 10,
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
        }}
      >
        <TextWidget
          text={m ? 'RMoney · ' + m.etichetta : 'RMoney'}
          style={{ fontSize: 11, fontWeight: '700', color: p.titolo }}
        />
        <FlexWidget
          style={{ paddingHorizontal: 4, paddingVertical: 2 }}
          clickAction="AGGIORNA"
        >
          <TextWidget
            text={ora ? (vecchio ? '! ' : '') + formattaOra(ora) : 'agg.'}
            style={{ fontSize: 9, color: p.attenuato }}
          />
        </FlexWidget>
      </FlexWidget>

      <FlexWidget
        style={{
          width: 'match_parent',
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Sinistra: il debito condiviso, le due valute separate. */}
        <FlexWidget
          style={{
            flex: 1,
            height: 'match_parent',
            flexDirection: 'column',
            justifyContent: 'center',
            backgroundColor: p.riga,
            borderRadius: 12,
            paddingHorizontal: 9,
            paddingVertical: 6,
            marginTop: 5,
            marginRight: 6,
          }}
        >
          <TextWidget
            text="DEBITO CONDIVISO"
            style={{ fontSize: 8, fontWeight: '700', color: p.attenuato }}
          />
          {voci && voci.length ? (
            voci.map((v) => <RigaDebito key={v.valuta} voce={v} p={p} />)
          ) : (
            <TextWidget
              text="nessun dato"
              style={{ fontSize: 11, color: p.attenuato, marginTop: 4 }}
            />
          )}
        </FlexWidget>

        {/* Destra: la torta del mese con la legenda accanto. */}
        <FlexWidget
          style={{
            flex: 1,
            height: 'match_parent',
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: p.riga,
            borderRadius: 12,
            paddingHorizontal: 9,
            paddingVertical: 6,
            marginTop: 5,
          }}
        >
          {m ? (
            <FlexWidget
              style={{
                width: 62,
                height: 62,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
              }}
            >
              <SvgWidget
                svg={tortaMensile(m, p.pista)}
                style={{ width: 62, height: 62 }}
              />
            </FlexWidget>
          ) : null}

          <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
            {m ? (
              <FlexWidget style={{ flexDirection: 'column' }}>
                <VoceLegenda
                  colore={p.attenuato} etichetta="entrate"
                  valore={m.entrate} simbolo={m.simbolo} p={p}
                />
                <VoceLegenda
                  colore={COLORE_USCITE} etichetta="uscite"
                  valore={m.uscite} simbolo={m.simbolo} p={p}
                />
                <VoceLegenda
                  colore={m.risparmio < 0 ? COLORE_ROSSO : COLORE_RISPARMIO}
                  etichetta={perc === null ? 'risparmio' : 'risparmio ' + perc + '%'}
                  valore={m.risparmio} simbolo={m.simbolo} p={p}
                />
              </FlexWidget>
            ) : (
              <TextWidget
                text="nessun dato"
                style={{ fontSize: 11, color: p.attenuato }}
              />
            )}
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
