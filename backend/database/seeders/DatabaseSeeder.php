<?php

namespace Database\Seeders;

use App\Models\EmployerCompany;
use App\Models\EmployerProfile;
use App\Models\GuardProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed one account per role for local development and smoke testing.
     */
    public function run(): void
    {
        $admin = User::create([
            'full_name' => 'Super Admin',
            'email' => 'admin@granvia.test',
            'mobile' => '9000000000',
            'password' => Hash::make('password'),
            'role' => 'super_admin',
            'profile_type' => 'admin',
            'account_status' => 'active',
            'email_verified_at' => now(),
        ]);

        $employer = User::create([
            'full_name' => 'Demo Employer',
            'email' => 'employer@granvia.test',
            'mobile' => '9111111111',
            'password' => Hash::make('password'),
            'role' => 'employer',
            'profile_type' => 'employer',
            'account_status' => 'active',
            'email_verified_at' => now(),
        ]);

        EmployerProfile::create([
            'user_id' => $employer->id,
            'contact_person_name' => 'Demo Employer',
            'city' => 'Mumbai',
            'state' => 'Maharashtra',
            'pincode' => '400001',
            'profile_status' => 'complete',
            'verification_status' => 'verified',
            'created_from' => 'seeder',
        ]);

        EmployerCompany::create([
            'employer_user_id' => $employer->id,
            'company_name' => 'Demo Security Services',
            'business_type' => 'Private Limited',
            'city' => 'Mumbai',
            'state' => 'Maharashtra',
            'pincode' => '400001',
            'verification_status' => 'verified',
            'account_status' => 'active',
        ]);

        $guard = User::create([
            'full_name' => 'Demo Guard',
            'email' => 'guard@granvia.test',
            'mobile' => '9222222222',
            'password' => Hash::make('password'),
            'role' => 'guard',
            'profile_type' => 'guard',
            'account_status' => 'active',
            'email_verified_at' => now(),
        ]);

        GuardProfile::create([
            'user_id' => $guard->id,
            'full_name' => 'Demo Guard',
            'mobile' => '9222222222',
            'city' => 'Mumbai',
            'state' => 'Maharashtra',
            'verification_status' => 'verified',
        ]);

        $this->command?->info('Seeded: admin@granvia.test / employer@granvia.test / guard@granvia.test (password: "password")');
    }
}
