<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('employer_companies')->cascadeOnDelete();
            $table->foreignUuid('employer_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('document_type')->nullable();
            $table->string('file_path');
            $table->string('file_url')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('file_type')->nullable();
            $table->string('verification_status')->default('pending');
            $table->text('admin_remarks')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_documents');
    }
};
