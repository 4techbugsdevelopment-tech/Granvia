<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class FileStorageService
{
    /**
     * Categories whose files require an authenticated, signed download link
     * rather than a plain public URL.
     */
    private const PRIVATE_CATEGORIES = ['company-documents', 'guard-documents', 'invoices', 'agreements'];

    public function store(string $category, string $ownerId, UploadedFile $file): array
    {
        $disk = $this->diskFor($category);
        $filename = Str::uuid().'.'.$file->getClientOriginalExtension();
        $path = $file->storeAs("$category/$ownerId", $filename, $disk);

        return [
            'path' => $path,
            'url' => $this->urlFor($category, $path),
        ];
    }

    public function urlFor(string $category, string $path): string
    {
        if (in_array($category, self::PRIVATE_CATEGORIES, true)) {
            return URL::temporarySignedRoute('files.download', now()->addMinutes(10), ['path' => $path]);
        }

        return Storage::disk('public')->url($path);
    }

    public function diskFor(string $category): string
    {
        return in_array($category, self::PRIVATE_CATEGORIES, true) ? 'local' : 'public';
    }

    public function download(string $path)
    {
        $disk = Str::startsWith($path, array_map(fn ($c) => "$c/", self::PRIVATE_CATEGORIES)) ? 'local' : 'public';

        return Storage::disk($disk)->download($path);
    }
}
