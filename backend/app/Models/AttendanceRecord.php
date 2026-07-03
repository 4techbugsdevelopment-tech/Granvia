<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceRecord extends Model
{
    use HasUuids;

    protected $fillable = [
        'guard_user_id', 'employer_user_id', 'company_id', 'job_id', 'site_id',
        'attendance_date', 'in_time', 'out_time', 'total_hours', 'status',
        'employer_remarks', 'guard_remarks',
    ];

    protected function casts(): array
    {
        return [
            'attendance_date' => 'date',
            'in_time' => 'datetime',
            'out_time' => 'datetime',
        ];
    }

    public function guardProfile(): BelongsTo
    {
        return $this->belongsTo(GuardProfile::class, 'guard_user_id', 'user_id');
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(JobPost::class, 'job_id');
    }
}
