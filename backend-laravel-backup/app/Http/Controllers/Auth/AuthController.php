<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterEmployerRequest;
use App\Http\Requests\Auth\RegisterGuardRequest;
use App\Mail\EmployerWelcomeMail;
use App\Models\EmployerCompany;
use App\Models\EmployerProfile;
use App\Models\GuardProfile;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function registerEmployer(RegisterEmployerRequest $request)
    {
        $data = $request->validated();

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'full_name' => $data['contact_person_name'],
                'email' => $data['email'],
                'mobile' => $data['mobile'],
                'password' => Hash::make($data['password']),
                'role' => 'employer',
                'profile_type' => 'employer',
                'account_status' => 'active',
            ]);

            EmployerProfile::create([
                'user_id' => $user->id,
                'contact_person_name' => $data['contact_person_name'],
                'city' => $data['city'],
                'state' => $data['state'],
                'pincode' => $data['pincode'],
                'profile_status' => 'incomplete',
                'verification_status' => 'pending',
                'created_from' => 'app',
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

        event(new Registered($user));

        return response()->json([
            'message' => 'Registration submitted. Please verify your email address using the link sent to your inbox.',
            'user' => ['id' => $user->id, 'email' => $user->email],
        ], 201);
    }

    public function registerGuard(RegisterGuardRequest $request)
    {
        $data = $request->validated();

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'full_name' => $data['full_name'],
                'email' => $data['email'],
                'mobile' => $data['mobile'],
                'password' => Hash::make($data['password']),
                'role' => 'guard',
                'profile_type' => 'guard',
                'account_status' => 'active',
            ]);

            GuardProfile::create([
                'user_id' => $user->id,
                'full_name' => $data['full_name'],
                'mobile' => $data['mobile'],
                'gender' => $data['gender'] ?? null,
                'city' => $data['city'] ?? null,
                'state' => $data['state'] ?? null,
                'pincode' => $data['pincode'] ?? null,
                'verification_status' => 'pending',
            ]);

            return $user;
        });

        event(new Registered($user));

        return response()->json([
            'message' => 'Registration submitted. Please verify your email address using the link sent to your inbox.',
            'user' => ['id' => $user->id, 'email' => $user->email],
        ], 201);
    }

    public function login(LoginRequest $request)
    {
        $data = $request->validated();

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials.'], 422);
        }

        if ($user->role !== $data['role']) {
            return response()->json(['message' => 'This account is not registered for this portal.'], 403);
        }

        if ($user->account_status !== 'active') {
            return response()->json(['message' => 'Your account is '.$user->account_status.'. Contact support.'], 403);
        }

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            ...$this->meResponse($user),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request)
    {
        return response()->json($this->meResponse($request->user()));
    }

    public function resendVerification(Request $request)
    {
        $user = Auth::guard('sanctum')->user();

        if (! $user) {
            $data = $request->validate(['email' => ['required', 'email']]);
            $user = User::where('email', $data['email'])->first();
        }

        if ($user && ! $user->hasVerifiedEmail()) {
            $user->sendEmailVerificationNotification();
        }

        return response()->json(['message' => 'If an account exists, a verification link has been sent.']);
    }

    public function verifyEmail(Request $request, string $id, string $hash)
    {
        $user = User::findOrFail($id);

        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            abort(403, 'Invalid verification link.');
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();

            if ($user->role === 'employer') {
                Mail::to($user->email)->queue(new EmployerWelcomeMail($user->full_name, $user->email));
            }
        }

        return redirect(rtrim(config('app.frontend_url'), '/').'/email-verified');
    }

    private function meResponse(User $user): array
    {
        $user->loadMissing(['employerProfile', 'guardProfile']);

        return [
            'user' => [
                'id' => $user->id,
                'full_name' => $user->full_name,
                'email' => $user->email,
                'mobile' => $user->mobile,
                'role' => $user->role,
                'profile_type' => $user->profile_type,
                'account_status' => $user->account_status,
                'avatar_url' => $user->avatar_url,
                'email_verified' => $user->hasVerifiedEmail(),
                'created_at' => $user->created_at,
            ],
            'employer_profile' => $user->employerProfile,
            'guard_profile' => $user->guardProfile,
        ];
    }
}
