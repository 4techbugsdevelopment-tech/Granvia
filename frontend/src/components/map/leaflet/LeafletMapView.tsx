import { useEffect, useRef, useState } from 'react';
import {
  MapContainer, TileLayer, CircleMarker, Popup,
  Circle, Polyline, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { MapViewProps, MapMarker, LatLng } from '../types';

// ── Dot colours ───────────────────────────────────────────────────────────────
const DOT = {
  job:      { fill: '#f97316', stroke: '#ea580c' }, // orange
  guard:    { fill: '#22c55e', stroke: '#16a34a' }, // green
  site:     { fill: '#ef4444', stroke: '#dc2626' },
  employer: { fill: '#a855f7', stroke: '#9333ea' },
  default:  { fill: '#64748b', stroke: '#475569' },
};

function dotColor(type?: string) {
  return DOT[type as keyof typeof DOT] ?? DOT.default;
}

// ── RecenterMap — only fires when values actually change ──────────────────────
function RecenterMap({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map     = useMap();
  const prevRef = useRef<string>('');
  useEffect(() => {
    const key = `${lat},${lng},${zoom}`;
    if (prevRef.current !== key) {
      map.setView([lat, lng], zoom, { animate: true });
      prevRef.current = key;
    }
  });
  return null;
}

// ── Fit bounds when routing ───────────────────────────────────────────────────
function FitRouteBounds({ from, to }: { from: LatLng; to: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(
      L.latLngBounds([from.lat, from.lng], [to.lat, to.lng]),
      { padding: [52, 52] },
    );
  }, [from.lat, from.lng, to.lat, to.lng, map]);
  return null;
}

// ── OSRM route ────────────────────────────────────────────────────────────────
async function fetchRoute(from: LatLng, to: LatLng): Promise<[number, number][]> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
    );
    if (!res.ok) throw new Error();
    const json = await res.json();
    return json.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
    );
  } catch {
    return [[from.lat, from.lng], [to.lat, to.lng]];
  }
}

function openGoogleMaps(from: LatLng, to: LatLng) {
  window.open(
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${from.lat},${from.lng}` +
    `&destination=${to.lat},${to.lng}` +
    `&travelmode=driving`,
    '_blank',
  );
}

function RouteLayer({ from, to }: { from: LatLng; to: LatLng }) {
  const [coords, setCoords] = useState<[number, number][]>([]);
  useEffect(() => {
    setCoords([]);
    fetchRoute(from, to).then(setCoords);
  }, [from.lat, from.lng, to.lat, to.lng]);
  if (!coords.length) return null;
  return (
    <>
      <Polyline positions={coords} pathOptions={{ color: '#0f172a', weight: 6, opacity: 0.15 }} />
      <Polyline positions={coords} pathOptions={{ color: '#1d4ed8', weight: 4, opacity: 0.9 }} />
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LeafletMapView({
  center,
  zoom = 12,
  markers = [],
  radiusKm,
  guardPosition,
  routeTo,
  onMarkerClick,
  className,
  style,
}: MapViewProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      className={className}
      style={{ height: '100%', width: '100%', borderRadius: 'inherit', position: 'relative', zIndex: 0, isolation: 'isolate', ...style }}
      scrollWheelZoom
    >
      <RecenterMap lat={center.lat} lng={center.lng} zoom={zoom} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Radius search circle */}
      {radiusKm && guardPosition && (
        <Circle
          center={[guardPosition.lat, guardPosition.lng]}
          radius={radiusKm * 1000}
          pathOptions={{
            color: '#1d4ed8',
            fillColor: '#bfdbfe',
            fillOpacity: 0.12,
            weight: 2,
          }}
        />
      )}

      {/* Route */}
      {routeTo && guardPosition && (
        <>
          <RouteLayer from={guardPosition} to={routeTo} />
          <FitRouteBounds from={guardPosition} to={routeTo} />
        </>
      )}

      {/* Guard's own location — green dot */}
      {guardPosition && (
        <CircleMarker
          center={[guardPosition.lat, guardPosition.lng]}
          radius={6}
          pathOptions={{
            fillColor: '#22c55e',
            fillOpacity: 1,
            color: '#16a34a',
            weight: 2,
          }}
        >
          <Popup>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#14532d' }}>
              📍 Your Location
            </p>
          </Popup>
        </CircleMarker>
      )}

      {/* Job / site / employer dots */}
      {markers.map((m: MapMarker) => {
        const isSelected =
          !!routeTo &&
          m.position.lat === routeTo.lat &&
          m.position.lng === routeTo.lng;
        const { fill, stroke } = dotColor(m.type);
        return (
          <CircleMarker
            key={m.id}
            center={[m.position.lat, m.position.lng]}
            radius={isSelected ? 8 : 5}
            pathOptions={{
              fillColor: fill,
              fillOpacity: 1,
              color: stroke,
              weight: 2,
            }}
            eventHandlers={{ click: () => onMarkerClick?.(m) }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <p style={{ fontWeight: 700, margin: '0 0 2px', fontSize: 13 }}>{m.title}</p>
                {m.subtitle && (
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: '#64748b' }}>{m.subtitle}</p>
                )}
                {guardPosition && (
                  <button
                    onClick={() => openGoogleMaps(guardPosition, m.position)}
                    style={{
                      display: 'block', width: '100%',
                      padding: '6px 10px',
                      background: '#1d4ed8', color: 'white',
                      border: 'none', borderRadius: 8,
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    🗺️ Get Directions
                  </button>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
