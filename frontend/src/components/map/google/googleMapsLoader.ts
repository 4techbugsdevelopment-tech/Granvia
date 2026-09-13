declare global {
  interface Window { google: any; }
}

import { getGoogleMapsApiKey, googleMapsConfig } from '../../../config/googleMaps';

let googleMapsPromise: Promise<any> | null = null;

export async function loadGoogleMaps(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps requires a browser.'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;

  const apiKey = await getGoogleMapsApiKey();
  if (!apiKey) return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not configured.'));

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-granvia-google-maps]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.maps));
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load.')));
      return;
    }
    const script = document.createElement('script');
    script.src = `${googleMapsConfig.scriptBaseUrl}?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.granviaGoogleMaps = 'true';
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Google Maps failed to load.'));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}
