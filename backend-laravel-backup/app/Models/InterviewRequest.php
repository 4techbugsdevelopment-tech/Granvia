<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InterviewRequest extends Model
{
    use HasUuids;

    protected $fillable = [
        'application_id', 'job_id', 'guard_user_id', 'employer_user_id', 'company_id',
        'request_type', 'preferred_date', 'preferred_time', 'message', 'status',
    ];

    protected function casts(): array
    {
        return ['preferred_date' => 'date'];
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
