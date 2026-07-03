<?php

namespace App\Http\Controllers;

use App\Models\InterviewRequest;
use Illuminate\Http\Request;

class InterviewRequestController extends Controller
{
    public function index(Request $request)
    {
        $query = InterviewRequest::where('employer_user_id', $request->user()->id)
            ->with(['job:id,title', 'guardProfile:id,user_id,full_name,mobile']);

        if ($request->filled('company_id')) {
            $query->where('company_id', $request->query('company_id'));
        }

        return response()->json($query->orderByDesc('created_at')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'application_id' => ['nullable', 'uuid'],
            'job_id' => ['nullable', 'uuid'],
            'guard_user_id' => ['required', 'uuid'],
            'company_id' => ['nullable', 'uuid'],
            'request_type' => ['nullable', 'string'],
            'preferred_date' => ['nullable', 'date'],
            'preferred_time' => ['nullable'],
            'message' => ['nullable', 'string'],
        ]);

        $interview = InterviewRequest::create([
            ...$data,
            'employer_user_id' => $request->user()->id,
            'status' => 'requested',
        ]);

        return response()->json($interview, 201);
    }

    public function update(Request $request, InterviewRequest $interviewRequest)
    {
        if ($interviewRequest->employer_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'preferred_date' => ['sometimes', 'nullable', 'date'],
            'preferred_time' => ['sometimes', 'nullable'],
            'message' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'string'],
        ]);

        $interviewRequest->update($data);

        return response()->json($interviewRequest->fresh());
    }
}
