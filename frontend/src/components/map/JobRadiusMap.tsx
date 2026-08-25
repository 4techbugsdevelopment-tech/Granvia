/**
 * Guard mobile: shows ALL active job pins on a map.
 * Jobs with lat/lng → pinned immediately.
 * Jobs with only address fields → geocoded via Nominatim, then pinned.
 * Guard's position = green pulse dot.
 * Job pins = orange briefcase teardrop.
 * Selected job = highlighted larger pin + blue route line.
 */
import { useState, useEffect, useCallback } from 'react';
import { MapPin, AlertCircle, Navigation, Briefcase, Loader } from 'lucide-react';
import MapView from './MapView';
import { distanceKm, getCurrentPositionResult, geocodeAddress, buildSiteAddress, type LocationFailureReason } from '../../lib/geoUtils';
import type { LatLng, MapMarker } from './types';

export interface MappableJob {
  id: string;
  title: string;
  company: string;
  location?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  // Address fields used for geocoding when lat/lng are absent
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

interface Props {
  jobs: MappableJob[];
  radiusKm: number;
  selectedJobId?: string | null;
  onJobClick?: (jobId: string) => void;
  mapHeight?: number | string;
}

const INDIA_DEFAULT: LatLng = { lat: 19.076, lng: 72.877 };

export default function JobRadiusMap({
  jobs,
  radiusKm,
  selectedJobId,
  onJobClick,
  mapHeight = 300,
}: Props) {
  const [guardPos, setGuardPos]       = useState<LatLng | null>(null);
  const [locating, setLocating]       = useState(true);
  const [denied, setDenied]           = useState(false);
  const [locationError, setLocationError] = useState<LocationFailureReason | null>(null);
  // markers built from coords + geocoded addresses
  const [markers, setMarkers]         = useState<MapMarker[]>([]);
  const [geocoding, setGeocoding]     = useState(false);

  // 1. Get guard location
  const locate = useCallback(async () => {
    setLocating(true);
    setDenied(false);
    const result = await getCurrentPositionResult();
    setGuardPos(result.position);
    setLocationError(result.error);
    setDenied(!result.position);
    setLocating(false);
  }, []);

  useEffect(() => { void locate(); }, [locate]);

  // Stable key: only re-run when the set of job IDs actually changes
  const jobsKey = jobs.map(j => j.id).join(',');

  // 2. Build markers — immediate from lat/lng, then geocode the rest
  useEffect(() => {
    if (!jobs.length) { setMarkers([]); return; }

    const immediate: MapMarker[] = [];
    const needsGeocode: MappableJob[] = [];

    for (const j of jobs) {
      const lat = j.latitude != null ? Number(j.latitude) : NaN;
      const lng = j.longitude != null ? Number(j.longitude) : NaN;

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        immediate.push({
          id: j.id,
          position: { lat, lng },
          title: j.title,
          subtitle: j.company + (j.location ? ` · ${j.location}` : ''),
          type: 'job',
          data: j,
        });
      } else {
        needsGeocode.push(j);
      }
    }

    setMarkers(immediate);
    if (!needsGeocode.length) return;

    setGeocoding(true);
    let cancelled = false;

    (async () => {
      const geocoded: MapMarker[] = [];

      for (const j of needsGeocode) {
        if (cancelled) break;
        const addrStr = buildSiteAddress({
          address: j.address,
          city: j.city,
          state: j.state,
          pincode: j.pincode,
        });
        // Build a list of queries to try, most-specific first
        const queries: string[] = [];
        const stripped = addrStr.replace(/,?\s*India\s*$/i, '').trim();
        if (stripped) queries.push(addrStr);                          // full address
        if (j.location) queries.push(`${j.location}, India`);        // site name
        if (j.company)  queries.push(`${j.company}, India`);         // company name

        let pos = null;
        for (const q of queries) {
          pos = await geocodeAddress(q);
          if (pos) break;
        }
        if (!pos || cancelled) continue;
        geocoded.push({
          id: j.id,
          position: pos,
          title: j.title,
          subtitle: j.company + (j.location ? ` · ${j.location}` : ''),
          type: 'job',
          data: j,
        });
      }

      if (!cancelled) {
        setMarkers(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          return [...prev, ...geocoded.filter(m => !existingIds.has(m.id))];
        });
        setGeocoding(false);
      }
    })();

    return () => { cancelled = true; };
  }, [jobsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedMarker = selectedJobId
    ? markers.find(m => m.id === selectedJobId) ?? null
    : null;

  // Only show pins for jobs within the selected radius.
  // If guard pos is unknown, show all (can't filter without a reference point).
  // Always keep the selected job's pin visible even if it's outside the radius
  // so the user can still see its route/details after tapping a card.
  const visibleMarkers = guardPos
    ? markers.filter(m =>
        distanceKm(guardPos, m.position) <= radiusKm ||
        m.id === selectedJobId
      )
    : markers;



  const withinRadiusCount = guardPos
    ? markers.filter(m => distanceKm(guardPos, m.position) <= radiusKm).length
    : markers.length;

  const center =
    selectedMarker?.position ??
    guardPos ??
    (visibleMarkers[0]?.position ?? INDIA_DEFAULT);

  const routeTo = selectedMarker && guardPos ? selectedMarker.position : undefined;

  if (locating) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-2xl" style={{ height: mapHeight }}>
        <div className="text-center text-gray-400">
          <MapPin size={24} className="mx-auto mb-2 animate-pulse" />
          <p className="text-xs">Getting your location…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex items-center gap-4 px-1 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block ring-2 ring-green-200" />
          Your location
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full bg-orange-400 inline-block ring-2 ring-orange-100" />
          Job location
        </span>
        {geocoding && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Loader size={10} className="animate-spin" />
            Locating jobs…
          </span>
        )}
        {selectedMarker && guardPos && (
          <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
            <span className="w-3 h-1 bg-blue-500 inline-block rounded-full" />
            Route shown
          </span>
        )}
      </div>

      {denied && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs">
          <AlertCircle size={13} />
          Location access denied — routing unavailable. Enable location to see routes.
          <button title={locationError ?? undefined} onClick={() => void locate()} className="ml-auto rounded-lg bg-amber-100 px-2.5 py-1 font-bold text-amber-900">Retry</button>
        </div>
      )}

      {selectedMarker && guardPos && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-medium">
          <Navigation size={13} className="flex-shrink-0" />
          Route to&nbsp;<span className="font-bold truncate">{selectedMarker.title}</span>
          &nbsp;— tap the pin for Google Maps
        </div>
      )}
      {selectedMarker && !guardPos && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs">
          <AlertCircle size={13} />
          Enable location to see a route to this job.
        </div>
      )}

      <div className="granvia-map rounded-2xl overflow-hidden border border-gray-100" style={{ height: mapHeight, position: 'relative', zIndex: 0 }}>
        <MapView
          center={center}
          zoom={selectedMarker ? 14 : guardPos ? 12 : 10}
          markers={visibleMarkers}
          radiusKm={guardPos ? radiusKm : undefined}
          guardPosition={guardPos ?? undefined}
          routeTo={routeTo}
          onMarkerClick={m => onJobClick?.(m.id)}
        />
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Briefcase size={11} />
          {guardPos
            ? <>{withinRadiusCount} of {markers.length} job{markers.length !== 1 ? 's' : ''} within {radiusKm} km</>
            : <>{markers.length} job{markers.length !== 1 ? 's' : ''} on map</>
          }
          {markers.length < jobs.length && (
            <span className="flex items-center gap-0.5 ml-1">
              <Loader size={9} className="animate-spin" />
              {jobs.length - markers.length} locating
            </span>
          )}
        </span>
        {guardPos && markers.length > withinRadiusCount && (
          <span className="text-xs text-gray-400">
            {markers.length - withinRadiusCount} outside range
          </span>
        )}
      </div>
    </div>
  );
}
