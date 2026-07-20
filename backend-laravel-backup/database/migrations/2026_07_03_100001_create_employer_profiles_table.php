<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employer_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('contact_person_name')->nullable();
            $table->string('designation')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('pincode')->nullable();
            $table->boolean('is_aadhaar_verified')->default(false);
            $table->string('aadhaar_verification_status')->default('pending');
            $table->timestamp('aadhaar_verified_at')->nullable();
            $table->string('aadhaar_last_four')->nullable();
            $table->string('profile_status')->default('incomplete');
            $table->string('verification_status')->default('pending');
            $table->text('admin_remarks')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->string('created_from')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employer_profiles');
    }
};
