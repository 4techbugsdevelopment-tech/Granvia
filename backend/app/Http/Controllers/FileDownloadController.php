<?php

namespace App\Http\Controllers;

use App\Services\FileStorageService;
use Illuminate\Http\Request;

class FileDownloadController extends Controller
{
    public function __invoke(Request $request, FileStorageService $storage)
    {
        return $storage->download($request->query('path'));
    }
}
