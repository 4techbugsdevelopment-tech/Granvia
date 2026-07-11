<?php

use App\Http\Controllers\FileDownloadController;
use App\Http\Controllers\GeocodeController;
use App\Http\Controllers\JobController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SupportTicketController;
use Illuminate\Support\Facades\Route;

// Public.
Route::get('jobs', [JobController::class, 'active']);

// Address → lat/lng lookup (Mappls proxy). Any signed-in staff user may call it.
Route::middleware(['auth:sanctum'])->get('geocode', GeocodeController::class);

// Routes reachable by any authenticated role, or public, go here.
Route::middleware(['auth:sanctum'])->prefix('me')->group(function () {
    Route::get('profile', [ProfileController::class, 'show']);
    Route::patch('profile', [ProfileController::class, 'update']);
    Route::post('avatar', [ProfileController::class, 'uploadAvatar']);
    Route::get('employer-profile', [ProfileController::class, 'showEmployerProfile']);
    Route::patch('employer-profile', [ProfileController::class, 'updateEmployerProfile']);
    Route::get('guard-profile', [ProfileController::class, 'showGuardProfile']);
    Route::patch('guard-profile', [ProfileController::class, 'updateGuardProfile']);

    Route::get('notifications', [NotificationController::class, 'index']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);

    Route::get('support-tickets', [SupportTicketController::class, 'index']);
    Route::post('support-tickets', [SupportTicketController::class, 'store']);
});

Route::get('files/download', FileDownloadController::class)
    ->middleware('signed')
    ->name('files.download');
