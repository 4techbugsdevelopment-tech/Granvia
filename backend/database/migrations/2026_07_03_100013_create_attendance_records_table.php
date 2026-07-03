<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_records', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('guard_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('employer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('company_id')->nullable()->constrained('employer_companies')->nullOnDelete();
            $table->foreignUuid('job_id')->nullable()->constrained('job_posts')->nullOnDelete();
            $table->foreignUuid('site_id')->nullable()->constrained('company_sites')->nullOnDelete();
            $table->date('attendance_date');
            $table->timestamp('in_time')->nullable();
            $table->timestamp('out_time')->nullable();
            $table->decimal('total_hours', 6, 2)->nullable();
            $table->string('status')->default('pending_verification');
            $table->text('employer_remarks')->nullable();
            $table->text('guard_remarks')->nullable();
            $table->timestamps();

            $table->index('guard_user_id');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_records');
    }
};
