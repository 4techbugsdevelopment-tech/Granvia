import type { LatLng } from '../components/map/types';

/** Haversine distance in kilometres between two lat/lng points */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** In-memory cache so we never geocode the same address string twice per session */
const _geocodeCache = new Map<string, LatLng | null>();

/**
 * Geocode a free-text address using Nominatim (OpenStreetMap, no API key).
 * Returns LatLng on success, null if the address cannot be resolved.
 * Results are cached in memory for the lifetime of the page.
 */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const key = address.trim().toLowerCase();
  if (!key) return null;
  if (_geocodeCache.has(key)) return _geocodeCache.get(key)!;

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(address)}` +
      `&format=json&limit=1&addressdetails=0`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'GranviaApp/1.0' },
    });
    if (!res.ok) throw new Error('Nominatim error');
    const json = await res.json();
    if (!json.length) { _geocodeCache.set(key, null); return null; }
    const result: LatLng = { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
    _geocodeCache.set(key, result);
    return result;
  } catch {
    _geocodeCache.set(key, null);
    return null;
  }
}

/** Build a single address string from site fields for geocoding */
export function buildSiteAddress(site: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}): string {
  return [site.address, site.city, site.state, site.pincode, 'India']
    .filter(Boolean)
    .join(', ');
}

/**
 * Reverse geocode a lat/lng → address components (Nominatim, no API key).
 * Returns null on error or if nothing is found.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{
  address: string;
  city: string;
  state: string;
  pincode: string;
} | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'GranviaApp/1.0' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const a = json.address ?? {};

    const road    = [a.house_number, a.road].filter(Boolean).join(' ');
    const address = road || a.neighbourhood || a.suburb || a.hamlet || '';
    const city    = a.city || a.town || a.village || a.suburb || a.county || '';
    const state   = a.state || '';
    const pincode = a.postcode || '';

    return { address, city, state, pincode };
  } catch {
    return null;
  }
}

/** Browser geolocation as a promise — resolves with LatLng or null on error/denial */
type NativeBridgeWindow = Window & {
  __GRANVIA_APK__?: boolean;
  ReactNativeWebView?: { postMessage: (message: string) => void };
};

export type LocationFailureReason = 'permission_denied' | 'services_disabled' | 'timeout' | 'unavailable' | 'unsupported';
export type CurrentPositionResult = { position: LatLng | null; error: LocationFailureReason | null };

/** Obtain a fresh fix in the native Android shell; WebView geolocation is unreliable on some builds. */
function requestNativePosition(): Promise<CurrentPositionResult | null> {
  const nativeWindow = window as NativeBridgeWindow;
  if (!nativeWindow.__GRANVIA_APK__ || !nativeWindow.ReactNativeWebView) {
    return Promise.resolve(null);
  }

  return new Promise(resolve => {
    const onResult = (event: Event) => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('granvia-current-position', onResult);
      const detail = (event as CustomEvent<CurrentPositionResult>).detail;
      resolve(detail?.position || detail?.error ? detail : { position: null, error: 'unavailable' });
    };

    const timeoutId = window.setTimeout(() => {
      window.removeEventListener('granvia-current-position', onResult);
      resolve(null);
    }, 25000);

    window.addEventListener('granvia-current-position', onResult);
    nativeWindow.ReactNativeWebView!.postMessage(JSON.stringify({
      type: 'GRANVIA_REQUEST_CURRENT_POSITION',
    }));
  });
}

/** Ask the Android shell to prompt the user and open Location Services settings. */
function requestNativeLocationSettings(): Promise<boolean> {
  const nativeWindow = window as NativeBridgeWindow;
  if (!nativeWindow.__GRANVIA_APK__ || !nativeWindow.ReactNativeWebView) return Promise.resolve(false);

  return new Promise(resolve => {
    const onResult = (event: Event) => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('granvia-location-settings-return', onResult);
      resolve((event as CustomEvent<{ retry?: boolean }>).detail?.retry === true);
    };
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener('granvia-location-settings-return', onResult);
      resolve(false);
    }, 120000);
    window.addEventListener('granvia-location-settings-return', onResult);
    nativeWindow.ReactNativeWebView!.postMessage(JSON.stringify({ type: 'GRANVIA_OPEN_LOCATION_SETTINGS' }));
  });
}

function browserPosition(): Promise<CurrentPositionResult> {
  if (!navigator.geolocation) return Promise.resolve({ position: null, error: 'unsupported' });
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ position: { lat: pos.coords.latitude, lng: pos.coords.longitude }, error: null }),
      error => resolve({
        position: null,
        error: error.code === error.PERMISSION_DENIED
          ? 'permission_denied'
          : error.code === error.TIMEOUT
            ? 'timeout'
            : error.code === error.POSITION_UNAVAILABLE
              ? 'services_disabled'
              : 'unavailable',
      }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  });
}

export async function getCurrentPositionResult(): Promise<CurrentPositionResult> {
  const native = await requestNativePosition();
  if (native?.position) return native;
  if (native?.error === 'permission_denied') return native;
  if (native?.error === 'services_disabled') {
    const retry = await requestNativeLocationSettings();
    if (retry) return (await requestNativePosition()) ?? { position: null, error: 'unavailable' };
    return native;
  }
  if (native) return native;

  const first = await browserPosition();
  if (first.position || (first.error !== 'services_disabled' && first.error !== 'timeout')) return first;

  // A packaged Android WebView reports POSITION_UNAVAILABLE when the device's
  // location service is switched off. Open settings, then retry after return.
  const retry = await requestNativeLocationSettings();
  return retry ? browserPosition() : first;
}

export async function getCurrentPosition(): Promise<LatLng | null> {
  return (await getCurrentPositionResult()).position;
}
