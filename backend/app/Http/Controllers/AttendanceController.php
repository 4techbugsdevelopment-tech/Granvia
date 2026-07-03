<?php

namespace App\Http\Controllers;

use App\Models\AttendanceRecord;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
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
