<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Agreement extends Model
{
    use HasUuids;

    protected $fillable = [
        'offer_id', 'job_id', 'guard_user_id', 'employer_user_id', 'site_id',
        'agreement_number', 'title', 'terms', 'effective_from', 'effective_until',
        'signed_at', 'status', 'employer_confirmation_status', 'guard_confirmation_status',
        'platform_confirmation_status',
    ];

    protected function casts(): array
    {
        return [
            'terms' => 'array',
            'effective_from' => 'date',
            'effective_until' => 'date',
            'signed_at' => 'datetime',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(JobPost::class, 'job_id');
    }

    public function guardProfile(): BelongsTo
    {
        return $this->belongsTo(GuardProfile::class, 'guard_user_id', 'user_id');
    }
}
