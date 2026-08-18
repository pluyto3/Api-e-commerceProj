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
        Schema::create('product_edit_requests', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('seller_id');

            $table->unsignedBigInteger('category_id');
            $table->unsignedBigInteger('brand_id');

            $table->string('product_name');
            $table->decimal('product_price', 10, 2);
            $table->text('product_description')->nullable();
            $table->string('image')->nullable();

            $table->string('request_status')->default('pending');

            $table->text('rejection_reason')->nullable();

            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();

            $table->timestamps();

            $table->foreign('product_id')
                ->references('product_id')
                ->on('products')
                ->onDelete('cascade');

            $table->foreign('seller_id')
                ->references('user_id')
                ->on('users')
                ->onDelete('cascade');
                });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_edit_requests');
    }
};
