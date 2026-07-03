<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GuardProfile extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'full_name', 'mobile', 'gender', 'dob', 'address', 'city', 'state', 'pincode',
        'latitude', 'longitude', 'skills', 'languages', 'experience', 'aadhaar_status',
        'police_verification_status', 'verification_status', 'bank_account_number',
        'bank_ifsc', 'bank_name', 'account_holder_name', 'avatar_url',
    ];

    protected function casts(): array
    {
        return [
            'dob' => 'date',
            'latitude' => 'decimal:6',
            'longitude' => 'decimal:6',
            'skills' => 'array',
            'languages' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
