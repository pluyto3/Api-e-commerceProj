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
        Schema::table('products', function (Blueprint $table) {
            DB::statement('ALTER TABLE products CHANGE amount stock_quantity INT');
            $table->enum('status', ['active', 'inactive', 'out_of_stock'])->default('active')->after('image');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->renameColumn('stock_quantity', 'amount');
            $table->dropColumn('status');
        });
    }
};
