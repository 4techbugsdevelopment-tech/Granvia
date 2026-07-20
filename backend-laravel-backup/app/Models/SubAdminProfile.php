<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubAdminProfile extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'branch_name', 'registration_no', 'gst_number',
        'address', 'contact_email', 'phone',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
