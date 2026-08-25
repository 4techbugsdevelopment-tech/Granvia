import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LocationPickerProps, LatLng } from '../types';
import { getCurrentPositionResult, type LocationFailureReason } from '../../../lib/geoUtils';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/** Vivid red/orange teardrop so the draggable pin stands out clearly */
function pickerIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="32" height="48">
    <path d="M16 1C9.4 1 4 6.4 4 13c0 9 12 22 12 22s12-13 12-22C28 6.4 22.6 1 16 1z"
          fill="#e53e3e" stroke="white" stroke-width="2"/>
    <circle cx="16" cy="13" r="5" fill="white"/>
    <circle cx="16" cy="13" r="2.5" fill="#e53e3e"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 48],
    iconAnchor: [16, 48],
    popupAnchor: [0, -48],
  });
}

function ClickHandler({ onChange }: { onChange: (pos: LatLng) => void }) {
  useMapEvents({
    click(e) { onChange({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return null;
}

/**
 * Recenter the map when value changes programmatically.
 * skipRef is set to true just before a drag-triggered onChange so we don't
 * snap the view back unnecessarily after the user drags.
 */
function RecenterOnValue({
  value,
  skipRef,
}: {
  value: LatLng | null;
  skipRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  useEffect(() => {
    if (value && !skipRef.current) {
      map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15), { animate: true });
    }
    skipRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);
  return null;
}

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

export default function LeafletLocationPicker({
  value,
  onChange,
  zoom = 5,
  className,
  style,
}: LocationPickerProps) {
  /** Set to true before a drag-triggered onChange to suppress map recentering */
  const skipRecenterRef = useRef(false);
  const autoLocateAttempted = useRef(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<LocationFailureReason | null>(null);

  const locate = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    const result = await getCurrentPositionResult();
    if (result.position) onChange(result.position);
    else setLocationError(result.error);
    setLocating(false);
  }, [onChange]);

  useEffect(() => {
    if (value || autoLocateAttempted.current) return;
    autoLocateAttempted.current = true;
    void locate();
  }, [value, locate]);

  const errorMessage = locationError === 'permission_denied'
    ? 'Allow location permission to use your current position.'
    : locationError === 'services_disabled'
      ? 'Turn on Location/GPS, then tap Current location.'
      : locationError === 'timeout'
        ? 'Location timed out. Move to an open area and retry.'
        : locationError ? 'Current location is unavailable. Please retry.' : '';

  return (
    <div className="granvia-map relative h-full w-full isolate" style={{ zIndex: 0 }}>
      <MapContainer
      center={value ? [value.lat, value.lng] : INDIA_CENTER}
      zoom={value ? 15 : zoom}
      className={className}
      style={{ height: '100%', width: '100%', borderRadius: 'inherit', cursor: 'crosshair', position: 'relative', zIndex: 0, ...style }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onChange={onChange} />
      <RecenterOnValue value={value} skipRef={skipRecenterRef} />

      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={pickerIcon()}
          draggable={true}
          eventHandlers={{
            dragstart: () => {
              // Prevent map from recentering while/after the user drags
              skipRecenterRef.current = true;
            },
            dragend: (e) => {
              const pos = (e.target as L.Marker).getLatLng();
              skipRecenterRef.current = true;
              onChange({ lat: pos.lat, lng: pos.lng });
            },
          }}
        />
      )}
      </MapContainer>
      <button
        type="button"
        disabled={locating}
        onClick={() => void locate()}
        className="absolute right-3 top-3 z-10 rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow-md disabled:opacity-60"
      >
        {locating ? 'Locating...' : 'Current location'}
      </button>
      {errorMessage && (
        <div className="absolute bottom-3 left-3 right-3 z-10 rounded-lg bg-amber-50/95 px-3 py-2 text-xs font-medium text-amber-800 shadow">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
