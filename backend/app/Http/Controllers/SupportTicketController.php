<?php

namespace App\Http\Controllers;

use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SupportTicketController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(
            SupportTicket::where('user_id', $request->user()->id)
                ->with('messages')
                ->orderByDesc('created_at')
                ->get()
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'company_id' => ['nullable', 'uuid'],
            'subject' => ['required', 'string'],
            'priority' => ['nullable', 'string'],
            'message' => ['required', 'string'],
        ]);

        $ticket = DB::transaction(function () use ($data, $request) {
            $ticket = SupportTicket::create([
                'user_id' => $request->user()->id,
                'company_id' => $data['company_id'] ?? null,
                'ticket_number' => 'TCK-'.strtoupper(Str::random(8)),
                'subject' => $data['subject'],
                'description' => $data['message'],
                'priority' => $data['priority'] ?? 'medium',
                'status' => 'open',
            ]);

            SupportTicketMessage::create([
                'ticket_id' => $ticket->id,
                'sender_id' => $request->user()->id,
                'message' => $data['message'],
            ]);

            return $ticket;
        });

        return response()->json($ticket->load('messages'), 201);
    }
}
