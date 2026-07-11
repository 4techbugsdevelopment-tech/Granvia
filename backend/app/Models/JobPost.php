<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JobPost extends Model
{
    use HasUuids;

    protected $fillable = [
        'employer_user_id', 'company_id', 'site_id', 'title', 'category', 'guard_type',
        'guards_required', 'gender_preference', 'experience_required', 'qualification_required', 'salary_amount',
        'payment_type', 'duty_hours', 'shift_type', 'start_date', 'end_date', 'duration_type',
        'required_skills', 'language_requirements', 'police_verification_required',
        'uniform_required', 'food_facility', 'accommodation_facility', 'description',
        'special_instructions', 'status', 'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'required_skills' => 'array',
            'language_requirements' => 'array',
            'police_verification_required' => 'boolean',
            'uniform_required' => 'boolean',
            'food_facility' => 'boolean',
            'accommodation_facility' => 'boolean',
        ];
    }

    public function employer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employer_user_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(EmployerCompany::class, 'company_id');
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(CompanySite::class, 'site_id');
    }

    public function applications(): HasMany
    {
        return $this->hasMany(JobApplication::class, 'job_id');
    }
}
