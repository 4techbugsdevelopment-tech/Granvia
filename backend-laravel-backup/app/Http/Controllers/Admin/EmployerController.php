<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Mail\EmployerWelcomeMail;
use App\Models\CompanyDocument;
use App\Models\CompanySite;
use App\Models\EmployerCompany;
use App\Models\EmployerProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class EmployerController extends Controller
{
    public function index()
    {
        $employers = User::where('role', 'employer')
            ->with(['employerProfile', 'employerWallet'])
            ->orderByDesc('created_at')
            ->get();

        $companies = EmployerCompany::whereIn('employer_user_id', $employers->pluck('id'))->get();
        $companyIds = $companies->pluck('id');

        return response()->json([
            'employers' => $employers,
            'companies' => $companies,
            'documents' => CompanyDocument::whereIn('company_id', $companyIds)->orderByDesc('created_at')->get(),
            'sites' => CompanySite::whereIn('company_id', $companyIds)->get(),
            'jobs' => \App\Models\JobPost::whereIn('employer_user_id', $employers->pluck('id'))
                ->select('id', 'employer_user_id', 'company_id')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validateInput($request);

        $temporaryPassword = $data['password'] ?? Str::random(12);

        $user = DB::transaction(function () use ($data, $temporaryPassword) {
            $user = User::create([
                'full_name' => $data['contact_person_name'],
                'email' => $data['email'],
                'mobile' => $data['mobile'],
                'password' => Hash::make($temporaryPassword),
                'role' => 'employer',
                'profile_type' => 'employer',
                'account_status' => $data['account_status'] ?? 'active',
                'email_verified_at' => now(),
            ]);

            EmployerProfile::create([
                'user_id' => $user->id,
                'contact_person_name' => $data['contact_person_name'],
                'designation' => $data['designation'] ?? null,
                'city' => $data['city'],
                'state' => $data['state'],
                'pincode' => $data['pincode'],
                'profile_status' => 'complete',
                'verification_status' => 'pending',
                'created_from' => 'super_admin',
            ]);

            if (! empty($data['company_name'])) {
                EmployerCompany::create([
                    'employer_user_id' => $user->id,
                    'company_name' => $data['company_name'],
                    'business_type' => $data['business_type'] ?? null,
                    'gst_number' => $data['gst_number'] ?? null,
                    'pan_number' => $data['pan_number'] ?? null,
                    'website' => $data['website'] ?? null,
                    'registered_address' => $data['company_address'] ?? null,
                    'city' => $data['city'],
                    'state' => $data['state'],
                    'pincode' => $data['pincode'],
                    'verification_status' => 'pending',
                    'account_status' => 'active',
                ]);
            }

            return $user;
        });

        Mail::to($user->email)->queue(new EmployerWelcomeMail($user->full_name, $user->email, $temporaryPassword));

        return response()->json([
            'employer' => $user->load('employerProfile'),
            'temporary_password' => $temporaryPassword,
        ], 201);
    }

    public function update(Request $request, User $employer)
    {
        if ($employer->role !== 'employer') {
            return response()->json(['message' => 'Not an employer account.'], 404);
        }

        $data = $this->validateInput($request, employerId: $employer->id, sometimes: true);

        DB::transaction(function () use ($employer, $data) {
            $employer->update(array_intersect_key($data, array_flip([
                'full_name', 'email', 'mobile', 'account_status',
            ])) + array_filter([
                'full_name' => $data['contact_person_name'] ?? null,
            ]));

            if ($employer->employerProfile) {
                $employer->employerProfile->update(array_intersect_key($data, array_flip([
                    'contact_person_name', 'designation', 'city', 'state', 'pincode',
                ])));
            }

            $company = EmployerCompany::where('employer_user_id', $employer->id)->first();

            $companyFields = array_intersect_key($data, array_flip([
                'company_name', 'business_type', 'gst_number', 'pan_number', 'website',
                'company_address', 'city', 'state', 'pincode',
            ]));

            if ($company && ! empty($companyFields)) {
                if (isset($companyFields['company_address'])) {
                    $companyFields['registered_address'] = $companyFields['company_address'];
                    unset($companyFields['company_address']);
                }
                $company->update($companyFields);
            }
        });

        return response()->json($employer->fresh(['employerProfile']));
    }

    public function destroy(User $employer)
    {
        if ($employer->role !== 'employer') {
            return response()->json(['message' => 'Not an employer account.'], 404);
        }

        DB::transaction(function () use ($employer) {
            // Children are removed via cascadeOnDelete FKs where declared;
            // explicit deletes here guarantee order for tables without direct FKs to users.
            EmployerCompany::where('employer_user_id', $employer->id)->get()->each->delete();
            $employer->delete();
        });

        return response()->json(['message' => 'Employer deleted.']);
    }

    private function validateInput(Request $request, ?string $employerId = null, bool $sometimes = false): array
    {
        $rule = fn (string $r) => $sometimes ? ['sometimes', $r] : [$r];

        $data = $request->validate([
            'contact_person_name' => [...$rule('required'), 'string', 'min:2'],
            'mobile' => [...$rule('required'), 'regex:/^[6-9]\d{9}$/', Rule::unique('users', 'mobile')->ignore($employerId)],
            'email' => [...$rule('required'), 'email', Rule::unique('users', 'email')->ignore($employerId)],
            'password' => ['nullable', 'string', 'min:6'],
            'city' => [...$rule('required'), 'string'],
            'state' => [...$rule('required'), 'string'],
            'pincode' => [...$rule('required'), 'regex:/^\d{6}$/'],
            'designation' => ['nullable', 'string'],
            'company_name' => ['nullable', 'string'],
            'company_address' => ['nullable', 'string'],
            'business_type' => ['nullable', 'string'],
            'gst_number' => ['nullable', 'regex:/^[0-9A-Z]{15}$/'],
            'pan_number' => ['nullable', 'regex:/^[A-Z]{5}[0-9]{4}[A-Z]$/'],
            'website' => ['nullable', 'string'],
            'account_status' => ['nullable', Rule::in(['active', 'inactive', 'blocked', 'pending'])],
        ]);

        $hasCompany = ! empty($data['company_name']) || ! empty($data['company_address']) || ! empty($data['business_type']);

        if ($hasCompany) {
            Validator::make($data, [
                'company_name' => ['required', 'string'],
                'company_address' => ['required', 'string'],
                'business_type' => ['required', 'string'],
            ])->validate();
        }

        foreach (['gst_number', 'pan_number'] as $field) {
            if (! empty($data[$field])) {
                $data[$field] = strtoupper($data[$field]);
            }
        }

        return $data;
    }
}
