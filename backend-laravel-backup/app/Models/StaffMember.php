<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffMember extends Model
{
    use HasUuids;

    protected $fillable = [
        'sub_admin_user_id', 'name', 'role', 'email', 'mobile', 'status', 'permissions',
    ];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
        ];
    }

    public function subAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sub_admin_user_id');
    }
}
