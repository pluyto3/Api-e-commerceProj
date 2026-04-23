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
            if (Schema::hasColumn('products', 'amount') && !Schema::hasColumn('products', 'stock_quantity')) {
                DB::statement('ALTER TABLE products CHANGE amount stock_quantity INT');
            }

            if (!Schema::hasColumn('products', 'status')) {
                $table->enum('status', ['active', 'inactive', 'out_of_stock'])->default('active')->after('image');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'stock_quantity') && !Schema::hasColumn('products', 'amount')) {
                DB::statement('ALTER TABLE products CHANGE stock_quantity amount INT');
            }

            if (Schema::hasColumn('products', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};
