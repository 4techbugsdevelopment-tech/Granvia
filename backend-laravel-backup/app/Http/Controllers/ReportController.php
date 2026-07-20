<?php

namespace App\Http\Controllers;

use App\Models\AttendanceRecord;
use App\Models\JobApplication;
use App\Models\JobPost;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function adminCounts()
    {
        return response()->json([
            'guards' => User::where('role', 'guard')->count(),
            'employers' => User::where('role', 'employer')->count(),
            'jobs' => JobPost::count(),
            'active_jobs' => JobPost::where('status', 'active')->count(),
            'pending_jobs' => JobPost::where('status', 'pending_approval')->count(),
            'applications' => JobApplication::count(),
            'attendance_today' => AttendanceRecord::whereDate('attendance_date', now()->toDateString())->count(),
            'payments' => Payment::count(),
        ]);
    }

    public function counts(Request $request)
    {
        $employerId = $request->user()->id;
        $companyId = $request->query('company_id');

        $withCompany = fn ($query) => $companyId ? $query->where('company_id', $companyId) : $query;

        $payments = Payment::where('employer_user_id', $employerId);
        if ($companyId) {
            $payments->whereHas('job', fn ($q) => $q->where('company_id', $companyId));
        }

        return response()->json([
            'jobs' => $withCompany(JobPost::where('employer_user_id', $employerId))->count(),
            'applications' => $withCompany(JobApplication::where('employer_user_id', $employerId))->count(),
            'attendance' => $withCompany(AttendanceRecord::where('employer_user_id', $employerId))->count(),
            'payments' => $payments->count(),
        ]);
    }
}
