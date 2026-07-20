<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JobApplication extends Model
{
    use HasUuids;

    protected $fillable = [
        'job_id', 'guard_user_id', 'employer_user_id', 'company_id', 'site_id',
        'cover_note', 'status', 'applied_at', 'reviewed_at', 'reviewed_by', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'applied_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(JobPost::class, 'job_id');
    }

    public function guardUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'guard_user_id');
    }

    public function guardProfile(): BelongsTo
    {
        return $this->belongsTo(GuardProfile::class, 'guard_user_id', 'user_id');
    }

    public function statusLogs(): HasMany
    {
        return $this->hasMany(ApplicationStatusLog::class, 'application_id');
    }
}
