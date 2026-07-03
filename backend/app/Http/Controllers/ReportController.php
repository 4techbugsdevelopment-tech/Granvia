<?php

namespace App\Http\Controllers;

use App\Models\AttendanceRecord;
use App\Models\JobApplication;
use App\Models\JobPost;
use App\Models\Payment;
use Illuminate\Http\Request;

class ReportController extends Controller
{
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
