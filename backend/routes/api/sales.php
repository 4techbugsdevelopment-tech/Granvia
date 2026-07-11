<?php

use App\Http\Controllers\SalesController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'role:sales_executive'])->prefix('sales')->group(function () {
    Route::get('reports/counts', [SalesController::class, 'counts']);
    Route::get('activity', [SalesController::class, 'activity']);

    Route::get('clients', [SalesController::class, 'clients']);
    Route::get('clients/{employer}', [SalesController::class, 'clientDetail']);

    Route::post('jobs/request-otp', [SalesController::class, 'requestJobOtp']);
    Route::post('jobs', [SalesController::class, 'storeJob']);

    Route::get('discounts', [SalesController::class, 'discounts']);
    Route::post('discounts', [SalesController::class, 'storeDiscount']);
    Route::patch('discounts/{discount}', [SalesController::class, 'updateDiscount']);
    Route::delete('discounts/{discount}', [SalesController::class, 'destroyDiscount']);

    Route::get('manpower', [SalesController::class, 'manpower']);
});
