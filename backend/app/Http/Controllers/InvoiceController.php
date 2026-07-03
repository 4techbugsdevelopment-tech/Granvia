<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function index(Request $request)
    {
        $query = Invoice::where('employer_user_id', $request->user()->id);

        if ($request->filled('company_id')) {
            $query->where('company_id', $request->query('company_id'));
        }

        return response()->json($query->orderByDesc('created_at')->get());
    }
}
