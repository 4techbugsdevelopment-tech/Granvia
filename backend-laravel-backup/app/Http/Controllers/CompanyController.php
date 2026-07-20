<?php

namespace App\Http\Controllers;

use App\Models\EmployerCompany;
use App\Services\FileStorageService;
use Illuminate\Http\Request;

class CompanyController extends Controller
{
    public function uploadLogo(Request $request, EmployerCompany $company, FileStorageService $storage)
    {
        if ($company->employer_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate(['file' => ['required', 'image', 'max:5120']]);

        $stored = $storage->store('company-logos', (string) $company->id, $data['file']);

        $company->update(['logo_url' => $stored['url']]);

        return response()->json($company->fresh());
    }

    public function index(Request $request)
    {
        return response()->json(
            EmployerCompany::where('employer_user_id', $request->user()->id)
                ->orderByDesc('created_at')
                ->get()
        );
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $company = EmployerCompany::create([
            ...$data,
            'employer_user_id' => $request->user()->id,
            'verification_status' => 'pending',
            'account_status' => 'active',
        ]);

        return response()->json($company, 201);
    }

    public function update(Request $request, EmployerCompany $company)
    {
        if ($company->employer_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $this->validated($request, sometimes: true);

        if ($request->has('account_status')) {
            $data['account_status'] = $request->input('account_status');
        }

        $company->update($data);

        return response()->json($company->fresh());
    }

    private function validated(Request $request, bool $sometimes = false): array
    {
        $rule = fn (string $r) => $sometimes ? ['sometimes', $r] : [$r];

        $data = $request->validate([
            'company_name' => [...$rule('required'), 'string'],
            'business_type' => ['nullable', 'string'],
            'registration_type' => ['nullable', 'string'],
            'gst_number' => ['nullable', 'regex:/^[0-9A-Z]{15}$/'],
            'pan_number' => ['nullable', 'regex:/^[A-Z]{5}[0-9]{4}[A-Z]$/'],
            'company_email' => ['nullable', 'email'],
            'company_phone' => ['nullable', 'string'],
            'website' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'registered_address' => ['nullable', 'string'],
            'billing_address' => ['nullable', 'string'],
            'city' => ['nullable', 'string'],
            'state' => ['nullable', 'string'],
            'pincode' => ['nullable', 'regex:/^\d{6}$/'],
        ]);

        if (! empty($data['gst_number'])) {
            $data['gst_number'] = strtoupper($data['gst_number']);
        }

        if (! empty($data['pan_number'])) {
            $data['pan_number'] = strtoupper($data['pan_number']);
        }

        return $data;
    }
}
