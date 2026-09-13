/**
 * Provider-agnostic location picker (click map → drop pin → get LatLng).
 *
 * Google Maps implementation for click-to-place and draggable site pins.
 */
import type { LocationPickerProps } from './types';
import GoogleLocationPicker from './google/GoogleLocationPicker';

export default function LocationPicker(props: LocationPickerProps) {
  return <GoogleLocationPicker {...props} />;
}
