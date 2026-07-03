<?php

namespace App\Http\Controllers;

use App\Mail\AadhaarOtpMail;
use App\Models\EmployerAadhaarVerification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

class AadhaarVerificationController extends Controller
{
    public function status(Request $request)
    {
        $profile = $request->user()->employerProfile;

        if (! $profile) {
            return response()->json(['message' => 'Employer profile not found.'], 404);
        }

        return response()->json([
            'is_aadhaar_verified' => $profile->is_aadhaar_verified,
            'aadhaar_verification_status' => $profile->aadhaar_verification_status,
            'aadhaar_verified_at' => $profile->aadhaar_verified_at,
            'aadhaar_last_four' => $profile->aadhaar_last_four,
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

        $record = EmployerAadhaarVerification::create([
            'employer_user_id' => $user->id,
            'aadhaar_number_hash' => hash('sha256', $data['aadhaar_number']),
            'aadhaar_last_four' => $lastFour,
            'verification_status' => 'otp_sent',
            'otp_hash' => Hash::make($otp),
            'otp_sent_to' => $user->email,
            'otp_channel' => 'email',
            'otp_expires_at' => now()->addMinutes(10),
            'provider_name' => 'email_otp',
        ]);

        $user->employerProfile()->update([
            'aadhaar_verification_status' => 'otp_sent',
            'aadhaar_last_four' => $lastFour,
            'is_aadhaar_verified' => false,
        ]);

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

        $record = EmployerAadhaarVerification::where('employer_user_id', $user->id)
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

            $user->employerProfile()->update([
                'is_aadhaar_verified' => true,
                'aadhaar_verification_status' => 'verified',
                'aadhaar_verified_at' => now(),
            ]);
        });

        return response()->json($user->employerProfile);
    }
}
