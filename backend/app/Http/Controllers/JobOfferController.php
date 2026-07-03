<?php

namespace App\Http\Controllers;

use App\Models\JobOffer;
use Illuminate\Http\Request;

class JobOfferController extends Controller
{
    public function index(Request $request)
    {
        $query = JobOffer::where('employer_user_id', $request->user()->id)
            ->with(['job:id,title,salary_amount,shift_type,duty_hours', 'guardProfile:id,user_id,full_name']);

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
            'site_id' => ['nullable', 'uuid'],
            'offered_salary' => ['nullable', 'numeric'],
            'duty_hours' => ['nullable', 'string'],
            'shift_type' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'terms_summary' => ['nullable', 'string'],
        ]);

        $offer = JobOffer::create([
            ...$data,
            'employer_user_id' => $request->user()->id,
            'status' => 'sent',
        ]);

        return response()->json($offer, 201);
    }

    public function update(Request $request, JobOffer $jobOffer)
    {
        if ($jobOffer->employer_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'offered_salary' => ['sometimes', 'nullable', 'numeric'],
            'duty_hours' => ['sometimes', 'nullable', 'string'],
            'shift_type' => ['sometimes', 'nullable', 'string'],
            'start_date' => ['sometimes', 'nullable', 'date'],
            'terms_summary' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'string'],
        ]);

        $jobOffer->update($data);

        return response()->json($jobOffer->fresh());
    }
}
