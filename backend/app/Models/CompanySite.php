<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanySite extends Model
{
    use HasUuids;

    protected $fillable = [
        'company_id', 'employer_user_id', 'site_name', 'code', 'address',
        'latitude', 'longitude', 'site_type', 'city', 'state', 'pincode',
        'contact_person', 'contact_mobile', 'shift_details', 'notes', 'status',
    ];

    protected function casts(): array
    {
        return [
            'address' => 'array',
            'latitude' => 'decimal:6',
            'longitude' => 'decimal:6',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(EmployerCompany::class, 'company_id');
    }
}
