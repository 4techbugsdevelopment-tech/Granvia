<?php

namespace App\Http\Controllers;

use App\Models\CompanySite;
use App\Models\Discount;
use App\Models\EmployerCompany;
use App\Models\GuardProfile;
use App\Models\JobApplication;
use App\Models\JobPost;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SalesController extends Controller
{
    /** UUIDs of the employers (clients) assigned to the current sales executive. */
    private function managedClientIds(Request $request): array
    {
        return User::where('role', 'employer')
            ->whereHas('employerProfile', fn ($q) => $q->where('sales_executive_id', $request->user()->id))
            ->pluck('id')
            ->all();
    }

    // ── Dashboard ──────────────────────────────────────────────────────────

    public function counts(Request $request)
    {
        $clientIds = $this->managedClientIds($request);

        $activeJobs = JobPost::whereIn('employer_user_id', $clientIds)->where('status', 'active')->count();
        $totalApplications = JobApplication::whereIn('employer_user_id', $clientIds)->count();
        $accepted = JobApplication::whereIn('employer_user_id', $clientIds)
            ->whereIn('status', ['accepted', 'selected', 'hired'])
            ->count();

        return response()->json([
            'managed_clients' => count($clientIds),
            'active_jobs' => $activeJobs,
            'total_jobs' => JobPost::whereIn('employer_user_id', $clientIds)->count(),
            'conversion_rate' => $totalApplications > 0 ? round($accepted / $totalApplications * 100, 1) : 0,
            'active_discounts' => Discount::where('sales_executive_user_id', $request->user()->id)->where('status', 'Active')->count(),
        ]);
    }

    public function activity(Request $request)
    {
        $clientIds = $this->managedClientIds($request);

        $jobs = JobPost::whereIn('employer_user_id', $clientIds)
            ->with('company:id,company_name')
            ->latest()->limit(6)->get()
            ->map(fn ($j) => [
                'type' => 'job',
                'title' => 'Job posted: '.$j->title,
                'subtitle' => optional($j->company)->company_name,
                'at' => $j->created_at,
            ]);

        $apps = JobApplication::whereIn('employer_user_id', $clientIds)
            ->with('job:id,title')
            ->latest()->limit(6)->get()
            ->map(fn ($a) => [
                'type' => 'application',
                'title' => 'New application'.(optional($a->job)->title ? ' for '.$a->job->title : ''),
                'subtitle' => 'Status: '.$a->status,
                'at' => $a->created_at,
            ]);

        return response()->json(
            $jobs->concat($apps)->sortByDesc('at')->take(8)->values()
        );
    }

    // ── Clients & sites ────────────────────────────────────────────────────

    public function clients(Request $request)
    {
        $clients = User::where('role', 'employer')
            ->whereHas('employerProfile', fn ($q) => $q->where('sales_executive_id', $request->user()->id))
            ->with('employerProfile')
            ->get();

        $companyCounts = EmployerCompany::whereIn('employer_user_id', $clients->pluck('id'))
            ->selectRaw('employer_user_id, count(*) as c')->groupBy('employer_user_id')->pluck('c', 'employer_user_id');
        $siteCounts = CompanySite::whereIn('employer_user_id', $clients->pluck('id'))
            ->selectRaw('employer_user_id, count(*) as c')->groupBy('employer_user_id')->pluck('c', 'employer_user_id');
        $jobCounts = JobPost::whereIn('employer_user_id', $clients->pluck('id'))
            ->selectRaw('employer_user_id, count(*) as c')->groupBy('employer_user_id')->pluck('c', 'employer_user_id');

        return response()->json($clients->map(fn ($u) => [
            'id' => $u->id,
            'name' => $u->full_name,
            'email' => $u->email,
            'mobile' => $u->mobile,
            'city' => optional($u->employerProfile)->city,
            'state' => optional($u->employerProfile)->state,
            'billing_status' => optional($u->employerProfile)->billing_status ?? 'current',
            'base_hourly_rate' => optional($u->employerProfile)->base_hourly_rate,
            'companies' => (int) ($companyCounts[$u->id] ?? 0),
            'sites' => (int) ($siteCounts[$u->id] ?? 0),
            'jobs' => (int) ($jobCounts[$u->id] ?? 0),
        ]));
    }

    public function clientDetail(Request $request, User $employer)
    {
        $this->authorizeClient($request, $employer);

        $companies = EmployerCompany::where('employer_user_id', $employer->id)->with('sites')->get();
        $jobs = JobPost::where('employer_user_id', $employer->id)
            ->with(['company:id,company_name', 'site:id,site_name'])
            ->latest()->limit(20)->get();

        return response()->json([
            'client' => [
                'id' => $employer->id,
                'name' => $employer->full_name,
                'email' => $employer->email,
                'mobile' => $employer->mobile,
                'billing_status' => optional($employer->employerProfile)->billing_status ?? 'current',
                'base_hourly_rate' => optional($employer->employerProfile)->base_hourly_rate,
            ],
            'companies' => $companies,
            'sites' => $companies->flatMap->sites->values(),
            'jobs' => $jobs,
        ]);
    }

    // ── Proxy job posting with client OTP confirmation ─────────────────────

    public function requestJobOtp(Request $request)
    {
        $data = $request->validate(['employer_user_id' => ['required', 'uuid']]);
        $employer = User::findOrFail($data['employer_user_id']);
        $this->authorizeClient($request, $employer);

        $otp = (string) random_int(1000, 9999);
        $otpId = (string) Str::uuid();

        Cache::put("sales_job_otp:{$otpId}", [
            'hash' => Hash::make($otp),
            'sales_id' => $request->user()->id,
            'employer_id' => $employer->id,
        ], now()->addMinutes(10));

        return response()->json([
            'otp_id' => $otpId,
            'sent_to' => $employer->mobile,
            // Returned only in debug so the demo/live flow can show the code.
            'dev_otp' => config('app.debug') ? $otp : null,
        ]);
    }

    public function storeJob(Request $request)
    {
        $data = $request->validate([
            'otp_id' => ['required', 'string'],
            'otp' => ['required', 'string'],
            'employer_user_id' => ['required', 'uuid'],
            'company_id' => ['required', 'uuid'],
            'site_id' => ['nullable', 'uuid'],
            'title' => ['required', 'string'],
            'duty_hours' => ['nullable', 'string'],
            'guards_required' => ['nullable', 'integer', 'min:1'],
            'experience_required' => ['nullable', 'string'],
            'qualification_required' => ['nullable', 'string'],
            'language_requirements' => ['nullable', 'array'],
            'salary_amount' => ['nullable', 'numeric'],
            'description' => ['nullable', 'string'],
        ]);

        $employer = User::findOrFail($data['employer_user_id']);
        $this->authorizeClient($request, $employer);

        // Verify OTP.
        $cached = Cache::get("sales_job_otp:{$data['otp_id']}");
        if (! $cached || $cached['employer_id'] !== $employer->id || ! Hash::check($data['otp'], $cached['hash'])) {
            return response()->json(['message' => 'Invalid or expired client confirmation OTP.'], 422);
        }

        $company = EmployerCompany::where('id', $data['company_id'])
            ->where('employer_user_id', $employer->id)->first();
        if (! $company) {
            return response()->json(['message' => 'Company does not belong to this client.'], 422);
        }

        if (! empty($data['site_id'])) {
            $site = CompanySite::find($data['site_id']);
            if (! $site || $site->company_id !== $company->id) {
                return response()->json(['message' => 'Site does not belong to the selected company.'], 422);
            }
        }

        $job = JobPost::create([
            'employer_user_id' => $employer->id,
            'company_id' => $data['company_id'],
            'site_id' => $data['site_id'] ?? null,
            'title' => $data['title'],
            'duty_hours' => $data['duty_hours'] ?? null,
            'guards_required' => $data['guards_required'] ?? 1,
            'experience_required' => $data['experience_required'] ?? null,
            'qualification_required' => $data['qualification_required'] ?? null,
            'language_requirements' => $data['language_requirements'] ?? null,
            'salary_amount' => $data['salary_amount'] ?? null,
            'description' => $data['description'] ?? null,
            'category' => 'proxy_sales',
            'status' => 'pending_approval',
        ]);

        Cache::forget("sales_job_otp:{$data['otp_id']}");

        return response()->json($job->load(['company:id,company_name', 'site:id,site_name']), 201);
    }

    // ── Discounts ──────────────────────────────────────────────────────────

    public function discounts(Request $request)
    {
        return response()->json(
            Discount::where('sales_executive_user_id', $request->user()->id)
                ->with('employer:id,full_name')
                ->latest()->get()
        );
    }

    public function storeDiscount(Request $request)
    {
        $data = $this->validateDiscount($request);

        if (! empty($data['employer_user_id'])) {
            $this->authorizeClient($request, User::findOrFail($data['employer_user_id']));
        }

        $discount = Discount::create([
            ...$data,
            'sales_executive_user_id' => $request->user()->id,
        ]);

        return response()->json($discount->load('employer:id,full_name'), 201);
    }

    public function updateDiscount(Request $request, Discount $discount)
    {
        if ($discount->sales_executive_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $discount->update($this->validateDiscount($request, sometimes: true));

        return response()->json($discount->fresh()->load('employer:id,full_name'));
    }

    public function destroyDiscount(Request $request, Discount $discount)
    {
        if ($discount->sales_executive_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $discount->delete();

        return response()->json(['message' => 'Discount removed.']);
    }

    // ── Manpower availability ("heatmap" count within radius) ──────────────

    public function manpower(Request $request)
    {
        $data = $request->validate([
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'radius' => ['nullable', 'numeric', 'min:1', 'max:100'],
        ]);

        $partners = GuardProfile::whereNotNull('latitude')->whereNotNull('longitude')
            ->where('verification_status', 'verified')
            ->with('user:id,full_name,account_status')
            ->get()
            ->map(function ($g) use ($data) {
                $distance = (isset($data['lat'], $data['lng']))
                    ? $this->haversineKm((float) $data['lat'], (float) $data['lng'], (float) $g->latitude, (float) $g->longitude)
                    : null;

                return [
                    'id' => $g->user_id,
                    'name' => $g->full_name,
                    'city' => $g->city,
                    'latitude' => (float) $g->latitude,
                    'longitude' => (float) $g->longitude,
                    'skills' => $g->skills ?? [],
                    'experience' => $g->experience,
                    'distance_km' => $distance !== null ? round($distance, 1) : null,
                ];
            });

        $radius = $data['radius'] ?? null;
        $withinRadius = ($radius !== null && isset($data['lat']))
            ? $partners->filter(fn ($p) => $p['distance_km'] !== null && $p['distance_km'] <= $radius)->values()
            : $partners;

        return response()->json([
            'radius_km' => $radius,
            'available_count' => $withinRadius->count(),
            'total_count' => $partners->count(),
            'partners' => $withinRadius,
        ]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function authorizeClient(Request $request, User $employer): void
    {
        $ok = $employer->role === 'employer'
            && optional($employer->employerProfile)->sales_executive_id === $request->user()->id;

        abort_unless($ok, 403, 'This client is not assigned to you.');
    }

    private function validateDiscount(Request $request, bool $sometimes = false): array
    {
        $rule = fn (string $r) => $sometimes ? ['sometimes', $r] : [$r];

        return $request->validate([
            'employer_user_id' => ['nullable', 'uuid'],
            'label' => [...$rule('required'), 'string'],
            'discount_type' => ['nullable', Rule::in(['percentage', 'flat'])],
            'value' => [...$rule('required'), 'numeric', 'min:0'],
            'applies_to' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['Active', 'Expired'])],
        ]);
    }

    private function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return $r * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
