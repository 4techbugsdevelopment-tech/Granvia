<?php

namespace App\Http\Controllers;

use App\Models\GuardDocument;
use App\Models\GuardProfile;
use App\Models\User;
use App\Services\FileStorageService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GuardDocumentController extends Controller
{
    public const DOCUMENT_TYPES = ['id_proof', 'police_verification', 'bank_proof', 'other'];

    public function index(Request $request, FileStorageService $storage)
    {
        return response()->json($this->withUrls(
            GuardDocument::where('guard_user_id', $request->user()->id)->orderByDesc('created_at')->get(),
            $storage
        ));
    }

    public function store(Request $request, FileStorageService $storage)
    {
        $data = $request->validate([
            'document_type' => ['required', Rule::in(self::DOCUMENT_TYPES)],
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:10240'],
        ]);

        $file = $data['file'];
        $stored = $storage->store('guard-documents', (string) $request->user()->id, $file);

        $document = GuardDocument::create([
            'guard_user_id' => $request->user()->id,
            'document_type' => $data['document_type'],
            'file_path' => $stored['path'],
            'file_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'status' => 'pending',
        ]);

        // A fresh upload puts that verification back into review.
        if ($data['document_type'] === 'police_verification') {
            GuardProfile::where('user_id', $request->user()->id)
                ->update(['police_verification_status' => 'pending']);
        }

        return response()->json($this->withUrl($document, $storage), 201);
    }

    public function adminIndex(Request $request, User $guard, FileStorageService $storage)
    {
        if ($guard->role !== 'guard') {
            return response()->json(['message' => 'Not a guard account.'], 404);
        }

        return response()->json($this->withUrls(
            GuardDocument::where('guard_user_id', $guard->id)->orderByDesc('created_at')->get(),
            $storage
        ));
    }

    public function adminUpdateStatus(Request $request, GuardDocument $document, FileStorageService $storage)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['verified', 'rejected', 'pending'])],
            'admin_remarks' => ['nullable', 'string'],
        ]);

        $document->update([
            'status' => $data['status'],
            'admin_remarks' => $data['admin_remarks'] ?? $document->admin_remarks,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        if ($document->document_type === 'police_verification') {
            GuardProfile::where('user_id', $document->guard_user_id)
                ->update(['police_verification_status' => $data['status'] === 'verified' ? 'verified' : ($data['status'] === 'rejected' ? 'rejected' : 'pending')]);
        }

        return response()->json($this->withUrl($document->fresh(), $storage));
    }

    private function withUrls($documents, FileStorageService $storage)
    {
        return $documents->map(fn ($doc) => $this->withUrl($doc, $storage));
    }

    private function withUrl(GuardDocument $document, FileStorageService $storage): array
    {
        return [
            ...$document->toArray(),
            'download_url' => $storage->urlFor('guard-documents', $document->file_path),
        ];
    }
}
