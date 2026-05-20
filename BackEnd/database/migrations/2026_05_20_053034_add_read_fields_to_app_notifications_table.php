<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_notifications', function (Blueprint $table) {
            if (!Schema::hasColumn('app_notifications', 'is_read')) {
                $table->boolean('is_read')->default(false)->after('related_id');
            }

            if (!Schema::hasColumn('app_notifications', 'read_at')) {
                $table->timestamp('read_at')->nullable()->after('is_read');
            }
        });
    }

    public function down(): void
    {
        Schema::table('app_notifications', function (Blueprint $table) {
            if (Schema::hasColumn('app_notifications', 'read_at')) {
                $table->dropColumn('read_at');
            }

            if (Schema::hasColumn('app_notifications', 'is_read')) {
                $table->dropColumn('is_read');
            }
        });
    }
};