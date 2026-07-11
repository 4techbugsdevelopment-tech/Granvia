<?php

use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\GuardAadhaarController;
use App\Http\Controllers\GuardDocumentController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'role:guard'])->prefix('guard')->group(function () {
    Route::post('jobs/{job}/apply', [ApplicationController::class, 'apply']);
    Route::get('applications', [ApplicationController::class, 'mine']);
    Route::get('applications/job-ids', [ApplicationController::class, 'myAppliedJobIds']);

    Route::get('attendance', [AttendanceController::class, 'guardIndex']);
    Route::post('attendance/check-in', [AttendanceController::class, 'checkIn']);
    Route::patch('attendance/{record}/check-out', [AttendanceController::class, 'checkOut']);

    Route::get('documents', [GuardDocumentController::class, 'index']);
    Route::post('documents', [GuardDocumentController::class, 'store']);

    Route::get('aadhaar', [GuardAadhaarController::class, 'status']);
    Route::post('aadhaar/verify-instant', [GuardAadhaarController::class, 'instantVerify']);
    Route::post('aadhaar/send-otp', [GuardAadhaarController::class, 'sendOtp']);
    Route::post('aadhaar/verify-otp', [GuardAadhaarController::class, 'verifyOtp']);
});
