<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('checkout_items', function (Blueprint $table) {
            $table->unsignedBigInteger('seller_id')->nullable()->after('product_id');

            $table->foreign('seller_id')
                  ->references('user_id')
                  ->on('users')
                  ->onUpdate('cascade')
                  ->nullOnDelete();
        });

        // Backfill existing checkout items from product ownership.
        DB::statement("
            UPDATE checkout_items ci
            INNER JOIN products p ON p.product_id = ci.product_id
            SET ci.seller_id = p.seller_id
            WHERE ci.seller_id IS NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('checkout_items', function (Blueprint $table) {
            $table->dropForeign(['seller_id']);
            $table->dropColumn('seller_id');
        });
    }
};
