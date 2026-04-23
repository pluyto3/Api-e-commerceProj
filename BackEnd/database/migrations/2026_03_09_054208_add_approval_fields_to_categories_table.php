<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function foreignKeyExists(string $table, string $constraintName): bool
    {
        return DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', DB::getDatabaseName())
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_NAME', $constraintName)
            ->where('CONSTRAINT_TYPE', 'FOREIGN KEY')
            ->exists();
    }

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (!Schema::hasColumn('categories', 'seller_id')) {
                $table->unsignedBigInteger('seller_id')->nullable()->after('description');
            }

            if (!Schema::hasColumn('categories', 'status')) {
                $table->enum('status', ['pending','approved','rejected'])
                      ->default('pending')
                      ->after('seller_id');
            }

            if (!Schema::hasColumn('categories', 'approval_reason')) {
                $table->text('approval_reason')->nullable()->after('status');
            }

            if (!Schema::hasColumn('categories', 'approved_by')) {
                $table->unsignedBigInteger('approved_by')->nullable()->after('approval_reason');
            }
        });

        Schema::table('categories', function (Blueprint $table) {
            if (
                Schema::hasColumn('categories', 'seller_id') &&
                !$this->foreignKeyExists('categories', 'categories_seller_id_foreign')
            ) {
                $table->foreign('seller_id')
                    ->references('user_id')
                    ->on('users')
                    ->onDelete('cascade');
            }

            if (
                Schema::hasColumn('categories', 'approved_by') &&
                !$this->foreignKeyExists('categories', 'categories_approved_by_foreign')
            ) {
                $table->foreign('approved_by')
                    ->references('user_id')
                    ->on('users')
                    ->nullOnDelete();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if ($this->foreignKeyExists('categories', 'categories_seller_id_foreign')) {
                $table->dropForeign('categories_seller_id_foreign');
            }

            if ($this->foreignKeyExists('categories', 'categories_approved_by_foreign')) {
                $table->dropForeign('categories_approved_by_foreign');
            }
        });

        $columns = array_values(array_filter([
            'seller_id',
            'status',
            'approval_reason',
            'approved_by',
        ], fn ($column) => Schema::hasColumn('categories', $column)));

        if (!empty($columns)) {
            Schema::table('categories', function (Blueprint $table) use ($columns) {
                $table->dropColumn($columns);
            });
        }
    }
};
