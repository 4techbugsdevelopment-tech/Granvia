<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employer_aadhaar_verifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('employer_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('aadhaar_number_hash')->nullable();
            $table->string('aadhaar_last_four')->nullable();
            $table->string('verification_status')->default('pending');
            $table->string('otp_hash')->nullable();
            $table->string('otp_sent_to')->nullable();
            $table->string('otp_channel')->default('email');
            $table->timestamp('otp_expires_at')->nullable();
            $table->timestamp('otp_verified_at')->nullable();
            $table->unsignedInteger('otp_attempts')->default(0);
            $table->unsignedInteger('resend_count')->default(0);
            $table->string('provider_name')->default('email_otp');
            $table->timestamps();

            $table->index('employer_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employer_aadhaar_verifications');
    }
};
