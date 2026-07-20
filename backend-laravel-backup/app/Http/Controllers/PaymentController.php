<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function index(Request $request)
    {
        $query = Payment::where('employer_user_id', $request->user()->id)
            ->with(['job:id,title', 'guardProfile:id,user_id,full_name']);

        if ($request->filled('company_id')) {
            $query->whereHas('job', fn ($q) => $q->where('company_id', $request->query('company_id')));
        }

        return response()->json($query->orderByDesc('created_at')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'guard_user_id' => ['nullable', 'uuid'],
            'job_id' => ['nullable', 'uuid'],
            'application_id' => ['nullable', 'uuid'],
            'amount' => ['required', 'numeric'],
            'payment_method' => ['nullable', 'string'],
            'payment_status' => ['nullable', 'string'],
            'payment_date' => ['nullable', 'date'],
        ]);

        $payment = Payment::create([
            ...$data,
            'employer_user_id' => $request->user()->id,
            'payment_status' => $data['payment_status'] ?? 'pending',
        ]);

        return response()->json($payment, 201);
    }
}
