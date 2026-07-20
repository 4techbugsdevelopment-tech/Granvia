<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Discount extends Model
{
    use HasUuids;

    protected $fillable = [
        'sales_executive_user_id', 'employer_user_id', 'label',
        'discount_type', 'value', 'applies_to', 'status',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
        ];
    }

    public function salesExecutive(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_executive_user_id');
    }

    public function employer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employer_user_id');
    }
}
