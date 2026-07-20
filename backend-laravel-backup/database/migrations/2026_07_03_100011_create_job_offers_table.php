<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_offers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->nullable()->constrained('job_applications')->nullOnDelete();
            $table->foreignUuid('job_id')->nullable()->constrained('job_posts')->nullOnDelete();
            $table->foreignUuid('guard_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('employer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('company_id')->nullable()->constrained('employer_companies')->nullOnDelete();
            $table->foreignUuid('site_id')->nullable()->constrained('company_sites')->nullOnDelete();
            $table->decimal('offered_salary', 12, 2)->nullable();
            $table->string('duty_hours')->nullable();
            $table->string('shift_type')->nullable();
            $table->date('start_date')->nullable();
            $table->text('terms_summary')->nullable();
            $table->string('status')->default('sent');
            $table->timestamps();

            $table->index('employer_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_offers');
    }
};
