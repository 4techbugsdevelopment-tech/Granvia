<?php

namespace App\Http\Controllers;

use App\Models\AttendanceRecord;
use App\Models\JobApplication;
use App\Models\JobPost;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function guardIndex(Request $request)
    {
        return response()->json(
            AttendanceRecord::where('guard_user_id', $request->user()->id)
                ->with('job:id,title')
                ->orderByDesc('attendance_date')
                ->orderByDesc('in_time')
                ->get()
        );
    }

    public function checkIn(Request $request)
    {
        $data = $request->validate([
            'job_id' => ['nullable', 'uuid', 'exists:job_posts,id'],
            'guard_remarks' => ['nullable', 'string'],
        ]);

        $guardId = $request->user()->id;
        $today = now()->toDateString();

        $existing = AttendanceRecord::where('guard_user_id', $guardId)
            ->whereDate('attendance_date', $today)
            ->when($data['job_id'] ?? null, fn ($q, $jobId) => $q->where('job_id', $jobId))
            ->first();

        if ($existing) {
            return response()->json(['message' => 'Attendance already marked for today.'], 422);
        }

        $job = null;
        if (! empty($data['job_id'])) {
            $job = JobPost::find($data['job_id']);

            $isHired = JobApplication::where('guard_user_id', $guardId)
                ->where('job_id', $job->id)
                ->whereIn('status', ['selected', 'offer_sent', 'accepted', 'joined'])
                ->exists();

            if (! $isHired) {
                return response()->json(['message' => 'You are not assigned to this job.'], 422);
            }
        }

        $record = AttendanceRecord::create([
            'guard_user_id' => $guardId,
            'employer_user_id' => $job?->employer_user_id,
            'company_id' => $job?->company_id,
            'job_id' => $job?->id,
            'site_id' => $job?->site_id,
            'attendance_date' => $today,
            'in_time' => now(),
            'status' => 'pending_verification',
            'guard_remarks' => $data['guard_remarks'] ?? null,
        ]);

        return response()->json($record->load('job:id,title'), 201);
    }

    public function checkOut(Request $request, AttendanceRecord $record)
    {
        if ($record->guard_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($record->out_time) {
            return response()->json(['message' => 'Already checked out for this record.'], 422);
        }

        $data = $request->validate(['guard_remarks' => ['nullable', 'string']]);

        $outTime = now();
        $totalHours = $record->in_time
            ? round($record->in_time->diffInMinutes($outTime) / 60, 2)
            : null;

        $record->update([
            'out_time' => $outTime,
            'total_hours' => $totalHours,
            'guard_remarks' => $data['guard_remarks'] ?? $record->guard_remarks,
        ]);

        return response()->json($record->fresh()->load('job:id,title'));
    }

    public function index(Request $request)
    {
        $query = AttendanceRecord::where('employer_user_id', $request->user()->id)
            ->with(['guardProfile:id,user_id,full_name,mobile', 'job:id,title']);

        if ($request->filled('company_id')) {
            $query->where('company_id', $request->query('company_id'));
        }

        return response()->json($query->orderByDesc('attendance_date')->get());
    }

    public function updateStatus(Request $request, AttendanceRecord $record)
    {
        if ($record->employer_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'status' => ['required', 'string'],
            'employer_remarks' => ['nullable', 'string'],
        ]);

        $record->update($data);

        return response()->json($record->fresh());
    }
}
