<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ApplicationStatusLog extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = ['application_id', 'changed_by', 'old_status', 'new_status', 'remarks', 'created_at'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
