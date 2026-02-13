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
        Schema::table('brands', function (Blueprint $table) {

            $table->text('description')->nullable()->after('image');

                // Make seller_id nullable first
                $table->unsignedBigInteger('seller_id')->nullable()->after('description');

                $table->enum('status', ['pending', 'approved', 'rejected'])
                    ->default('pending')
                    ->after('seller_id');

                $table->text('approval_reason')->nullable()->after('status');

                $table->unsignedBigInteger('approved_by')
                    ->nullable()
                    ->after('approval_reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('brands', function (Blueprint $table) {

            $table->dropForeign(['seller_id']);
            $table->dropForeign(['approved_by']);

            $table->dropColumn([
                'description',
                'seller_id',
                'status',
                'approval_reason',
                'approved_by'
            ]);
        });
    }
};
