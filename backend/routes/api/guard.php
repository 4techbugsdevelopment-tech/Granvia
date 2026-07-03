<?php

use App\Http\Controllers\ApplicationController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'role:guard'])->prefix('guard')->group(function () {
    Route::post('jobs/{job}/apply', [ApplicationController::class, 'apply']);
    Route::get('applications', [ApplicationController::class, 'mine']);
    Route::get('applications/job-ids', [ApplicationController::class, 'myAppliedJobIds']);
});
