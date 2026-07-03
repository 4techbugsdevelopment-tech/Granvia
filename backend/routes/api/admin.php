<?php

use App\Http\Controllers\Admin\EmployerController;
use App\Http\Controllers\JobController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'role:super_admin'])->prefix('admin')->group(function () {
    Route::get('jobs/pending', [JobController::class, 'pending']);
    Route::get('jobs', [JobController::class, 'all']);
    Route::patch('jobs/{job}/approve', [JobController::class, 'approve']);
    Route::patch('jobs/{job}/reject', [JobController::class, 'reject']);
    Route::delete('jobs/{job}', [JobController::class, 'destroy']);

    Route::get('employers', [EmployerController::class, 'index']);
    Route::post('employers', [EmployerController::class, 'store']);
    Route::patch('employers/{employer}', [EmployerController::class, 'update']);
    Route::delete('employers/{employer}', [EmployerController::class, 'destroy']);
});
