<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GuardDocument extends Model
{
    use HasUuids;

    protected $fillable = [
        'guard_user_id', 'document_type', 'file_path', 'file_name', 'mime_type',
        'file_size', 'status', 'admin_remarks', 'reviewed_by', 'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
        ];
    }

    public function guardUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'guard_user_id');
    }
}
