// Granvia Partner — Expo WebView wrapper.
//
// This thin native shell simply loads the deployed universal mobile app
// (frontend/src/universal-mobile) at its /app route inside a full-screen
// WebView, then packages it as an Android APK via EAS Build.
//
// The web app already detects APK mode (window.__GRANVIA_APK__) and boots
// straight into the universal app in full-screen — we set that flag before the
// page content loads.
import { useEffect, useRef, useState } from 'react';
import {
  BackHandler, SafeAreaView, StyleSheet, ActivityIndicator, View, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import Constants from 'expo-constants';

// The deployed universal-app URL. Configured in app.json → extra.appUrl.
// For device testing against a local dev server use your machine's LAN IP,
// e.g. http://192.168.1.20:5199/app
const APP_URL: string =
  (Constants.expoConfig?.extra as { appUrl?: string } | undefined)?.appUrl ??
  'https://granvia.netlify.app/app';

// Marks the WebView as the packaged APK so the web app switches to full-screen
// mode and routes to the universal app.
const INJECT_BEFORE_LOAD = `
  window.__GRANVIA_APK__ = true;
  true;
`;

export default function App() {
  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);

  // Android hardware back button navigates WebView history instead of exiting.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBack = () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [canGoBack]);

  const onNav = (nav: WebViewNavigation) => setCanGoBack(nav.canGoBack);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#0f1e3c" />
      <WebView
        ref={webRef}
        source={{ uri: APP_URL }}
        injectedJavaScriptBeforeContentLoaded={INJECT_BEFORE_LOAD}
        onNavigationStateChange={onNav}
        onLoadEnd={() => setLoading(false)}
        originWhitelist={['*']}
        domStorageEnabled
        javaScriptEnabled
        geolocationEnabled
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        style={styles.webview}
      />
      {loading && (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator size="large" color="#8b1a1a" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1e3c' },
  webview: { flex: 1, backgroundColor: '#f1f5f9' },
  loader: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1e3c',
  },
});
