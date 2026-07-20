<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasUuids;

    protected $fillable = [
        'guard_user_id', 'employer_user_id', 'job_id', 'application_id',
        'amount', 'payment_method', 'payment_status', 'payment_date',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'payment_date' => 'datetime',
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
