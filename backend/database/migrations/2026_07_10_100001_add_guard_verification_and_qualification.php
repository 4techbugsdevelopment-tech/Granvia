<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('guard_profiles', function (Blueprint $table) {
            $table->string('qualification')->nullable()->after('experience');
            $table->unsignedInteger('search_radius_km')->default(10)->after('longitude');
        });

        Schema::table('job_posts', function (Blueprint $table) {
            $table->string('qualification_required')->nullable()->after('experience_required');
        });

        Schema::create('guard_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('guard_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('document_type'); // id_proof | police_verification | bank_proof | other
            $table->string('file_path');
            $table->string('file_name');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('status')->default('pending'); // pending | verified | rejected
            $table->text('admin_remarks')->nullable();
            $table->foreignUuid('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['guard_user_id', 'document_type']);
        });

        Schema::create('guard_aadhaar_verifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('guard_user_id')->constrained('users')->cascadeOnDelete();
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

            $table->index('guard_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guard_aadhaar_verifications');
        Schema::dropIfExists('guard_documents');

        Schema::table('job_posts', function (Blueprint $table) {
            $table->dropColumn('qualification_required');
        });

        Schema::table('guard_profiles', function (Blueprint $table) {
            $table->dropColumn(['qualification', 'search_radius_km']);
        });
    }
};
