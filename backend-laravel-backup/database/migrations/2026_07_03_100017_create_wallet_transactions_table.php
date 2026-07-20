<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('wallet_id')->constrained('employer_wallets')->cascadeOnDelete();
            $table->foreignUuid('employer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('transaction_type')->default('credit');
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('purpose')->nullable();
            $table->string('status')->default('completed');
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();

            $table->index('wallet_id');
            $table->index('employer_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallet_transactions');
    }
};
