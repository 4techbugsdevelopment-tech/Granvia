<?php

namespace App\Http\Controllers;

use App\Models\Agreement;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AgreementController extends Controller
{
    public function index(Request $request)
    {
        $query = Agreement::where('employer_user_id', $request->user()->id)
            ->with(['job:id,title', 'guardProfile:id,user_id,full_name']);

        if ($request->filled('company_id')) {
            $query->whereHas('job', fn ($q) => $q->where('company_id', $request->query('company_id')));
        }

        return response()->json($query->orderByDesc('created_at')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'offer_id' => ['nullable', 'uuid'],
            'job_id' => ['nullable', 'uuid'],
            'guard_user_id' => ['nullable', 'uuid'],
            'site_id' => ['nullable', 'uuid'],
            'title' => ['required', 'string'],
            'terms' => ['nullable', 'array'],
            'effective_from' => ['nullable', 'date'],
            'effective_until' => ['nullable', 'date'],
        ]);

        $agreement = Agreement::create([
            ...$data,
            'employer_user_id' => $request->user()->id,
            'agreement_number' => 'AGR-'.strtoupper(Str::random(8)),
            'status' => 'draft',
        ]);

        return response()->json($agreement, 201);
    }

    public function update(Request $request, Agreement $agreement)
    {
        if ($agreement->employer_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'terms' => ['sometimes', 'nullable', 'array'],
            'effective_from' => ['sometimes', 'nullable', 'date'],
            'effective_until' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'string'],
            'employer_confirmation_status' => ['sometimes', 'string'],
            'guard_confirmation_status' => ['sometimes', 'string'],
            'signed_at' => ['sometimes', 'nullable', 'date'],
        ]);

        $agreement->update($data);

        return response()->json($agreement->fresh());
    }
}
