<?php

namespace App\Http\Controllers;

use App\Models\CompanySite;
use App\Models\EmployerCompany;
use App\Models\GuardDocument;
use App\Models\GuardProfile;
use App\Models\JobPost;
use App\Models\Payment;
use App\Models\StaffMember;
use App\Models\SubAdminProfile;
use App\Models\User;
use App\Services\FileStorageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SubAdminController extends Controller
{
    private const COMMISSION_RATE = 0.10;

    /** Employers (clients) assigned to this sub admin branch. */
    private function clientIds(Request $request): array
    {
        return User::where('role', 'employer')
            ->whereHas('employerProfile', fn ($q) => $q->where('sub_admin_id', $request->user()->id))
            ->pluck('id')->all();
    }

    /** Guard (service partner) user IDs scoped to this branch. */
    private function guardIds(Request $request): array
    {
        return GuardProfile::where('sub_admin_id', $request->user()->id)->pluck('user_id')->all();
    }

    // ── Dashboard ──────────────────────────────────────────────────────────

    public function counts(Request $request)
    {
        $clientIds = $this->clientIds($request);
        $guardIds = $this->guardIds($request);

        $revenue = Payment::whereIn('employer_user_id', $clientIds)
            ->where('payment_status', 'completed')->sum('amount');

        return response()->json([
            'active_jobs' => JobPost::whereIn('employer_user_id', $clientIds)->where('status', 'active')->count(),
            'total_jobs' => JobPost::whereIn('employer_user_id', $clientIds)->count(),
            'service_partners' => count($guardIds),
            'clients' => count($clientIds),
            'staff' => StaffMember::where('sub_admin_user_id', $request->user()->id)->count(),
            'revenue' => round((float) $revenue, 2),
            'commission' => round((float) $revenue * self::COMMISSION_RATE, 2),
        ]);
    }

    // ── Company details ────────────────────────────────────────────────────

    public function company(Request $request)
    {
        $profile = SubAdminProfile::firstOrCreate(
            ['user_id' => $request->user()->id],
            ['branch_name' => $request->user()->full_name.' Branch']
        );

        $clientIds = $this->clientIds($request);
        $sites = CompanySite::whereIn('employer_user_id', $clientIds)
            ->get(['id', 'site_name', 'address', 'city', 'state']);

        return response()->json(['profile' => $profile, 'sites' => $sites]);
    }

    public function updateCompany(Request $request)
    {
        $data = $request->validate([
            'branch_name' => ['sometimes', 'required', 'string'],
            'registration_no' => ['nullable', 'string'],
            'gst_number' => ['nullable', 'string'],
            'address' => ['nullable', 'string'],
            'contact_email' => ['nullable', 'email'],
            'phone' => ['nullable', 'string'],
        ]);

        $profile = SubAdminProfile::updateOrCreate(
            ['user_id' => $request->user()->id],
            [...$data, 'branch_name' => $data['branch_name'] ?? ($request->user()->full_name.' Branch')]
        );

        return response()->json($profile);
    }

    // ── Staff management ───────────────────────────────────────────────────

    public function staff(Request $request)
    {
        return response()->json(
            StaffMember::where('sub_admin_user_id', $request->user()->id)->latest()->get()
        );
    }

    public function storeStaff(Request $request)
    {
        $data = $this->validateStaff($request);

        $staff = StaffMember::create([
            ...$data,
            'sub_admin_user_id' => $request->user()->id,
        ]);

        return response()->json($staff, 201);
    }

    public function updateStaff(Request $request, StaffMember $staff)
    {
        $this->authorizeStaff($request, $staff);
        $staff->update($this->validateStaff($request, sometimes: true));

        return response()->json($staff->fresh());
    }

    public function destroyStaff(Request $request, StaffMember $staff)
    {
        $this->authorizeStaff($request, $staff);
        $staff->delete();

        return response()->json(['message' => 'Staff member removed.']);
    }

    // ── Manual verification desk ───────────────────────────────────────────

    public function verificationQueue(Request $request, FileStorageService $storage)
    {
        $guards = GuardProfile::where('sub_admin_id', $request->user()->id)
            ->with('user:id,full_name,mobile')->get();

        $docsByGuard = GuardDocument::whereIn('guard_user_id', $guards->pluck('user_id'))
            ->orderByDesc('created_at')->get()->groupBy('guard_user_id');

        return response()->json($guards->map(fn ($g) => [
            'id' => $g->user_id,
            'name' => $g->full_name,
            'mobile' => $g->mobile,
            'city' => $g->city,
            'qualification' => $g->qualification,
            'experience' => $g->experience,
            'languages' => $g->languages ?? [],
            'verification_status' => $g->verification_status,
            'documents' => ($docsByGuard[$g->user_id] ?? collect())->map(fn ($d) => [
                'id' => $d->id,
                'document_type' => $d->document_type,
                'file_name' => $d->file_name,
                'status' => $d->status,
                'admin_remarks' => $d->admin_remarks,
                'uploaded_at' => $d->created_at,
                'download_url' => $storage->urlFor('guard-documents', $d->file_path),
            ])->values(),
        ]));
    }

    public function updateDocument(Request $request, GuardDocument $document)
    {
        // Document must belong to a guard scoped to this branch.
        $scoped = GuardProfile::where('user_id', $document->guard_user_id)
            ->where('sub_admin_id', $request->user()->id)->exists();
        abort_unless($scoped, 403, 'This service partner is not in your branch.');

        $data = $request->validate([
            'status' => ['required', Rule::in(['verified', 'rejected', 'pending'])],
            'admin_remarks' => ['nullable', 'string'],
        ]);

        DB::transaction(function () use ($document, $data, $request) {
            $document->update([
                'status' => $data['status'],
                'admin_remarks' => $data['admin_remarks'] ?? $document->admin_remarks,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            if ($document->document_type === 'police_verification') {
                GuardProfile::where('user_id', $document->guard_user_id)
                    ->update(['police_verification_status' => $data['status']]);
            }
        });

        return response()->json($document->fresh());
    }

    // ── Clients & service partners ─────────────────────────────────────────

    public function clients(Request $request)
    {
        $clients = User::where('role', 'employer')
            ->whereHas('employerProfile', fn ($q) => $q->where('sub_admin_id', $request->user()->id))
            ->with('employerProfile')->get();

        $siteCounts = CompanySite::whereIn('employer_user_id', $clients->pluck('id'))
            ->selectRaw('employer_user_id, count(*) as c')->groupBy('employer_user_id')->pluck('c', 'employer_user_id');
        $jobCounts = JobPost::whereIn('employer_user_id', $clients->pluck('id'))
            ->selectRaw('employer_user_id, count(*) as c')->groupBy('employer_user_id')->pluck('c', 'employer_user_id');

        return response()->json($clients->map(fn ($u) => [
            'id' => $u->id,
            'company' => $u->full_name,
            'contact' => $u->email,
            'sites' => (int) ($siteCounts[$u->id] ?? 0),
            'jobs' => (int) ($jobCounts[$u->id] ?? 0),
            'status' => optional($u->employerProfile)->billing_status ?? 'current',
        ]));
    }

    public function guards(Request $request)
    {
        return response()->json(
            GuardProfile::where('sub_admin_id', $request->user()->id)
                ->with('user:id,account_status')
                ->get()
                ->map(fn ($g) => [
                    'id' => $g->user_id,
                    'name' => $g->full_name,
                    'city' => $g->city,
                    'status' => $g->verification_status,
                    'account_status' => optional($g->user)->account_status,
                    'experience' => $g->experience,
                ])
        );
    }

    // ── Reports ────────────────────────────────────────────────────────────

    public function skillsReport(Request $request)
    {
        return response()->json(
            GuardProfile::where('sub_admin_id', $request->user()->id)->get()->map(fn ($g) => [
                'id' => $g->user_id,
                'name' => $g->full_name,
                'languages' => $g->languages ?? [],
                'english' => in_array('English', $g->languages ?? [], true) ? 'Yes' : 'No',
                'qualification' => $g->qualification,
                'specialization' => ($g->skills ?? [])[0] ?? null,
                'experience' => $g->experience,
            ])
        );
    }

    public function commissionReport(Request $request)
    {
        $clientIds = $this->clientIds($request);

        $monthly = Payment::whereIn('employer_user_id', $clientIds)
            ->where('payment_status', 'completed')
            ->where('payment_date', '>=', now()->subMonths(6)->startOfMonth())
            ->get()
            ->groupBy(fn ($p) => optional($p->payment_date)->format('M'))
            ->map(fn ($rows, $month) => [
                'month' => $month,
                'settlements' => $rows->count(),
                'commission' => round($rows->sum('amount') * self::COMMISSION_RATE, 2),
            ])->values();

        $total = Payment::whereIn('employer_user_id', $clientIds)
            ->where('payment_status', 'completed')->sum('amount');

        return response()->json([
            'commission_rate' => self::COMMISSION_RATE,
            'total_earned' => round((float) $total * self::COMMISSION_RATE, 2),
            'settlements_count' => Payment::whereIn('employer_user_id', $clientIds)->where('payment_status', 'completed')->count(),
            'by_month' => $monthly,
        ]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function authorizeStaff(Request $request, StaffMember $staff): void
    {
        abort_unless($staff->sub_admin_user_id === $request->user()->id, 403, 'Forbidden.');
    }

    private function validateStaff(Request $request, bool $sometimes = false): array
    {
        $rule = fn (string $r) => $sometimes ? ['sometimes', $r] : [$r];

        return $request->validate([
            'name' => [...$rule('required'), 'string', 'min:2'],
            'role' => [...$rule('required'), 'string'],
            'email' => ['nullable', 'email'],
            'mobile' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string'],
        ]);
    }
}
