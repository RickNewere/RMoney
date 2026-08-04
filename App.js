import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView, View, StyleSheet, ActivityIndicator,
  StatusBar, useColorScheme, AppState,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { aggiornaWidget, aggiornaConDati } from './widgets/aggiorna';
import { registraAttivitaPeriodica } from './widgets/attivitaPeriodica';
import { chiediEsenzioneBatteria } from './widgets/esenzioneBatteria';

// The Android app is a thin shell around the live web app, so both clients
// stay identical and future web updates require no APK rebuild.
const SITE_URL = 'https://ricknewere.github.io/RMoney/';

// Runs inside the WebView. Wraps fetch and reports two things to the app:
//
//  - una POST andata a buon fine (spesa, cancellazione, saldato): il widget si
//    aggiorna subito invece di aspettare il giro periodico.
//  - i totali del debito appena letti dalla pagina.
//
// Il secondo serve a non fare due volte la stessa lettura. Il widget e la
// pagina chiedono lo stesso dato nello stesso momento all'avvio, e Apps Script
// serializza le richieste: si accodavano e si abortivano a vicenda (nel log del
// telefono, due tentativi di fila finiti in "Aborted"). Se la pagina l'ha gia'
// letto, il widget usa quello e non chiede niente.
const SPIA_SCRITTURE = `
(function () {
  if (window.__rmoneySpia) return;
  window.__rmoneySpia = true;
  function avvisa(testo) {
    // console.log finisce in logcat come messaggio chromium: e' l'unico modo
    // di vedere cosa succede dentro la WebView in una build release.
    try { console.log('[RMoneySpia] ' + testo); } catch (e) {}
  }
  function manda(msg) {
    try { window.ReactNativeWebView.postMessage(msg); avvisa('inviato ' + msg.slice(0, 40)); }
    catch (e) { avvisa('postMessage fallito: ' + e); }
  }
  var originale = window.fetch;
  window.fetch = function (risorsa, opzioni) {
    var url = typeof risorsa === 'string' ? risorsa : (risorsa && risorsa.url) || '';
    var metodo = ((opzioni && opzioni.method) || 'GET').toUpperCase();
    return originale.apply(this, arguments).then(function (res) {
      if (metodo === 'POST' && url.indexOf('/exec') > 0) {
        avvisa('POST intercettata, ok=' + res.ok);
        if (res.ok) manda('foglio-cambiato');
      }
      if (metodo === 'GET' && res.ok && url.indexOf('action=debiti') > 0) {
        // clone(): il corpo si legge una volta sola, e quello vero deve
        // restare intatto per la pagina.
        res.clone().json().then(function (j) {
          if (j && j.fogli) manda('debiti:' + JSON.stringify(j.fogli));
        }).catch(function () {});
      }
      return res;
    });
  };
  avvisa('installata, fetch avvolta');
  manda('spia-pronta');
})();
true;
`;

// Quanto il widget aspetta i dati dalla pagina, all'avvio, prima di andarseli a
// prendere da solo. La pagina li chiede comunque: partire insieme a lei
// significa solo mettersi in coda dietro le sue richieste.
//
// Generoso apposta. Alla pagina serve caricarsi e poi fare la lettura, e con
// 15 s consegnava appena in ritardo: il widget partiva lo stesso e la richiesta
// in piu' era proprio quella da evitare. Aspettare non si vede, perche' il
// widget ha gia' disegnato dalla cache; quello che si vede e' un aggiornamento
// mancato, ed e' l'unico caso in cui questo tempo conta.
const ATTESA_DATI_PAGINA_MS = 35000;

export default function App() {
  const scheme = useColorScheme();
  const bg = scheme === 'dark' ? '#0f1115' : '#f2f4f7';
  const webRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(function () {
    registraAttivitaPeriodica();
    // Dopo qualche secondo, per non sovrapporre un dialogo all'apertura.
    const t = setTimeout(chiediEsenzioneBatteria, 4000);
    return function () { clearTimeout(t); };
  }, []);

  // true appena la pagina ha passato i totali: da quel momento il widget non
  // deve piu' andarseli a prendere da solo.
  const arrivatiDallaPagina = useRef(false);

  useEffect(function () {
    // All'avvio la lettura la fa la PAGINA, non il widget: e' la stessa
    // richiesta, e farla in due vuol dire metterle in coda (Apps Script
    // serializza, e il widget veniva abortito due volte di fila).
    // Il widget non disegna niente nell'attesa, perche' non conserva nessun
    // valore da rimettere a schermo: quello che si vede sulla home resta
    // l'ultimo disegno fatto, finche' non ne arriva uno nuovo.
    const attesa = setTimeout(function () {
      if (arrivatiDallaPagina.current) return;
      console.log('[RMoney] la pagina non ha dato i totali, li leggo io');
      aggiornaWidget('avvio');
    }, ATTESA_DATI_PAGINA_MS);

    const sub = AppState.addEventListener('change', function (stato) {
      console.log('[RMoney] AppState -> ' + stato);
      // All'uscita la pagina non sta piu' leggendo niente, quindi qui la
      // richiesta la fa il widget senza rischio di accodarsi.
      if (stato === 'background' || stato === 'inactive') aggiornaWidget('uscita');
    });
    return function () { clearTimeout(attesa); sub.remove(); };
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={bg}
      />
      <WebView
        ref={webRef}
        source={{ uri: SITE_URL }}
        style={{ flex: 1, backgroundColor: bg }}
        originWhitelist={['*']}
        pullToRefreshEnabled
        onLoadEnd={() => setLoading(false)}
        startInLoadingState={false}
        // Due iniezioni apposta: quella "before" mette la spia prima che la
        // pagina esegua il proprio script, l'altra la rimette dopo un eventuale
        // ricaricamento. La guardia __rmoneySpia rende la seconda innocua.
        injectedJavaScriptBeforeContentLoaded={SPIA_SCRITTURE}
        injectedJavaScript={SPIA_SCRITTURE}
        onMessage={(e) => {
          const msg = e.nativeEvent.data || '';
          if (msg.indexOf('debiti:') === 0) {
            console.log('[RMoney] totali ricevuti dalla pagina');
            arrivatiDallaPagina.current = true;
            try {
              aggiornaConDati(JSON.parse(msg.slice(7)), 'pagina');
            } catch (err) {
              console.log('[RMoney] totali dalla pagina illeggibili: ' + err);
            }
            return;
          }
          console.log('[RMoney] messaggio dalla pagina: ' + msg);
          if (msg === 'foglio-cambiato') {
            // Dopo una scrittura la pagina rilegge i totali da sola e ce li
            // ripassa da qui: si aspetta quelli invece di chiederli anche noi.
            arrivatiDallaPagina.current = false;
          }
        }}
      />
      {loading && (
        <View style={[styles.loader, { backgroundColor: bg }]}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
