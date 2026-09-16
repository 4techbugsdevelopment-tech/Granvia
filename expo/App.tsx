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
import * as Location from 'expo-location';

// The deployed universal-app URL. Configured in app.json → extra.appUrl.
// For device testing against a local dev server use your machine's LAN IP,
// e.g. http://192.168.1.20:5199/app
const APP_URL: string =
  process.env.EXPO_PUBLIC_APP_URL ??
  (Constants.expoConfig?.extra as { appUrl?: string } | undefined)?.appUrl ??
  'https://granvia.netlify.app/universal-app';

const APP_ORIGIN = (() => {
  try {
    return new URL(APP_URL).origin;
  } catch {
    return 'https://granvia.llc';
  }
})();

const LOCATION_PERMISSION_COPY =
  'Granvia needs your location to show nearby jobs, routes and attendance location.';

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
  const waitingForAppSettings = useRef(false);
  const locationSettingsWasBackgrounded = useRef(false);
  const appSettingsWasBackgrounded = useRef(false);
  const locationRequestInFlight = useRef(false);
  const currentWebOrigin = useRef(APP_ORIGIN);

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

  const onNav = (nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    try {
      currentWebOrigin.current = new URL(nav.url).origin;
    } catch {
      currentWebOrigin.current = APP_ORIGIN;
    }
  };

  const sendCurrentPositionResult = (result: {
    position: { lat: number; lng: number } | null;
    error: 'permission_denied' | 'permission_permanently_denied' | 'services_disabled' | 'timeout' | 'unavailable' | null;
  }) => {
    webRef.current?.injectJavaScript(`
      window.dispatchEvent(new CustomEvent('granvia-current-position', {
        detail: ${JSON.stringify(result)}
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

  const isTrustedWebOrigin = () => currentWebOrigin.current === APP_ORIGIN;

  const checkLocationPermission = async () => {
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    return (await PermissionsAndroid.check(fine)) || (await PermissionsAndroid.check(coarse));
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        if (waitingForLocationSettings.current) locationSettingsWasBackgrounded.current = true;
        if (waitingForAppSettings.current) appSettingsWasBackgrounded.current = true;
        return;
      }

      if (state === 'active' && locationSettingsWasBackgrounded.current) {
        waitingForLocationSettings.current = false;
        locationSettingsWasBackgrounded.current = false;
        sendLocationSettingsResult(true);
        void requestCurrentPosition();
      }

      if (state === 'active' && appSettingsWasBackgrounded.current) {
        waitingForAppSettings.current = false;
        appSettingsWasBackgrounded.current = false;
        void requestCurrentPosition();
      }
    });
    return () => subscription.remove();
  }, []);

  const openAppSettings = () => {
    Alert.alert(
      'Location permission is disabled for Granvia',
      'Enable Location permission from App Settings to use nearby jobs, maps and attendance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            waitingForAppSettings.current = true;
            appSettingsWasBackgrounded.current = false;
            void Linking.openSettings();
          },
        },
      ],
    );
  };

  const requestForegroundLocationPermission = async () => {
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

    if (await checkLocationPermission()) return 'granted';

    const results = await PermissionsAndroid.requestMultiple([fine, coarse]);
    if (
      results[fine] === PermissionsAndroid.RESULTS.GRANTED ||
      results[coarse] === PermissionsAndroid.RESULTS.GRANTED
    ) {
      return 'granted';
    }

    if (
      results[fine] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
      results[coarse] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    ) {
      return 'permanently_denied';
    }

    return 'denied';
  };

  // Fetch the coordinate in the native layer. Runtime permission alone is not
  // enough because Android WebView can report POSITION_UNAVAILABLE even when
  // GPS is enabled.
  const requestCurrentPosition = async () => {
    if (locationRequestInFlight.current) return;
    locationRequestInFlight.current = true;

    if (Platform.OS !== 'android') {
      sendCurrentPositionResult({ position: null, error: 'unavailable' });
      locationRequestInFlight.current = false;
      return;
    }

    try {
      const permission = await requestForegroundLocationPermission();
      if (permission === 'permanently_denied') {
        sendCurrentPositionResult({ position: null, error: 'permission_permanently_denied' });
        openAppSettings();
        return;
      }

      if (permission === 'denied') {
        sendCurrentPositionResult({ position: null, error: 'permission_denied' });
        return;
      }

      if (!(await Location.hasServicesEnabledAsync())) {
        sendCurrentPositionResult({ position: null, error: 'services_disabled' });
        return;
      }

      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      sendCurrentPositionResult({
        position: { lat: fix.coords.latitude, lng: fix.coords.longitude },
        error: null,
      });
    } catch {
      sendCurrentPositionResult({ position: null, error: 'unavailable' });
    } finally {
      locationRequestInFlight.current = false;
    }
  };

  const openLocationSettings = () => {
    Alert.alert(
      'Location is turned off',
      LOCATION_PERMISSION_COPY,
      [
        { text: 'Not Now', style: 'cancel', onPress: () => sendLocationSettingsResult(false) },
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
    if (!isTrustedWebOrigin()) return;

    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string };
      if (message.type === 'GRANVIA_REQUEST_CURRENT_POSITION') {
        void requestCurrentPosition();
      } else if (message.type === 'GRANVIA_OPEN_LOCATION_SETTINGS') {
        openLocationSettings();
      } else if (message.type === 'GRANVIA_OPEN_APP_SETTINGS') {
        openAppSettings();
      }
    } catch {
      // Ignore messages that are not part of the native bridge.
    }
  };

  const shouldStartLoad = (request: { url: string }) => {
    try {
      const url = new URL(request.url);
      if (url.origin === APP_ORIGIN || request.url === 'about:blank') return true;
    } catch {
      if (request.url === 'about:blank') return true;
    }

    void Linking.openURL(request.url);
    return false;
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
        onShouldStartLoadWithRequest={shouldStartLoad}
        onMessage={onMessage}
        onLoadEnd={() => setLoading(false)}
        originWhitelist={[APP_ORIGIN]}
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
