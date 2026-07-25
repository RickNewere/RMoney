import React, { useRef, useState } from 'react';
import {
  SafeAreaView, View, StyleSheet, ActivityIndicator,
  StatusBar, useColorScheme,
} from 'react-native';
import { WebView } from 'react-native-webview';

// The Android app is a thin shell around the live web app, so both clients
// stay identical and future web updates require no APK rebuild.
const SITE_URL = 'https://ricknewere.github.io/RMoney/';

export default function App() {
  const scheme = useColorScheme();
  const bg = scheme === 'dark' ? '#0f1115' : '#f2f4f7';
  const webRef = useRef(null);
  const [loading, setLoading] = useState(true);

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
