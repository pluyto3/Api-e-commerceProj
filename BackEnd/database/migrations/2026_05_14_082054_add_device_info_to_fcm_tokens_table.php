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
        Schema::table('fcm_tokens', function (Blueprint $table) {
            $table->string('browser_name')->nullable()->after('platform');
            $table->string('device_name')->nullable()->after('browser_name');
            $table->text('user_agent')->nullable()->after('device_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('fcm_tokens', function (Blueprint $table) {
            $table->dropColumn(['browser_name', 'device_name', 'user_agent']);
        });
    }
};
