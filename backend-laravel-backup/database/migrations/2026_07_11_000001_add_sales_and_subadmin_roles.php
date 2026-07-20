<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Extend the role enum to include the two new platform roles.
        DB::statement("ALTER TABLE users MODIFY role ENUM('super_admin','employer','guard','sub_admin','sales_executive') NOT NULL");

        // Scope employers (clients) to a sales executive and/or a sub admin branch.
        Schema::table('employer_profiles', function (Blueprint $table) {
            $table->foreignUuid('sales_executive_id')->nullable()->after('created_from')->constrained('users')->nullOnDelete();
            $table->foreignUuid('sub_admin_id')->nullable()->after('sales_executive_id')->constrained('users')->nullOnDelete();
            $table->string('billing_status')->default('current')->after('sub_admin_id'); // current | overdue | on_hold
            $table->decimal('base_hourly_rate', 8, 2)->nullable()->after('billing_status');
        });

        // Scope service partners (guards) to a sub admin branch.
        Schema::table('guard_profiles', function (Blueprint $table) {
            $table->foreignUuid('sub_admin_id')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
        });

        // Sub admin's own branch/company profile.
        Schema::create('sub_admin_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('branch_name');
            $table->string('registration_no')->nullable();
            $table->string('gst_number')->nullable();
            $table->string('address')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('phone')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });

        // Internal staff managed by a sub admin.
        Schema::create('staff_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('sub_admin_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('role');
            $table->string('email')->nullable();
            $table->string('mobile')->nullable();
            $table->string('status')->default('Active'); // Active | Inactive
            $table->json('permissions')->nullable();
            $table->timestamps();

            $table->index('sub_admin_user_id');
        });

        // Discounts applied by a sales executive to a client's billing.
        Schema::create('discounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('sales_executive_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('employer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('label');
            $table->string('discount_type')->default('percentage'); // percentage | flat
            $table->decimal('value', 8, 2)->default(0);
            $table->string('applies_to')->nullable();
            $table->string('status')->default('Active'); // Active | Expired
            $table->timestamps();

            $table->index('sales_executive_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discounts');
        Schema::dropIfExists('staff_members');
        Schema::dropIfExists('sub_admin_profiles');

        Schema::table('guard_profiles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sub_admin_id');
        });

        Schema::table('employer_profiles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sales_executive_id');
            $table->dropConstrainedForeignId('sub_admin_id');
            $table->dropColumn(['billing_status', 'base_hourly_rate']);
        });

        DB::statement("ALTER TABLE users MODIFY role ENUM('super_admin','employer','guard') NOT NULL");
    }
};
