<?php

namespace App\Http\Controllers;

use App\Models\EmployerWallet;
use App\Models\WalletTransaction;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    public function show(Request $request)
    {
        $wallet = EmployerWallet::firstOrCreate(
            ['employer_user_id' => $request->user()->id],
            ['balance' => 0, 'currency' => 'INR', 'status' => 'active']
        );

        return response()->json($wallet);
    }

    public function transactions(Request $request)
    {
        return response()->json(
            WalletTransaction::where('employer_user_id', $request->user()->id)
                ->orderByDesc('created_at')
                ->get()
        );
    }
}
