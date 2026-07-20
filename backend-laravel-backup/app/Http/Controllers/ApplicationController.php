<?php

namespace App\Http\Controllers;

use App\Models\ApplicationStatusLog;
use App\Models\JobApplication;
use App\Models\JobPost;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApplicationController extends Controller
{
    public function apply(Request $request, JobPost $job)
    {
        if ($job->status !== 'active') {
            return response()->json(['message' => 'This job is not currently accepting applications.'], 422);
        }

        if (! $job->company_id || ! $job->site_id) {
            return response()->json(['message' => 'This job posting is missing company or site information.'], 422);
        }

        $data = $request->validate(['cover_note' => ['nullable', 'string']]);

        $application = JobApplication::create([
            'job_id' => $job->id,
            'guard_user_id' => $request->user()->id,
            'employer_user_id' => $job->employer_user_id,
            'company_id' => $job->company_id,
            'site_id' => $job->site_id,
            'cover_note' => $data['cover_note'] ?? null,
            'status' => 'applied',
            'applied_at' => now(),
        ]);

        return response()->json($application, 201);
    }

    public function mine(Request $request)
    {
        return response()->json(
            JobApplication::where('guard_user_id', $request->user()->id)
                ->with([
                    'job:id,title,salary_amount,payment_type,shift_type,duty_hours,company_id,site_id',
                    'job.company:id,company_name',
                    'job.site:id,site_name,city',
                ])
                ->orderByDesc('applied_at')
                ->get()
        );
    }

    public function myAppliedJobIds(Request $request)
    {
        return response()->json(
            JobApplication::where('guard_user_id', $request->user()->id)->pluck('job_id')
        );
    }

    public function employerIndex(Request $request)
    {
        $query = JobApplication::where('employer_user_id', $request->user()->id)
            ->with([
                'job:id,title,salary_amount,duty_hours,shift_type,start_date',
                'guardProfile:id,user_id,full_name,mobile,city,skills,languages,verification_status',
            ]);

        if ($request->filled('company_id')) {
            $query->where('company_id', $request->query('company_id'));
        }

        if ($request->filled('job_id')) {
            $query->where('job_id', $request->query('job_id'));
        }

        return response()->json($query->orderByDesc('applied_at')->get());
    }

    public function updateStatus(Request $request, JobApplication $application)
    {
        $data = $request->validate([
            'status' => ['required', 'string'],
            'remarks' => ['nullable', 'string'],
        ]);

        DB::transaction(function () use ($application, $data, $request) {
            $oldStatus = $application->status;

            $application->update([
                'status' => $data['status'],
                'notes' => $data['remarks'] ?? $application->notes,
                'reviewed_at' => now(),
                'reviewed_by' => $request->user()->id,
            ]);

            ApplicationStatusLog::create([
                'application_id' => $application->id,
                'changed_by' => $request->user()->id,
                'old_status' => $oldStatus,
                'new_status' => $data['status'],
                'remarks' => $data['remarks'] ?? null,
                'created_at' => now(),
            ]);
        });

        return response()->json($application->fresh());
    }
}
