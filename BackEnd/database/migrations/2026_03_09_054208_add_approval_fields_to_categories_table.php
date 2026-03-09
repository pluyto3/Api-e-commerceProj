<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->unsignedBigInteger('seller_id')->nullable()->after('description');

            $table->enum('status', ['pending','approved','rejected'])
                  ->default('pending')
                  ->after('seller_id');

            $table->text('approval_reason')->nullable()->after('status');

            $table->unsignedBigInteger('approved_by')->nullable()->after('approval_reason');

            $table->foreign('seller_id')->references('user_id')->on('users')->onDelete('cascade');

            $table->foreign('approved_by')->references('user_id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
                        $table->dropForeign(['seller_id']);
            $table->dropForeign(['approved_by']);

            $table->dropColumn([
                'seller_id',
                'status',
                'approval_reason',
                'approved_by'
            ]);
        });
    }
};
