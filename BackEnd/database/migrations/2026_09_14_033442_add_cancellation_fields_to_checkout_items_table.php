<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('checkout_items', function (Blueprint $table) {
            $table->string('item_status', 20)
                ->default('pending')
                ->after('subtotal')
                ->index();

            $table->timestamp('cancelled_at')
                ->nullable()
                ->after('item_status');

            $table->unsignedBigInteger('cancelled_by')
                ->nullable()
                ->after('cancelled_at');

            $table->text('cancellation_reason')
                ->nullable()
                ->after('cancelled_by');

            $table->timestamp('stock_restored_at')
                ->nullable()
                ->after('cancellation_reason');

            $table->foreign('cancelled_by')
                ->references('user_id')
                ->on('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('checkout_items', function (Blueprint $table) {
            $table->dropForeign(['cancelled_by']);

            $table->dropColumn([
                'item_status',
                'cancelled_at',
                'cancelled_by',
                'cancellation_reason',
                'stock_restored_at',
            ]);
        });
    }
};