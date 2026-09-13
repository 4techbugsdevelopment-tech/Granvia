import { useEffect, useRef, useState } from 'react';
import type { LatLng, MapMarker, MapViewProps } from '../types';
import { loadGoogleMaps } from './googleMapsLoader';

const DOT = {
  job: { fill: '#f97316', stroke: '#ea580c' }, guard: { fill: '#22c55e', stroke: '#16a34a' },
  site: { fill: '#ef4444', stroke: '#dc2626' }, employer: { fill: '#a855f7', stroke: '#9333ea' },
  default: { fill: '#64748b', stroke: '#475569' },
};
function dotColor(type?: string) { return DOT[type as keyof typeof DOT] ?? DOT.default; }

async function fetchRoute(from: LatLng, to: LatLng): Promise<LatLng[]> {
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`);
    if (!response.ok) throw new Error('Route request failed');
    const json = await response.json();
    return json.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
  } catch { return [from, to]; }
}
function directionsUrl(from: LatLng, to: LatLng) { return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`; }

export default function GoogleMapView({ center, zoom = 12, markers = [], radiusKm, guardPosition, routeTo, onMarkerClick, className, style }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadGoogleMaps().then((maps) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      mapRef.current = new maps.Map(containerRef.current, { center, zoom, mapTypeControl: true, streetViewControl: false, fullscreenControl: true });
    }).catch((loadError: Error) => { if (!cancelled) setError(loadError.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    mapRef.current.panTo(center);
    mapRef.current.setZoom(zoom);
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.google?.maps;
    if (!map || !maps) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
    overlaysRef.current = [];

    if (radiusKm && guardPosition) overlaysRef.current.push(new maps.Circle({ map, center: guardPosition, radius: radiusKm * 1000, strokeColor: '#1d4ed8', strokeOpacity: 0.8, strokeWeight: 2, fillColor: '#bfdbfe', fillOpacity: 0.12 }));
    if (guardPosition) overlaysRef.current.push(new maps.Marker({ map, position: guardPosition, title: 'Your Location', icon: { path: maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#22c55e', fillOpacity: 1, strokeColor: '#16a34a', strokeWeight: 2 } }));

    markers.forEach((marker: MapMarker) => {
      const selected = !!routeTo && marker.position.lat === routeTo.lat && marker.position.lng === routeTo.lng;
      const color = dotColor(marker.type);
      const mapMarker = new maps.Marker({ map, position: marker.position, title: marker.title, icon: { path: maps.SymbolPath.CIRCLE, scale: selected ? 9 : 7, fillColor: color.fill, fillOpacity: 1, strokeColor: color.stroke, strokeWeight: 2 } });
      const infoWindow = new maps.InfoWindow();
      mapMarker.addListener('click', () => {
        onMarkerClick?.(marker);
        const content = document.createElement('div');
        content.style.minWidth = '160px';
        const title = document.createElement('strong'); title.textContent = marker.title; content.appendChild(title);
        if (marker.subtitle) { const subtitle = document.createElement('p'); subtitle.textContent = marker.subtitle; subtitle.style.cssText = 'margin:4px 0 8px;color:#64748b;font-size:11px'; content.appendChild(subtitle); }
        if (guardPosition) { const link = document.createElement('a'); link.href = directionsUrl(guardPosition, marker.position); link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = 'Get Directions'; link.style.cssText = 'display:block;padding:6px 10px;background:#1d4ed8;color:white;border-radius:8px;text-align:center;font-size:11px;font-weight:700;text-decoration:none'; content.appendChild(link); }
        infoWindow.setContent(content); infoWindow.open({ map, anchor: mapMarker });
      });
      overlaysRef.current.push(mapMarker);
    });

    if (routeTo && guardPosition) void fetchRoute(guardPosition, routeTo).then((route) => {
      if (!mapRef.current || !window.google?.maps) return;
      const path = new window.google.maps.Polyline({ path: route, map, strokeColor: '#1d4ed8', strokeOpacity: 0.9, strokeWeight: 4 });
      overlaysRef.current.push(path);
      const bounds = new window.google.maps.LatLngBounds(); route.forEach((point) => bounds.extend(point)); map.fitBounds(bounds, 52);
    });
  }, [markers, radiusKm, guardPosition, routeTo, onMarkerClick]);

  return <div ref={containerRef} className={className} style={{ height: '100%', width: '100%', borderRadius: 'inherit', position: 'relative', zIndex: 0, isolation: 'isolate', ...style }}>{error && <div className="flex h-full items-center justify-center bg-gray-50 p-4 text-center text-xs text-red-700">{error}</div>}</div>;
}

