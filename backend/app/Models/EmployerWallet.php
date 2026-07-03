<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmployerWallet extends Model
{
    use HasUuids;

    protected $fillable = ['employer_user_id', 'balance', 'currency', 'status'];

    protected function casts(): array
    {
        return ['balance' => 'decimal:2'];
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(WalletTransaction::class, 'wallet_id');
    }
}
