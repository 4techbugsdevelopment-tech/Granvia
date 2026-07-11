import { apiClient } from '../lib/apiClient';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted?: string | null;
}

/**
 * Resolve a free-text Indian address to coordinates via the backend
 * Mappls (MapmyIndia) proxy.
 *
 * - Returns a `GeocodeResult` when the address is found.
 * - Returns `null` when the address simply can't be located (HTTP 404).
 * - Throws for configuration/service failures (503/502/etc.) so callers can
 *   distinguish "wrong address" from "service unavailable".
 */
export async function geocode(address: string): Promise<GeocodeResult | null> {
  const query = address.trim();
  if (!query) return null;

  try {
    const res = await apiClient.get('/geocode', { params: { address: query } });
    if (res.data?.found && typeof res.data.lat === 'number' && typeof res.data.lng === 'number') {
      return { lat: res.data.lat, lng: res.data.lng, formatted: res.data.formatted ?? null };
    }
    return null;
  } catch (err: any) {
    if (err?.response?.status === 404) return null; // address not found
    throw err; // service not configured / upstream error
  }
}

/** Build a single India-scoped address string from the form fields. */
export function buildAddressQuery(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}): string {
  return [parts.address, parts.city, parts.state, parts.pincode, 'India']
    .map(p => (p ?? '').trim())
    .filter(Boolean)
    .join(', ');
}
