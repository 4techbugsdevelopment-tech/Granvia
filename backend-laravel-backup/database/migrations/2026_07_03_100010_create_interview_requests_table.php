<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->nullable()->constrained('job_applications')->nullOnDelete();
            $table->foreignUuid('job_id')->nullable()->constrained('job_posts')->nullOnDelete();
            $table->foreignUuid('guard_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('employer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('company_id')->nullable()->constrained('employer_companies')->nullOnDelete();
            $table->string('request_type')->default('Phone Call');
            $table->date('preferred_date')->nullable();
            $table->time('preferred_time')->nullable();
            $table->text('message')->nullable();
            $table->string('status')->default('requested');
            $table->timestamps();

            $table->index('employer_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_requests');
    }
};
