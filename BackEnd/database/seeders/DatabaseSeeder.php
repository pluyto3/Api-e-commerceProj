<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void {
        User::updateOrCreate(
            ['email' => 'admin@hanzgo.com'],
            [
                'username' => 'admin',
                'fullname' => 'System Admin',
                'phone_number' => '09000000000',
                'password' => Hash::make('Admin12345'),
                'role' => 'admin',
                'email_verified_at' => now(),
            ]
        );
    }
}
