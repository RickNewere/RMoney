import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView, View, StyleSheet, ActivityIndicator,
  StatusBar, useColorScheme, AppState,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { aggiornaWidget } from './widgets/aggiorna';
import { registraAttivitaPeriodica } from './widgets/attivitaPeriodica';

// The Android app is a thin shell around the live web app, so both clients
// stay identical and future web updates require no APK rebuild.
const SITE_URL = 'https://ricknewere.github.io/RMoney/';

// Runs inside the WebView. Wraps fetch so that a successful POST to the Apps
// Script endpoint (a new expense, a delete, a settle) reports back to the app.
// Android's own widget refresh is capped at once every 30 minutes and is best
// effort on top of that, so without this the widget would keep showing the old
// balance right after the user changed it.
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
    try { window.ReactNativeWebView.postMessage(msg); avvisa('inviato ' + msg); }
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
      return res;
    });
  };
  avvisa('installata, fetch avvolta');
  manda('spia-pronta');
})();
true;
`;

export default function App() {
  const scheme = useColorScheme();
  const bg = scheme === 'dark' ? '#0f1115' : '#f2f4f7';
  const webRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(function () {
    registraAttivitaPeriodica();
  }, []);

  useEffect(function () {
    // All'avvio, e ogni volta che l'app viene lasciata: se l'utente ha appena
    // inserito una spesa e torna alla home, il widget e' gia' aggiornato.
    aggiornaWidget('avvio');
    const sub = AppState.addEventListener('change', function (stato) {
      console.log('[RMoney] AppState -> ' + stato);
      if (stato === 'background' || stato === 'inactive') aggiornaWidget('uscita');
    });
    return function () { sub.remove(); };
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
          const msg = e.nativeEvent.data;
          console.log('[RMoney] messaggio dalla pagina: ' + msg);
          if (msg === 'foglio-cambiato') aggiornaWidget('scrittura sul foglio');
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
