import { API_BASE_URL } from '../lib/apiClient';

export const googleMapsConfig = {
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  scriptBaseUrl: 'https://maps.googleapis.com/maps/api/js',
};

export function hasGoogleMapsApiKey() {
  return googleMapsConfig.apiKey.trim().length > 0;
}

let backendApiKeyPromise: Promise<string> | null = null;

function buildPublicConfigUrl() {
  return `${API_BASE_URL.replace(/\/+$/, '')}/config/public`;
}

export async function getGoogleMapsApiKey() {
  const configuredKey = googleMapsConfig.apiKey.trim();
  if (configuredKey) return configuredKey;

  if (!backendApiKeyPromise) {
    backendApiKeyPromise = fetch(buildPublicConfigUrl(), {
      headers: { Accept: 'application/json' },
    })
      .then((response) => {
        if (!response.ok) return '';
        return response.json();
      })
      .then((data) => typeof data?.google_maps_api_key === 'string' ? data.google_maps_api_key.trim() : '')
      .catch(() => '');
  }

  return backendApiKeyPromise;
}
