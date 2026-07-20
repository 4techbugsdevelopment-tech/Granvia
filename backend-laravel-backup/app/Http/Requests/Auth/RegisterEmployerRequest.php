<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RegisterEmployerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'gst_number' => $this->gst_number ? strtoupper(trim($this->gst_number)) : null,
            'pan_number' => $this->pan_number ? strtoupper(trim($this->pan_number)) : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'contact_person_name' => ['required', 'string', 'min:2'],
            'mobile' => ['required', 'regex:/^[6-9]\d{9}$/', 'unique:users,mobile'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'city' => ['required', 'string'],
            'state' => ['required', 'string'],
            'pincode' => ['required', 'regex:/^\d{6}$/'],
            'company_name' => ['nullable', 'string'],
            'company_address' => ['nullable', 'string'],
            'business_type' => ['nullable', 'string'],
            'gst_number' => ['nullable', 'regex:/^[0-9A-Z]{15}$/'],
            'pan_number' => ['nullable', 'regex:/^[A-Z]{5}[0-9]{4}[A-Z]$/'],
            'website' => ['nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $hasCompany = $this->filled('company_name') || $this->filled('company_address')
                || $this->filled('business_type') || $this->filled('gst_number') || $this->filled('pan_number');

            if ($hasCompany) {
                foreach (['company_name', 'company_address', 'business_type'] as $field) {
                    if (! $this->filled($field)) {
                        $validator->errors()->add($field, 'The '.$field.' field is required when creating a company.');
                    }
                }
            }
        });
    }
}
