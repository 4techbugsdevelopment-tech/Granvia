<?php

namespace App\Http\Controllers;

use App\Models\CompanySite;
use App\Models\JobPost;
use Illuminate\Http\Request;

class JobController extends Controller
{
    public function active(Request $request)
    {
        return response()->json(
            JobPost::where('status', 'active')
                ->with(['company:id,company_name', 'site'])
                ->orderByDesc('created_at')
                ->get()
        );
    }

    public function mine(Request $request)
    {
        $query = JobPost::where('employer_user_id', $request->user()->id)
            ->with(['company:id,company_name', 'site:id,site_name,city,state']);

        if ($request->filled('company_id')) {
            $query->where('company_id', $request->query('company_id'));
        }

        return response()->json($query->orderByDesc('created_at')->get());
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        if (! empty($data['site_id'])) {
            $site = CompanySite::find($data['site_id']);

            if (! $site || $site->company_id !== $data['company_id']) {
                return response()->json(['message' => 'Site does not belong to the selected company.'], 422);
            }
        }

        $job = JobPost::create([
            ...$data,
            'employer_user_id' => $request->user()->id,
            'status' => 'pending_approval',
        ]);

        return response()->json($job, 201);
    }

    public function update(Request $request, JobPost $job)
    {
        if ($job->employer_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $this->validated($request, sometimes: true);
        unset($data['latitude'], $data['longitude']);

        $job->update($data);

        return response()->json($job->fresh());
    }

    public function destroy(Request $request, JobPost $job)
    {
        if ($job->employer_user_id !== $request->user()->id && $request->user()->role !== 'super_admin') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $job->delete();

        return response()->json(['message' => 'Job deleted.']);
    }

    public function pending()
    {
        return response()->json(
            JobPost::where('status', 'pending_approval')
                ->with(['company:id,company_name', 'site:id,site_name,city,state'])
                ->orderByDesc('created_at')
                ->get()
        );
    }

    public function all()
    {
        return response()->json(
            JobPost::with(['company:id,company_name', 'site:id,site_name,city,state'])
                ->orderByDesc('created_at')
                ->get()
        );
    }

    public function approve(JobPost $job)
    {
        $job->update(['status' => 'active']);

        return response()->json($job->fresh());
    }

    public function reject(Request $request, JobPost $job)
    {
        $data = $request->validate(['reason' => ['nullable', 'string']]);

        $job->update(['status' => 'rejected', 'rejection_reason' => $data['reason'] ?? '']);

        return response()->json($job->fresh());
    }

    private function validated(Request $request, bool $sometimes = false): array
    {
        $rule = fn (string $r) => $sometimes ? ['sometimes', $r] : [$r];

        return $request->validate([
            'company_id' => [...$rule('required'), 'uuid'],
            'site_id' => ['nullable', 'uuid'],
            'title' => [...$rule('required'), 'string'],
            'category' => ['nullable', 'string'],
            'guard_type' => ['nullable', 'string'],
            'guards_required' => ['nullable', 'integer', 'min:1'],
            'gender_preference' => ['nullable', 'string'],
            'experience_required' => ['nullable', 'string'],
            'salary_amount' => ['nullable', 'numeric'],
            'payment_type' => ['nullable', 'string'],
            'duty_hours' => ['nullable', 'string'],
            'shift_type' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'duration_type' => ['nullable', 'string'],
            'required_skills' => ['nullable', 'array'],
            'language_requirements' => ['nullable', 'array'],
            'police_verification_required' => ['nullable', 'boolean'],
            'uniform_required' => ['nullable', 'boolean'],
            'food_facility' => ['nullable', 'boolean'],
            'accommodation_facility' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string'],
            'special_instructions' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);
    }
}
