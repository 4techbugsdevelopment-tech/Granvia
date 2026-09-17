import type { LatLng } from '../types';
import { loadGoogleMaps } from './googleMapsLoader';

type SiteAddressResult = {
  address: string;
  city: string;
  state: string;
  pincode: string;
};

function componentValue(components: any[], type: string) {
  return components.find(component => component.types?.includes(type))?.long_name ?? '';
}

function buildAddressLine(components: any[]) {
  const streetNumber = componentValue(components, 'street_number');
  const route = componentValue(components, 'route');
  const premise = componentValue(components, 'premise');
  const sublocality =
    componentValue(components, 'sublocality_level_1') ||
    componentValue(components, 'sublocality');

  return [premise, streetNumber, route, sublocality].filter(Boolean).join(', ');
}

export async function geocodeAddressWithGoogle(address: string): Promise<LatLng | null> {
  const query = address.trim();
  if (!query) return null;

  const maps = await loadGoogleMaps();
  const geocoder = new maps.Geocoder();
  const response = await geocoder.geocode({ address: query, region: 'IN' });
  const location = response.results?.[0]?.geometry?.location;
  return location ? { lat: location.lat(), lng: location.lng() } : null;
}

export async function reverseGeocodeWithGoogle(lat: number, lng: number): Promise<SiteAddressResult | null> {
  const maps = await loadGoogleMaps();
  const geocoder = new maps.Geocoder();
  const response = await geocoder.geocode({ location: { lat, lng } });
  const result = response.results?.[0];
  if (!result) return null;

  const components = result.address_components ?? [];
  const city =
    componentValue(components, 'locality') ||
    componentValue(components, 'administrative_area_level_3') ||
    componentValue(components, 'postal_town');

  return {
    address: buildAddressLine(components) || result.formatted_address || '',
    city,
    state: componentValue(components, 'administrative_area_level_1'),
    pincode: componentValue(components, 'postal_code'),
  };
}
