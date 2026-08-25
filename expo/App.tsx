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
  PermissionsAndroid, Alert, AppState, Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  WebView,
  type WebViewNavigation,
} from 'react-native-webview';
import Constants from 'expo-constants';

// The deployed universal-app URL. Configured in app.json → extra.appUrl.
// For device testing against a local dev server use your machine's LAN IP,
// e.g. http://192.168.1.20:5199/app
const APP_URL: string =
  process.env.EXPO_PUBLIC_APP_URL ??
  (Constants.expoConfig?.extra as { appUrl?: string } | undefined)?.appUrl ??
  'https://granvia.netlify.app/universal-app';

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
  const waitingForLocationSettings = useRef(false);
  const locationSettingsWasBackgrounded = useRef(false);

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

  const sendLocationPermissionResult = (granted: boolean) => {
    webRef.current?.injectJavaScript(`
      window.dispatchEvent(new CustomEvent('granvia-location-permission', {
        detail: ${JSON.stringify({ granted })}
      }));
      true;
    `);
  };

  const sendLocationSettingsResult = (retry: boolean) => {
    webRef.current?.injectJavaScript(`
      window.dispatchEvent(new CustomEvent('granvia-location-settings-return', {
        detail: ${JSON.stringify({ retry })}
      }));
      true;
    `);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (!waitingForLocationSettings.current) return;
      if (state !== 'active') locationSettingsWasBackgrounded.current = true;
      if (state === 'active' && locationSettingsWasBackgrounded.current) {
        waitingForLocationSettings.current = false;
        locationSettingsWasBackgrounded.current = false;
        sendLocationSettingsResult(true);
      }
    });
    return () => subscription.remove();
  }, []);

  // Android WebViews do not reliably surface the system location prompt on
  // their own. The map asks the native shell to request runtime permission,
  // then retries browser geolocation as soon as this result is dispatched.
  const requestLocationPermission = async () => {
    if (Platform.OS !== 'android') {
      sendLocationPermissionResult(true);
      return;
    }

    try {
      const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
      const alreadyGranted =
        (await PermissionsAndroid.check(fine)) ||
        (await PermissionsAndroid.check(coarse));

      if (alreadyGranted) {
        sendLocationPermissionResult(true);
        return;
      }

      const results = await PermissionsAndroid.requestMultiple([fine, coarse]);
      const granted =
        results[fine] === PermissionsAndroid.RESULTS.GRANTED ||
        results[coarse] === PermissionsAndroid.RESULTS.GRANTED;
      sendLocationPermissionResult(granted);
      if (!granted && (results[fine] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN || results[coarse] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) {
        Alert.alert('Location permission required', 'Enable location permission for Granvia in App Settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ]);
      }
    } catch {
      sendLocationPermissionResult(false);
    }
  };

  const openLocationSettings = () => {
    Alert.alert(
      'Enable location services',
      'Granvia needs your live location. Turn on Location/GPS, then return to the app.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => sendLocationSettingsResult(false) },
        {
          text: 'Enable Location',
          onPress: async () => {
            try {
              waitingForLocationSettings.current = true;
              locationSettingsWasBackgrounded.current = false;
              await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
            } catch {
              waitingForLocationSettings.current = false;
              sendLocationSettingsResult(false);
            }
          },
        },
      ],
      { cancelable: false },
    );
  };

  const onMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string };
      if (message.type === 'GRANVIA_REQUEST_LOCATION') {
        void requestLocationPermission();
      } else if (message.type === 'GRANVIA_OPEN_LOCATION_SETTINGS') {
        openLocationSettings();
      }
    } catch {
      // Ignore messages that are not part of the native bridge.
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        Platform.OS === 'android' && { paddingTop: Constants.statusBarHeight },
      ]}
    >
      <StatusBar style="light" backgroundColor="#0f1e3c" translucent />
      <WebView
        ref={webRef}
        source={{ uri: APP_URL }}
        injectedJavaScriptBeforeContentLoaded={INJECT_BEFORE_LOAD}
        onNavigationStateChange={onNav}
        onMessage={onMessage}
        onLoadEnd={() => setLoading(false)}
        originWhitelist={['*']}
        domStorageEnabled
        javaScriptEnabled
        geolocationEnabled
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        overScrollMode="never"
        bounces={false}
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
