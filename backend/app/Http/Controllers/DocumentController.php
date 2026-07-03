<?php

namespace App\Http\Controllers;

use App\Models\CompanyDocument;
use App\Models\EmployerCompany;
use App\Services\FileStorageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DocumentController extends Controller
{
    public function index(Request $request, EmployerCompany $company)
    {
        if ($company->employer_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json(
            CompanyDocument::where('company_id', $company->id)->orderByDesc('created_at')->get()
        );
    }

    public function store(Request $request, EmployerCompany $company, FileStorageService $storage)
    {
        if ($company->employer_user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'document_type' => ['required', 'string'],
            'file' => ['required', 'file', 'max:10240'],
        ]);

        $document = DB::transaction(function () use ($data, $company, $request, $storage) {
            $file = $data['file'];
            $stored = $storage->store('company-documents', (string) $request->user()->id, $file);

            return CompanyDocument::create([
                'company_id' => $company->id,
                'employer_user_id' => $request->user()->id,
                'document_type' => $data['document_type'],
                'file_path' => $stored['path'],
                'file_url' => $stored['url'],
                'file_size' => $file->getSize(),
                'file_type' => $file->getClientMimeType(),
                'verification_status' => 'pending',
            ]);
        });

        return response()->json($document, 201);
    }
}
