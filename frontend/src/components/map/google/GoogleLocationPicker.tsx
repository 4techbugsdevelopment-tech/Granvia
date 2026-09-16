import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLng, LocationPickerProps } from '../types';
import { loadGoogleMaps } from './googleMapsLoader';
import { getCurrentPositionResult, type LocationFailureReason } from '../../../lib/geoUtils';

const INDIA_CENTER: LatLng = { lat: 20.5937, lng: 78.9629 };

export default function GoogleLocationPicker({ value, onChange, zoom = 5, className, style }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null); const mapRef = useRef<any>(null); const markerRef = useRef<any>(null);
  const skipRecenterRef = useRef(false); const autoLocateAttempted = useRef(false);
  const [locating, setLocating] = useState(false); const [locationError, setLocationError] = useState<LocationFailureReason | null>(null); const [mapError, setMapError] = useState('');
  const locate = useCallback(async () => { setLocating(true); setLocationError(null); const result = await getCurrentPositionResult(); if (result.position) onChange(result.position); else setLocationError(result.error); setLocating(false); }, [onChange]);
  useEffect(() => { if (!value && !autoLocateAttempted.current) { autoLocateAttempted.current = true; void locate(); } }, [value, locate]);

  useEffect(() => {
    let cancelled = false;
    void loadGoogleMaps().then((maps) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const initial = value ?? INDIA_CENTER;
      const map = new maps.Map(containerRef.current, { center: initial, zoom: value ? 15 : zoom, streetViewControl: false, mapTypeControl: true, fullscreenControl: true });
      mapRef.current = map;
      map.addListener('click', (event: any) => { if (event.latLng) onChange({ lat: event.latLng.lat(), lng: event.latLng.lng() }); });
    }).catch((loadError: Error) => { if (!cancelled) setMapError(loadError.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const map = mapRef.current; const maps = window.google?.maps; if (!map || !maps) return;
    if (value) {
      if (!markerRef.current) {
        markerRef.current = new maps.Marker({ map, position: value, draggable: true, icon: { path: maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 7, fillColor: '#e53e3e', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 } });
        markerRef.current.addListener('dragstart', () => { skipRecenterRef.current = true; });
        markerRef.current.addListener('dragend', () => { const position = markerRef.current.getPosition(); if (position) { skipRecenterRef.current = true; onChange({ lat: position.lat(), lng: position.lng() }); } });
      } else markerRef.current.setPosition(value);
      if (!skipRecenterRef.current) { map.panTo(value); map.setZoom(Math.max(map.getZoom() ?? zoom, 15)); }
      skipRecenterRef.current = false;
    } else if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; }
  }, [value?.lat, value?.lng, onChange, zoom]);

  const errorMessage = locationError === 'permission_denied' ? 'Allow location permission to use your current position.' : locationError === 'services_disabled' ? 'Turn on Location/GPS, then tap Current location.' : locationError === 'timeout' ? 'Location timed out. Move to an open area and retry.' : locationError ? 'Current location is unavailable. Please retry.' : '';
  return <div className="granvia-map relative h-full w-full isolate" style={{ zIndex: 0 }}><div ref={containerRef} className={className} style={{ height: '100%', width: '100%', borderRadius: 'inherit', cursor: 'crosshair', position: 'relative', zIndex: 0, ...style }} />{mapError && <div className="absolute inset-0 flex items-center justify-center bg-gray-50 p-4 text-center text-xs text-red-700">{mapError}</div>}<button type="button" disabled={locating} onClick={() => void locate()} className="absolute right-3 top-3 z-10 rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow-md disabled:opacity-60">{locating ? 'Locating...' : 'Current location'}</button>{errorMessage && <div className="absolute bottom-3 left-3 right-3 z-10 rounded-lg bg-amber-50/95 px-3 py-2 text-xs font-medium text-amber-800 shadow">{errorMessage}</div>}</div>;
}

