<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use HasUuids;

    protected $fillable = [
        'employer_user_id', 'company_id', 'invoice_number', 'amount', 'tax_amount',
        'total_amount', 'payment_status', 'invoice_date', 'due_date', 'paid_at', 'description',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'invoice_date' => 'date',
            'due_date' => 'date',
            'paid_at' => 'datetime',
        ];
    }
}
