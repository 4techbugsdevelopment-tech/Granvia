<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Server-side proxy for Mappls (MapmyIndia) geocoding.
 *
 * The Mappls client secret must never reach the browser, and Mappls' APIs
 * do not allow browser CORS — so the frontend calls this endpoint, and we
 * call Mappls from here with a cached OAuth access token.
 */
class GeocodeController extends Controller
{
    private const TOKEN_URL = 'https://outpost.mappls.com/api/security/oauth/token';
    private const GEOCODE_URL = 'https://atlas.mappls.com/api/places/geocode';
    private const TOKEN_CACHE_KEY = 'mappls_access_token';

    public function __invoke(Request $request)
    {
        $request->validate([
            'address' => ['required', 'string', 'min:3', 'max:500'],
        ]);

        $clientId = config('services.mappls.client_id');
        $clientSecret = config('services.mappls.client_secret');

        if (! $clientId || ! $clientSecret) {
            return response()->json([
                'message' => 'Geocoding is not configured on the server.',
            ], 503);
        }

        try {
            $token = $this->accessToken($clientId, $clientSecret);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Could not authenticate with the location service.',
            ], 502);
        }

        $response = Http::withToken($token)
            ->acceptJson()
            ->get(self::GEOCODE_URL, [
                'address' => $request->query('address'),
                'itemCount' => 1,
                'region' => 'IND',
            ]);

        // A stale token surfaces as 401 — drop it so the next call refetches.
        if ($response->status() === 401) {
            Cache::forget(self::TOKEN_CACHE_KEY);
        }

        if (! $response->successful()) {
            return response()->json(['message' => 'Location service error.'], 502);
        }

        $point = $this->extractPoint($response->json());

        if (! $point) {
            return response()->json([
                'found' => false,
                'message' => 'Address could not be located.',
            ], 404);
        }

        return response()->json([
            'found' => true,
            'lat' => $point['lat'],
            'lng' => $point['lng'],
            'formatted' => $point['formatted'],
        ]);
    }

    /**
     * Client-credentials OAuth token, cached until just before it expires.
     */
    private function accessToken(string $clientId, string $clientSecret): string
    {
        $cached = Cache::get(self::TOKEN_CACHE_KEY);
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        $res = Http::asForm()->post(self::TOKEN_URL, [
            'grant_type' => 'client_credentials',
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
        ]);

        $res->throw();

        $token = $res->json('access_token');
        if (! is_string($token) || $token === '') {
            throw new \RuntimeException('No access token returned by Mappls.');
        }

        $expiresIn = (int) ($res->json('expires_in') ?? 3600);
        Cache::put(self::TOKEN_CACHE_KEY, $token, now()->addSeconds(max(60, $expiresIn - 60)));

        return $token;
    }

    /**
     * Pull the first usable lat/lng out of a Mappls geocode response.
     * Mappls returns a best match in `copResults` and/or a `results` array;
     * field names vary, so we check the common variants defensively.
     */
    private function extractPoint(array $json): ?array
    {
        $candidates = [];

        if (isset($json['results']) && is_array($json['results'])) {
            foreach ($json['results'] as $r) {
                if (is_array($r)) {
                    $candidates[] = $r;
                }
            }
        }

        if (isset($json['copResults']) && is_array($json['copResults'])) {
            $candidates[] = $json['copResults'];
        }

        foreach ($candidates as $c) {
            $lat = $c['latitude'] ?? $c['lat'] ?? $c['y'] ?? null;
            $lng = $c['longitude'] ?? $c['lng'] ?? $c['lon'] ?? $c['x'] ?? null;

            if (is_numeric($lat) && is_numeric($lng)) {
                return [
                    'lat' => (float) $lat,
                    'lng' => (float) $lng,
                    'formatted' => $c['formattedAddress'] ?? $c['orderedAddress'] ?? null,
                ];
            }
        }

        return null;
    }
}
