<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employer_companies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('employer_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('company_name');
            $table->string('business_type')->nullable();
            $table->string('registration_type')->nullable();
            $table->string('gst_number')->nullable();
            $table->string('pan_number')->nullable();
            $table->string('company_email')->nullable();
            $table->string('company_phone')->nullable();
            $table->string('website')->nullable();
            $table->string('logo_url')->nullable();
            $table->text('description')->nullable();
            $table->string('registered_address')->nullable();
            $table->string('billing_address')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('pincode')->nullable();
            $table->string('verification_status')->default('pending');
            $table->string('account_status')->default('active');
            $table->text('admin_remarks')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index('employer_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employer_companies');
    }
};
