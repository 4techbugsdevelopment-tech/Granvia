// Provider-agnostic map types.

export type MapProvider = 'google';

export interface LatLng {
  lat: number;
  lng: number;
}

export type MarkerType = 'job' | 'guard' | 'site' | 'employer';

export interface MapMarker {
  id: string;
  position: LatLng;
  title: string;
  subtitle?: string;
  type?: MarkerType;
  data?: unknown;
}

/** Shared props every map implementation must accept */
export interface MapViewProps {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  /** Draw a radius circle around `center` */
  radiusKm?: number;
  /** Guard's real-world position — shown as a green pulse marker */
  guardPosition?: LatLng;
  /** When set, fetch + draw a walking/driving route from guardPosition → routeTo */
  routeTo?: LatLng;
  onMarkerClick?: (marker: MapMarker) => void;
  className?: string;
  style?: React.CSSProperties;
}

/** For click-to-place a single pin (site/location picker) */
export interface LocationPickerProps {
  value: LatLng | null;
  onChange: (latLng: LatLng) => void;
  zoom?: number;
  className?: string;
  style?: React.CSSProperties;
}
