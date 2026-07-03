<?php

namespace App\Http\Controllers;

use App\Services\FileStorageService;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function uploadAvatar(Request $request, FileStorageService $storage)
    {
        $data = $request->validate(['file' => ['required', 'image', 'max:5120']]);

        $stored = $storage->store('profile-images', (string) $request->user()->id, $data['file']);

        $request->user()->update(['avatar_url' => $stored['url']]);

        return response()->json($request->user()->fresh());
    }

    public function show(Request $request)
    {
        return response()->json($request->user());
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'full_name' => ['sometimes', 'string', 'min:2'],
            'mobile' => ['sometimes', 'regex:/^[6-9]\d{9}$/'],
        ]);

        $request->user()->update($data);

        return response()->json($request->user()->fresh());
    }

    public function showEmployerProfile(Request $request)
    {
        return response()->json($request->user()->employerProfile);
    }

    public function updateEmployerProfile(Request $request)
    {
        $data = $request->validate([
            'contact_person_name' => ['sometimes', 'string'],
            'designation' => ['sometimes', 'nullable', 'string'],
            'city' => ['sometimes', 'string'],
            'state' => ['sometimes', 'string'],
            'pincode' => ['sometimes', 'regex:/^\d{6}$/'],
        ]);

        $profile = $request->user()->employerProfile;

        if (! $profile) {
            return response()->json(['message' => 'Employer profile not found.'], 404);
        }

        $profile->update($data);

        return response()->json($profile->fresh());
    }
}
