<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class GuardAadhaarVerification extends Model
{
    use HasUuids;

    protected $fillable = [
        'guard_user_id', 'aadhaar_number_hash', 'aadhaar_last_four', 'verification_status',
        'otp_hash', 'otp_sent_to', 'otp_channel', 'otp_expires_at', 'otp_verified_at',
        'otp_attempts', 'resend_count', 'provider_name',
    ];

    protected function casts(): array
    {
        return [
            'otp_expires_at' => 'datetime',
            'otp_verified_at' => 'datetime',
        ];
    }
}
