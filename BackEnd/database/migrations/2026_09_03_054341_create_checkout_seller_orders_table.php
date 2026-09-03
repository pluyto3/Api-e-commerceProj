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
        Schema::create('checkout_seller_orders', function (Blueprint $table) {
            $table->id('checkout_seller_order_id');

            $table->unsignedBigInteger('checkout_id');
            $table->unsignedBigInteger('seller_id');

            $table->string('shipping_status', 20)
                ->default('pending');

            $table->string('tracking_number', 100)
                ->nullable();

            $table->decimal('seller_subtotal', 12, 2)
                ->default(0);

            $table->timestamp('cancelled_at')
                ->nullable();

            $table->unsignedBigInteger('cancelled_by')
                ->nullable();

            $table->text('cancellation_reason')
                ->nullable();

            $table->timestamps();

            $table->unique(
                ['checkout_id', 'seller_id'],
                'checkout_seller_unique'
            );

            $table->foreign('checkout_id')
                ->references('checkout_id')
                ->on('checkouts')
                ->onDelete('cascade');

            $table->foreign('seller_id')
                ->references('user_id')
                ->on('users')
                ->onDelete('restrict');

            $table->foreign('cancelled_by')
                ->references('user_id')
                ->on('users')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('checkout_seller_orders');
    }
};