<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('guard_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('employer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('job_id')->nullable()->constrained('job_posts')->nullOnDelete();
            $table->foreignUuid('application_id')->nullable()->constrained('job_applications')->nullOnDelete();
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('payment_method')->nullable();
            $table->string('payment_status')->default('pending');
            $table->timestamp('payment_date')->nullable();
            $table->timestamps();

            $table->index('employer_user_id');
            $table->index('guard_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
