<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_posts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('employer_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('company_id')->nullable()->constrained('employer_companies')->nullOnDelete();
            $table->foreignUuid('site_id')->nullable()->constrained('company_sites')->nullOnDelete();
            $table->string('title');
            $table->string('category')->nullable();
            $table->string('guard_type')->nullable();
            $table->unsignedInteger('guards_required')->default(1);
            $table->string('gender_preference')->default('Any');
            $table->string('experience_required')->nullable();
            $table->decimal('salary_amount', 12, 2)->nullable();
            $table->string('payment_type')->nullable();
            $table->string('duty_hours')->nullable();
            $table->string('shift_type')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('duration_type')->nullable();
            $table->json('required_skills')->nullable();
            $table->json('language_requirements')->nullable();
            $table->boolean('police_verification_required')->default(false);
            $table->boolean('uniform_required')->default(false);
            $table->boolean('food_facility')->default(false);
            $table->boolean('accommodation_facility')->default(false);
            $table->text('description')->nullable();
            $table->text('special_instructions')->nullable();
            $table->string('status')->default('draft');
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index('employer_user_id');
            $table->index('company_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_posts');
    }
};
