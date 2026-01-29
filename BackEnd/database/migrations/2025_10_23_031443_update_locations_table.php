<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE locations CHANGE `name` `purok` VARCHAR(255) NOT NULL");
        DB::statement("ALTER TABLE locations CHANGE `address` `barangay` VARCHAR(255) NOT NULL");
        DB::statement("ALTER TABLE locations CHANGE `state` `province` VARCHAR(255) NOT NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE locations CHANGE `purok` `name` VARCHAR(255) NOT NULL");
        DB::statement("ALTER TABLE locations CHANGE `barangay` `address` VARCHAR(255) NOT NULL");
        DB::statement("ALTER TABLE locations CHANGE `province` `state` VARCHAR(255) NOT NULL");
    }
};
