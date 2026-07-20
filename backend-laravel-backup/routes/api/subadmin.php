<?php

use App\Http\Controllers\SubAdminController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'role:sub_admin'])->prefix('subadmin')->group(function () {
    Route::get('reports/counts', [SubAdminController::class, 'counts']);

    Route::get('company', [SubAdminController::class, 'company']);
    Route::patch('company', [SubAdminController::class, 'updateCompany']);

    Route::get('staff', [SubAdminController::class, 'staff']);
    Route::post('staff', [SubAdminController::class, 'storeStaff']);
    Route::patch('staff/{staff}', [SubAdminController::class, 'updateStaff']);
    Route::delete('staff/{staff}', [SubAdminController::class, 'destroyStaff']);

    Route::get('verification', [SubAdminController::class, 'verificationQueue']);
    Route::patch('guard-documents/{document}', [SubAdminController::class, 'updateDocument']);

    Route::get('clients', [SubAdminController::class, 'clients']);
    Route::get('guards', [SubAdminController::class, 'guards']);

    Route::get('reports/skills', [SubAdminController::class, 'skillsReport']);
    Route::get('reports/commission', [SubAdminController::class, 'commissionReport']);
});
