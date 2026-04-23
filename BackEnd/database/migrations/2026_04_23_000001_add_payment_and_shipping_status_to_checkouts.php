<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function indexExists(string $table, string $indexName): bool
    {
        return DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', DB::getDatabaseName())
            ->where('TABLE_NAME', $table)
            ->where('INDEX_NAME', $indexName)
            ->exists();
    }

    private function foreignKeyExists(string $table, string $constraintName): bool
    {
        return DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', DB::getDatabaseName())
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_NAME', $constraintName)
            ->where('CONSTRAINT_TYPE', 'FOREIGN KEY')
            ->exists();
    }

    private function columnsExist(string $table, array $columns): bool
    {
        foreach ($columns as $column) {
            if (!Schema::hasColumn($table, $column)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('checkouts', function (Blueprint $table) {
            if (!Schema::hasColumn('checkouts', 'payment_status')) {
                $table->string('payment_status', 20)->default('pending')->after('payment_method');
            }

            if (!Schema::hasColumn('checkouts', 'shipping_status')) {
                $table->string('shipping_status', 20)->default('pending')->after('status');
            }

            if (!Schema::hasColumn('checkouts', 'cancelled_at')) {
                $table->timestamp('cancelled_at')->nullable()->after('tracking_number');
            }

            if (!Schema::hasColumn('checkouts', 'cancelled_by')) {
                $table->unsignedBigInteger('cancelled_by')->nullable()->after('cancelled_at');
            }

            if (!Schema::hasColumn('checkouts', 'cancellation_reason')) {
                $table->text('cancellation_reason')->nullable()->after('cancelled_by');
            }
        });

        Schema::table('checkouts', function (Blueprint $table) {
            if (
                Schema::hasColumn('checkouts', 'payment_status') &&
                !$this->indexExists('checkouts', 'checkouts_payment_status_index')
            ) {
                $table->index('payment_status', 'checkouts_payment_status_index');
            }

            if (
                Schema::hasColumn('checkouts', 'shipping_status') &&
                !$this->indexExists('checkouts', 'checkouts_shipping_status_index')
            ) {
                $table->index('shipping_status', 'checkouts_shipping_status_index');
            }

            if (
                Schema::hasColumn('checkouts', 'cancelled_by') &&
                !$this->foreignKeyExists('checkouts', 'checkouts_cancelled_by_foreign')
            ) {
                $table->foreign('cancelled_by')
                    ->references('user_id')
                    ->on('users')
                    ->nullOnDelete();
            }
        });

        if (
            $this->columnsExist('products', ['approval_status', 'status', 'stock_quantity']) &&
            !$this->indexExists('products', 'products_public_visibility_index')
        ) {
            Schema::table('products', function (Blueprint $table) {
                $table->index(
                    ['approval_status', 'status', 'stock_quantity'],
                    'products_public_visibility_index'
                );
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if ($this->indexExists('products', 'products_public_visibility_index')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropIndex('products_public_visibility_index');
            });
        }

        Schema::table('checkouts', function (Blueprint $table) {
            if ($this->foreignKeyExists('checkouts', 'checkouts_cancelled_by_foreign')) {
                $table->dropForeign('checkouts_cancelled_by_foreign');
            }

            if ($this->indexExists('checkouts', 'checkouts_payment_status_index')) {
                $table->dropIndex('checkouts_payment_status_index');
            }

            if ($this->indexExists('checkouts', 'checkouts_shipping_status_index')) {
                $table->dropIndex('checkouts_shipping_status_index');
            }
        });

        $columns = array_values(array_filter([
            'payment_status',
            'shipping_status',
            'cancelled_at',
            'cancelled_by',
            'cancellation_reason',
        ], fn ($column) => Schema::hasColumn('checkouts', $column)));

        if (!empty($columns)) {
            Schema::table('checkouts', function (Blueprint $table) use ($columns) {
                $table->dropColumn($columns);
            });
        }
    }
};
