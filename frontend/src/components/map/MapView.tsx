/**
 * Provider-agnostic map view.
 *
 * Consumers remain provider-agnostic while Google Maps is the active provider.
 */
import type { MapViewProps } from './types';
import GoogleMapView from './google/GoogleMapView';

const provider = import.meta.env.VITE_MAP_PROVIDER ?? 'google';

export default function MapView(props: MapViewProps) {
  if (provider !== 'google') console.warn('VITE_MAP_PROVIDER is no longer supported; using Google Maps.');
  return <GoogleMapView {...props} />;
}
