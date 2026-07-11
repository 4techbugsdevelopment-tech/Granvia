<?php

namespace Database\Seeders;

use App\Models\Discount;
use App\Models\EmployerCompany;
use App\Models\EmployerProfile;
use App\Models\GuardProfile;
use App\Models\StaffMember;
use App\Models\SubAdminProfile;
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

        $guardProfile = GuardProfile::create([
            'user_id' => $guard->id,
            'full_name' => 'Demo Guard',
            'mobile' => '9222222222',
            'city' => 'Mumbai',
            'state' => 'Maharashtra',
            'latitude' => 19.0760,
            'longitude' => 72.8777,
            'skills' => ['CCTV Monitoring', 'Patrolling'],
            'languages' => ['Hindi', 'English', 'Marathi'],
            'experience' => '5 years',
            'qualification' => 'Graduate',
            'verification_status' => 'verified',
        ]);

        // ── Sales Executive ─────────────────────────────────────────────────
        $sales = User::create([
            'full_name' => 'Demo Sales Executive',
            'email' => 'sales@granvia.test',
            'mobile' => '9333333333',
            'password' => Hash::make('password'),
            'role' => 'sales_executive',
            'profile_type' => 'sales_executive',
            'account_status' => 'active',
            'email_verified_at' => now(),
        ]);

        // ── Sub Admin ───────────────────────────────────────────────────────
        $subAdmin = User::create([
            'full_name' => 'Demo Sub Admin',
            'email' => 'subadmin@granvia.test',
            'mobile' => '9444444444',
            'password' => Hash::make('password'),
            'role' => 'sub_admin',
            'profile_type' => 'sub_admin',
            'account_status' => 'active',
            'email_verified_at' => now(),
        ]);

        SubAdminProfile::create([
            'user_id' => $subAdmin->id,
            'branch_name' => 'Granvia Regional Office — West',
            'registration_no' => 'U74999MH2019PTC000000',
            'gst_number' => '27AABCG1234K1Z5',
            'address' => '4th Floor, Nariman Point, Mumbai 400021',
            'contact_email' => 'west@granvia.com',
            'phone' => '+91 22 4000 1200',
        ]);

        foreach ([
            ['Neha Kulkarni', 'Operations Manager', 'neha@region.com', '9801234500', 'Active', ['Manage Staff', 'Manage Clients', 'View Reports']],
            ['Arjun Reddy', 'Field Supervisor', 'arjun@region.com', '9801234501', 'Active', ['Manage Service Partners', 'Verify Documents']],
            ['Sana Sheikh', 'HR Coordinator', 'sana@region.com', '9801234502', 'Inactive', ['Verify Documents']],
        ] as [$name, $role, $email, $mobile, $status, $perms]) {
            StaffMember::create([
                'sub_admin_user_id' => $subAdmin->id,
                'name' => $name,
                'role' => $role,
                'email' => $email,
                'mobile' => $mobile,
                'status' => $status,
                'permissions' => $perms,
            ]);
        }

        // Assign the demo employer (client) to both the sales exec and the sub admin,
        // and the demo guard (service partner) to the sub admin branch.
        $employer->employerProfile()->update([
            'sales_executive_id' => $sales->id,
            'sub_admin_id' => $subAdmin->id,
            'billing_status' => 'current',
            'base_hourly_rate' => 120.00,
        ]);

        $guardProfile->update(['sub_admin_id' => $subAdmin->id]);

        Discount::create([
            'sales_executive_user_id' => $sales->id,
            'employer_user_id' => $employer->id,
            'label' => 'Festival Offer',
            'discount_type' => 'percentage',
            'value' => 10,
            'applies_to' => 'Q3 contract',
            'status' => 'Active',
        ]);

        $this->command?->info('Seeded: admin / employer / guard / sales / subadmin @granvia.test (password: "password")');
    }
}
