<?php

use App\Http\Controllers\AadhaarVerificationController;
use App\Http\Controllers\AgreementController;
use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\InterviewRequestController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\JobController;
use App\Http\Controllers\JobOfferController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SiteController;
use App\Http\Controllers\WalletController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'role:employer'])->prefix('employer')->group(function () {
    Route::get('companies', [CompanyController::class, 'index']);
    Route::post('companies', [CompanyController::class, 'store']);
    Route::patch('companies/{company}', [CompanyController::class, 'update']);
    Route::post('companies/{company}/logo', [CompanyController::class, 'uploadLogo']);

    Route::get('companies/{company}/sites', [SiteController::class, 'index']);
    Route::post('sites', [SiteController::class, 'store']);
    Route::patch('sites/{site}', [SiteController::class, 'update']);

    Route::get('companies/{company}/documents', [DocumentController::class, 'index']);
    Route::post('companies/{company}/documents', [DocumentController::class, 'store']);

    Route::get('jobs', [JobController::class, 'mine']);
    Route::post('jobs', [JobController::class, 'store']);
    Route::patch('jobs/{job}', [JobController::class, 'update']);
    Route::delete('jobs/{job}', [JobController::class, 'destroy']);

    Route::get('applications', [ApplicationController::class, 'employerIndex']);
    Route::patch('applications/{application}/status', [ApplicationController::class, 'updateStatus']);

    Route::get('attendance', [AttendanceController::class, 'index']);
    Route::patch('attendance/{record}/status', [AttendanceController::class, 'updateStatus']);

    Route::get('interview-requests', [InterviewRequestController::class, 'index']);
    Route::post('interview-requests', [InterviewRequestController::class, 'store']);
    Route::patch('interview-requests/{interviewRequest}', [InterviewRequestController::class, 'update']);

    Route::get('job-offers', [JobOfferController::class, 'index']);
    Route::post('job-offers', [JobOfferController::class, 'store']);
    Route::patch('job-offers/{jobOffer}', [JobOfferController::class, 'update']);

    Route::get('agreements', [AgreementController::class, 'index']);
    Route::post('agreements', [AgreementController::class, 'store']);
    Route::patch('agreements/{agreement}', [AgreementController::class, 'update']);

    Route::get('payments', [PaymentController::class, 'index']);
    Route::post('payments', [PaymentController::class, 'store']);

    Route::get('invoices', [InvoiceController::class, 'index']);

    Route::get('wallet', [WalletController::class, 'show']);
    Route::get('wallet/transactions', [WalletController::class, 'transactions']);

    Route::get('aadhaar', [AadhaarVerificationController::class, 'status']);
    Route::post('aadhaar/verify-instant', [AadhaarVerificationController::class, 'instantVerify']);
    Route::post('aadhaar/send-otp', [AadhaarVerificationController::class, 'sendOtp']);
    Route::post('aadhaar/verify-otp', [AadhaarVerificationController::class, 'verifyOtp']);

    Route::get('reports/counts', [ReportController::class, 'counts']);
});
