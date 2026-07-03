<?php

namespace App\Http\Controllers;

use App\Models\CompanySite;
use App\Models\EmployerCompany;
use Illuminate\Http\Request;

class SiteController extends Controller
{
    public function index(Request $request, EmployerCompany $company)
    {
        if ($company->employer_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json(
            CompanySite::where('company_id', $company->id)->orderByDesc('created_at')->get()
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'company_id' => ['required', 'uuid'],
            'site_name' => ['required', 'string'],
            'code' => ['nullable', 'string'],
            'address' => ['nullable', 'array'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'site_type' => ['nullable', 'string'],
            'city' => ['nullable', 'string'],
            'state' => ['nullable', 'string'],
            'pincode' => ['nullable', 'string'],
            'contact_person' => ['nullable', 'string'],
            'contact_mobile' => ['nullable', 'string'],
            'shift_details' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $company = EmployerCompany::where('id', $data['company_id'])
            ->where('employer_user_id', $request->user()->id)
            ->first();

        if (! $company) {
            return response()->json(['message' => 'Company not found or does not belong to you.'], 404);
        }

        $site = CompanySite::create([
            ...$data,
            'employer_user_id' => $request->user()->id,
            'status' => 'draft',
        ]);

        return response()->json($site, 201);
    }

    public function update(Request $request, CompanySite $site)
    {
        if ($site->employer_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'site_name' => ['sometimes', 'string'],
            'code' => ['sometimes', 'nullable', 'string'],
            'address' => ['sometimes', 'nullable', 'array'],
            'latitude' => ['sometimes', 'nullable', 'numeric'],
            'longitude' => ['sometimes', 'nullable', 'numeric'],
            'site_type' => ['sometimes', 'nullable', 'string'],
            'city' => ['sometimes', 'nullable', 'string'],
            'state' => ['sometimes', 'nullable', 'string'],
            'pincode' => ['sometimes', 'nullable', 'string'],
            'contact_person' => ['sometimes', 'nullable', 'string'],
            'contact_mobile' => ['sometimes', 'nullable', 'string'],
            'shift_details' => ['sometimes', 'nullable', 'string'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'string'],
        ]);

        $site->update($data);

        return response()->json($site->fresh());
    }
}
