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

    public function showGuardProfile(Request $request)
    {
        return response()->json($request->user()->guardProfile);
    }

    public function updateGuardProfile(Request $request)
    {
        $data = $request->validate([
            'full_name' => ['sometimes', 'string', 'min:2'],
            'mobile' => ['sometimes', 'regex:/^[6-9]\d{9}$/'],
            'gender' => ['sometimes', 'nullable', 'string'],
            'dob' => ['sometimes', 'nullable', 'date'],
            'address' => ['sometimes', 'nullable', 'string'],
            'city' => ['sometimes', 'nullable', 'string'],
            'state' => ['sometimes', 'nullable', 'string'],
            'pincode' => ['sometimes', 'nullable', 'regex:/^\d{6}$/'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'search_radius_km' => ['sometimes', 'integer', 'between:1,100'],
            'qualification' => ['sometimes', 'nullable', 'string'],
            'skills' => ['sometimes', 'array'],
            'skills.*' => ['string'],
            'languages' => ['sometimes', 'array'],
            'languages.*' => ['string'],
            'experience' => ['sometimes', 'nullable', 'string'],
            'bank_account_number' => ['sometimes', 'nullable', 'regex:/^\d{9,18}$/'],
            'bank_ifsc' => ['sometimes', 'nullable', 'regex:/^[A-Z]{4}0[A-Z0-9]{6}$/'],
            'bank_name' => ['sometimes', 'nullable', 'string'],
            'account_holder_name' => ['sometimes', 'nullable', 'string'],
        ]);

        $profile = $request->user()->guardProfile;

        if (! $profile) {
            return response()->json(['message' => 'Guard profile not found.'], 404);
        }

        $profile->update($data);

        return response()->json($profile->fresh());
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
