<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmployerCompany extends Model
{
    use HasUuids;

    protected $fillable = [
        'employer_user_id', 'company_name', 'business_type', 'registration_type',
        'gst_number', 'pan_number', 'company_email', 'company_phone', 'website',
        'logo_url', 'description', 'registered_address', 'billing_address',
        'city', 'state', 'pincode', 'verification_status', 'account_status',
        'admin_remarks', 'rejection_reason',
    ];

    public function employer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employer_user_id');
    }

    public function sites(): HasMany
    {
        return $this->hasMany(CompanySite::class, 'company_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(CompanyDocument::class, 'company_id');
    }

    public function jobPosts(): HasMany
    {
        return $this->hasMany(JobPost::class, 'company_id');
    }
}
