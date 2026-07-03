<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanyDocument extends Model
{
    use HasUuids;

    protected $fillable = [
        'company_id', 'employer_user_id', 'document_type', 'file_path', 'file_url',
        'file_size', 'file_type', 'verification_status', 'admin_remarks', 'rejection_reason',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(EmployerCompany::class, 'company_id');
    }
}
