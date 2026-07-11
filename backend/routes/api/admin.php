<?php

use App\Http\Controllers\Admin\EmployerController;
use App\Http\Controllers\Admin\GuardController;
use App\Http\Controllers\JobController;
use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'role:super_admin'])->prefix('admin')->group(function () {
    Route::get('guards', [GuardController::class, 'index']);
    Route::post('guards', [GuardController::class, 'store']);
    Route::patch('guards/{guard}', [GuardController::class, 'update']);
    Route::get('guards/{guard}/documents', [\App\Http\Controllers\GuardDocumentController::class, 'adminIndex']);
    Route::patch('guard-documents/{document}', [\App\Http\Controllers\GuardDocumentController::class, 'adminUpdateStatus']);

    Route::get('reports/counts', [ReportController::class, 'adminCounts']);

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
