<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('job_id')->constrained('job_posts')->cascadeOnDelete();
            $table->foreignUuid('guard_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('employer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('company_id')->nullable()->constrained('employer_companies')->nullOnDelete();
            $table->foreignUuid('site_id')->nullable()->constrained('company_sites')->nullOnDelete();
            $table->text('cover_note')->nullable();
            $table->string('status')->default('pending');
            $table->timestamp('applied_at')->useCurrent();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignUuid('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('job_id');
            $table->index('guard_user_id');
            $table->index('employer_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_applications');
    }
};
