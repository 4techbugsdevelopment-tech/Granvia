<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agreements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('offer_id')->nullable()->constrained('job_offers')->nullOnDelete();
            $table->foreignUuid('job_id')->nullable()->constrained('job_posts')->nullOnDelete();
            $table->foreignUuid('guard_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('employer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('site_id')->nullable()->constrained('company_sites')->nullOnDelete();
            $table->string('agreement_number')->unique();
            $table->string('title');
            $table->json('terms')->nullable();
            $table->date('effective_from')->nullable();
            $table->date('effective_until')->nullable();
            $table->timestamp('signed_at')->nullable();
            $table->string('status')->default('draft');
            $table->string('employer_confirmation_status')->default('pending');
            $table->string('guard_confirmation_status')->default('pending');
            $table->string('platform_confirmation_status')->default('pending');
            $table->timestamps();

            $table->index('employer_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agreements');
    }
};
