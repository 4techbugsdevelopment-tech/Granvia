<?php

namespace App\Http\Controllers;

use App\Mail\AadhaarOtpMail;
use App\Models\GuardAadhaarVerification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

/**
 * Interim Aadhaar verification for guards via email OTP.
 * Swap the OTP send/verify internals for the client-provided Aadhaar API
 * when credentials are available — the route contract can stay the same.
 */
class GuardAadhaarController extends Controller
{
    public function status(Request $request)
    {
        $profile = $request->user()->guardProfile;

        if (! $profile) {
            return response()->json(['message' => 'Guard profile not found.'], 404);
        }

        $latest = GuardAadhaarVerification::where('guard_user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->first();

        return response()->json([
            'aadhaar_status' => $profile->aadhaar_status,
            'aadhaar_last_four' => $latest?->aadhaar_last_four,
            'verified_at' => $latest?->otp_verified_at,
        ]);
    }

    /**
     * Mock instant verification: entering a valid 12-digit Aadhaar number
     * approves immediately (no external provider yet). Swap for the real
     * Aadhaar API when credentials arrive — the route contract stays the same.
     */
    public function instantVerify(Request $request)
    {
        $data = $request->validate([
            'aadhaar_number' => ['required', 'regex:/^\d{12}$/'],
        ]);

        $user = $request->user();
        $lastFour = substr($data['aadhaar_number'], -4);

        DB::transaction(function () use ($user, $data, $lastFour) {
            GuardAadhaarVerification::create([
                'guard_user_id' => $user->id,
                'aadhaar_number_hash' => hash('sha256', $data['aadhaar_number']),
                'aadhaar_last_four' => $lastFour,
                'verification_status' => 'verified',
                'otp_verified_at' => now(),
                'provider_name' => 'mock_instant',
            ]);

            $user->guardProfile()->update(['aadhaar_status' => 'verified']);
        });

        return response()->json([
            'aadhaar_status' => 'verified',
            'aadhaar_last_four' => $lastFour,
            'verified_at' => now(),
        ]);
    }

    public function sendOtp(Request $request)
    {
        $data = $request->validate([
            'aadhaar_number' => ['required', 'regex:/^\d{12}$/'],
        ]);

        $user = $request->user();
        $otp = (string) random_int(100000, 999999);
        $lastFour = substr($data['aadhaar_number'], -4);

        $record = GuardAadhaarVerification::create([
            'guard_user_id' => $user->id,
            'aadhaar_number_hash' => hash('sha256', $data['aadhaar_number']),
            'aadhaar_last_four' => $lastFour,
            'verification_status' => 'otp_sent',
            'otp_hash' => Hash::make($otp),
            'otp_sent_to' => $user->email,
            'otp_channel' => 'email',
            'otp_expires_at' => now()->addMinutes(10),
            'provider_name' => 'email_otp',
        ]);

        $user->guardProfile()->update(['aadhaar_status' => 'otp_sent']);

        Mail::to($user->email)->queue(new AadhaarOtpMail($otp));

        $response = ['sent_to' => $user->email, 'verification_id' => $record->id];

        if (config('app.debug')) {
            $response['dev_otp'] = $otp;
        }

        return response()->json($response);
    }

    public function verifyOtp(Request $request)
    {
        $data = $request->validate([
            'otp' => ['required', 'regex:/^\d{6}$/'],
        ]);

        $user = $request->user();

        $record = GuardAadhaarVerification::where('guard_user_id', $user->id)
            ->orderByDesc('created_at')
            ->first();

        if (! $record || $record->verification_status !== 'otp_sent') {
            return response()->json(['message' => 'No OTP request found. Please request a new OTP.'], 422);
        }

        if ($record->otp_expires_at && $record->otp_expires_at->isPast()) {
            return response()->json(['message' => 'OTP has expired. Please request a new one.'], 422);
        }

        if (! Hash::check($data['otp'], $record->otp_hash)) {
            $record->increment('otp_attempts');

            return response()->json(['message' => 'Invalid OTP.'], 422);
        }

        DB::transaction(function () use ($record, $user) {
            $record->update([
                'verification_status' => 'verified',
                'otp_verified_at' => now(),
            ]);

            $user->guardProfile()->update(['aadhaar_status' => 'verified']);
        });

        return response()->json($user->guardProfile()->first());
    }
}
