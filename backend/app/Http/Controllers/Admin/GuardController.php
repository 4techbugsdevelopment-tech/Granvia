<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GuardProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class GuardController extends Controller
{
    public function index(Request $request)
    {
        $query = User::where('role', 'guard')->with('guardProfile');

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('mobile', 'like', "%{$search}%");
            });
        }

        if ($request->filled('account_status')) {
            $query->where('account_status', $request->query('account_status'));
        }

        return response()->json($query->orderByDesc('created_at')->get());
    }

    public function store(Request $request)
    {
        $data = $this->validateInput($request);

        $temporaryPassword = $data['password'] ?? Str::random(12);

        $user = DB::transaction(function () use ($data, $temporaryPassword) {
            $user = User::create([
                'full_name' => $data['full_name'],
                'email' => $data['email'],
                'mobile' => $data['mobile'],
                'password' => Hash::make($temporaryPassword),
                'role' => 'guard',
                'profile_type' => 'guard',
                'account_status' => $data['account_status'] ?? 'active',
                'email_verified_at' => now(),
            ]);

            GuardProfile::create([
                'user_id' => $user->id,
                'full_name' => $data['full_name'],
                'mobile' => $data['mobile'],
                'gender' => $data['gender'] ?? null,
                'dob' => $data['dob'] ?? null,
                'address' => $data['address'] ?? null,
                'city' => $data['city'] ?? null,
                'state' => $data['state'] ?? null,
                'pincode' => $data['pincode'] ?? null,
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'skills' => $data['skills'] ?? null,
                'languages' => $data['languages'] ?? null,
                'experience' => $data['experience'] ?? null,
                'verification_status' => 'pending',
            ]);

            return $user;
        });

        return response()->json([
            'user' => $user->load('guardProfile'),
            'temporary_password' => empty($data['password']) ? $temporaryPassword : null,
        ], 201);
    }

    public function update(Request $request, User $guard)
    {
        if ($guard->role !== 'guard') {
            return response()->json(['message' => 'Not a guard account.'], 404);
        }

        $data = $this->validateInput($request, guardId: $guard->id, sometimes: true);

        DB::transaction(function () use ($guard, $data) {
            $guard->update(array_intersect_key($data, array_flip([
                'full_name', 'email', 'mobile', 'account_status',
            ])));

            $profileFields = array_intersect_key($data, array_flip([
                'full_name', 'mobile', 'gender', 'dob', 'address', 'city', 'state', 'pincode',
                'latitude', 'longitude', 'skills', 'languages', 'experience', 'verification_status',
            ]));

            if ($profileFields) {
                GuardProfile::updateOrCreate(['user_id' => $guard->id], $profileFields);
            }
        });

        return response()->json($guard->fresh()->load('guardProfile'));
    }

    private function validateInput(Request $request, ?string $guardId = null, bool $sometimes = false): array
    {
        $rule = fn (string $r) => $sometimes ? ['sometimes', $r] : [$r];

        return $request->validate([
            'full_name' => [...$rule('required'), 'string', 'min:2'],
            'email' => [...$rule('required'), 'email', Rule::unique('users', 'email')->ignore($guardId)],
            'mobile' => [...$rule('required'), 'regex:/^[6-9]\d{9}$/', Rule::unique('users', 'mobile')->ignore($guardId)],
            'password' => ['nullable', 'string', 'min:8'],
            'gender' => ['nullable', 'string'],
            'dob' => ['nullable', 'date'],
            'address' => ['nullable', 'string'],
            'city' => ['nullable', 'string'],
            'state' => ['nullable', 'string'],
            'pincode' => ['nullable', 'regex:/^\d{6}$/'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'skills' => ['nullable', 'array'],
            'skills.*' => ['string'],
            'languages' => ['nullable', 'array'],
            'languages.*' => ['string'],
            'experience' => ['nullable', 'string'],
            'verification_status' => ['nullable', Rule::in(['pending', 'verified', 'rejected'])],
            'account_status' => ['nullable', Rule::in(['active', 'inactive', 'blocked', 'pending'])],
        ]);
    }
}
