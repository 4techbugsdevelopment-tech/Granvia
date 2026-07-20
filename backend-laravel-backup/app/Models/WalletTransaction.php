<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WalletTransaction extends Model
{
    use HasUuids;

    protected $fillable = [
        'wallet_id', 'employer_user_id', 'transaction_type', 'amount', 'purpose', 'status', 'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'posted_at' => 'datetime',
        ];
    }

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(EmployerWallet::class, 'wallet_id');
    }
}
