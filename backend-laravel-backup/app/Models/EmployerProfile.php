<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployerProfile extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'contact_person_name', 'designation', 'city', 'state', 'pincode',
        'is_aadhaar_verified', 'aadhaar_verification_status', 'aadhaar_verified_at',
        'aadhaar_last_four', 'profile_status', 'verification_status',
        'admin_remarks', 'rejection_reason', 'created_from',
        'sales_executive_id', 'sub_admin_id', 'billing_status', 'base_hourly_rate',
    ];

    protected function casts(): array
    {
        return [
            'is_aadhaar_verified' => 'boolean',
            'aadhaar_verified_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
