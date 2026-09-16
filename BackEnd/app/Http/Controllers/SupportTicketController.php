<?php

namespace App\Http\Controllers;

use App\Models\SupportTicket;
use App\Models\SupportTicketReply;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

class SupportTicketController extends Controller
{
    /**
     * Get summary counts for the Admin Support Inbox.
     */
    public function summary()
    {
        return response()->json([
            'total' => SupportTicket::count(),

            'open' => SupportTicket::where(
                'status',
                'open'
            )->count(),

            'in_progress' => SupportTicket::where(
                'status',
                'in_progress'
            )->count(),

            'resolved' => SupportTicket::where(
                'status',
                'resolved'
            )->count(),

            'closed' => SupportTicket::where(
                'status',
                'closed'
            )->count(),

            'urgent' => SupportTicket::where(
                'priority',
                'urgent'
            )->count(),

            'active' => SupportTicket::whereIn(
                'status',
                ['open', 'in_progress']
            )->count(),
        ], 200);
    }

    /**
     * Get all support tickets for the Admin Support Inbox.
     */
    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'status' =>
                'nullable|string|in:open,in_progress,resolved,closed',

            'priority' =>
                'nullable|string|in:normal,urgent',

            'category' => [
                'nullable',
                'string',
                'in:order_concern,product_question,delivery_tracking,cancellation_refund,account_problem,payment_concern,seller_concern,other',
            ],

            'search' =>
                'nullable|string|max:100',

            'per_page' =>
                'nullable|integer|min:5|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'msg' => 'Invalid support ticket filter.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        $query = SupportTicket::query()
            ->leftJoin(
                'users',
                'support_tickets.user_id',
                '=',
                'users.user_id'
            )
            ->select(
                'support_tickets.*',
                'users.username as customer_username'
            );

        if (!empty($validated['status'])) {
            $query->where(
                'support_tickets.status',
                $validated['status']
            );
        }

        if (!empty($validated['priority'])) {
            $query->where(
                'support_tickets.priority',
                $validated['priority']
            );
        }

        if (!empty($validated['category'])) {
            $query->where(
                'support_tickets.category',
                $validated['category']
            );
        }

        if (!empty($validated['search'])) {
            $search = trim($validated['search']);

            $query->where(function ($q) use ($search) {
                $like = '%' . $search . '%';

                $q->where(
                    'support_tickets.ticket_number',
                    'like',
                    $like
                )
                    ->orWhere(
                        'support_tickets.name',
                        'like',
                        $like
                    )
                    ->orWhere(
                        'support_tickets.email',
                        'like',
                        $like
                    )
                    ->orWhere(
                        'support_tickets.subject',
                        'like',
                        $like
                    )
                    ->orWhere(
                        'users.username',
                        'like',
                        $like
                    );

                if (ctype_digit($search)) {
                    $q->orWhere(
                        'support_tickets.order_id',
                        (int) $search
                    );
                }
            });
        }

        $perPage = $validated['per_page'] ?? 20;

        $tickets = $query
            ->orderByDesc(
                'support_tickets.support_ticket_id'
            )
            ->paginate($perPage);

        return response()->json($tickets, 200);
    }

    /**
     * Get one support ticket and its related customer/order details.
     */
    public function show($id)
    {
        $ticket = SupportTicket::query()
            ->leftJoin(
                'users',
                'support_tickets.user_id',
                '=',
                'users.user_id'
            )
            ->leftJoin(
                'checkouts',
                'support_tickets.order_id',
                '=',
                'checkouts.checkout_id'
            )
            ->select(
                'support_tickets.*',

                'users.username as customer_username',
                'users.fullname as customer_fullname',
                'users.role as customer_role',

                'checkouts.total_amount as order_total_amount',
                'checkouts.payment_status as order_payment_status',
                'checkouts.shipping_status as order_shipping_status',
                'checkouts.tracking_number as order_tracking_number',
                'checkouts.created_at as order_created_at'
            )
            ->where(
                'support_tickets.support_ticket_id',
                $id
            )
            ->first();

        if (!$ticket) {
            return response()->json([
                'msg' => 'Support ticket not found.',
            ], 404);
        }

        $replies = SupportTicketReply::query()
            ->leftJoin(
                'users',
                'support_ticket_replies.sender_user_id',
                '=',
                'users.user_id'
            )
            ->select(
                'support_ticket_replies.*',
                'users.username as sender_username',
                'users.fullname as sender_fullname',
                'users.role as sender_role'
            )
            ->where(
                'support_ticket_replies.support_ticket_id',
                $ticket->support_ticket_id
            )
            ->orderBy('support_ticket_replies.created_at')
            ->orderBy('support_ticket_replies.support_ticket_reply_id')
            ->get();

        $ticket->setRelation('replies', $replies);

        return response()->json([
            'data' => $ticket,
        ], 200);
    }

    /**
     * Add an administrator reply to a support ticket.
     */
    public function reply(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'message' => 'required|string|max:4000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'msg' => 'Please enter a valid reply.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $admin = $request->attributes->get('authenticated_user');

        if (!$admin) {
            return response()->json([
                'msg' => 'Authenticated administrator could not be identified.',
            ], 401);
        }

        $ticket = SupportTicket::find($id);

        if (!$ticket) {
            return response()->json([
                'msg' => 'Support ticket not found.',
            ], 404);
        }

        /*
        |--------------------------------------------------------------------------
        | Prevent replies to closed tickets
        |--------------------------------------------------------------------------
        */

        if ($ticket->status === 'closed') {
            return response()->json([
                'msg' => 'Closed support tickets cannot receive new replies.',
            ], 422);
        }

        $validated = $validator->validated();

        /*
        |--------------------------------------------------------------------------
        | Save reply first
        |--------------------------------------------------------------------------
        |
        | The reply is stored before email is attempted. Email failure therefore
        | never causes the administrator's response to be lost.
        |
        */

        try {
            $reply = DB::transaction(function () use (
                $ticket,
                $admin,
                $validated
            ) {
                $reply = SupportTicketReply::create([
                    'support_ticket_id' => $ticket->support_ticket_id,
                    'sender_user_id' => $admin->user_id,
                    'sender_type' => 'admin',
                    'message' => trim($validated['message']),
                ]);

                /*
                * The first administrator reply moves an open ticket into
                * the In Progress state.
                */
                if ($ticket->status === 'open') {
                    $ticket->status = 'in_progress';
                    $ticket->resolved_at = null;
                    $ticket->save();
                }

                return $reply;
            });
        } catch (\Throwable $e) {
            \Log::error(
                'Support ticket reply could not be saved for ticket ' .
                $ticket->ticket_number .
                ': ' .
                $e->getMessage()
            );

            return response()->json([
                'msg' => 'The support reply could not be saved. Please try again.',
            ], 500);
        }

        /*
        |--------------------------------------------------------------------------
        | Email reply to customer
        |--------------------------------------------------------------------------
        */

        $emailSent = false;

        try {
            $customerName = e($ticket->name ?: 'Customer');
            $ticketNumber = e($ticket->ticket_number);
            $ticketSubject = e($ticket->subject);

            $adminName = e(
                $admin->fullname
                    ?: $admin->username
                    ?: 'Hanz-Go Support'
            );

            $replyMessage = nl2br(
                e($reply->message)
            );

            $body = "
                <p>Hello {$customerName},</p>

                <p>
                    You have received a reply regarding your
                    Hanz-Go support request.
                </p>

                <p>
                    <strong>Ticket:</strong>
                    {$ticketNumber}
                </p>

                <p>
                    <strong>Subject:</strong>
                    {$ticketSubject}
                </p>

                <hr>

                <p>
                    <strong>{$adminName} — Hanz-Go Support</strong>
                </p>

                <p>{$replyMessage}</p>

                <hr>

                <p>
                    Please keep your ticket reference
                    <strong>{$ticketNumber}</strong>
                    for future correspondence.
                </p>

                <p>
                    Thanks,<br>
                    Hanz-Go Team
                </p>
            ";

            Mail::html(
                $body,
                function ($message) use ($ticket) {
                    $message
                        ->to(
                            $ticket->email,
                            $ticket->name
                        )
                        ->subject(
                            '[' .
                            $ticket->ticket_number .
                            '] Hanz-Go Support Reply'
                        );
                }
            );

            $reply->email_sent_at = now();
            $reply->save();

            $emailSent = true;
        } catch (\Throwable $emailError) {
            \Log::error(
                'Support reply email failed for ' .
                $ticket->ticket_number .
                ': ' .
                $emailError->getMessage()
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Return saved reply
        |--------------------------------------------------------------------------
        */

        return response()->json([
            'msg' => $emailSent
                ? 'Reply sent successfully.'
                : 'Reply was saved, but the customer email could not be sent.',

            'email_sent' => $emailSent,

            'ticket' => [
                'support_ticket_id' =>
                    $ticket->support_ticket_id,

                'ticket_number' =>
                    $ticket->ticket_number,

                'status' =>
                    $ticket->fresh()->status,
            ],

            'data' => [
                'support_ticket_reply_id' =>
                    $reply->support_ticket_reply_id,

                'support_ticket_id' =>
                    $reply->support_ticket_id,

                'sender_type' =>
                    $reply->sender_type,

                'sender_username' =>
                    $admin->username,

                'sender_fullname' =>
                    $admin->fullname,

                'sender_role' =>
                    $admin->role,

                'message' =>
                    $reply->message,

                'email_sent_at' =>
                    $reply->email_sent_at,

                'created_at' =>
                    $reply->created_at,
            ],
        ], 201);
    }

    /**
     * Update support ticket status and/or priority.
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' =>
                'sometimes|required|string|in:open,in_progress,resolved,closed',

            'priority' =>
                'sometimes|required|string|in:normal,urgent',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'msg' => 'Invalid support ticket update.',
                'errors' => $validator->errors(),
            ], 422);
        }

        if (
            !$request->has('status') &&
            !$request->has('priority')
        ) {
            return response()->json([
                'msg' => 'Please provide a status or priority to update.',
            ], 422);
        }

        $ticket = SupportTicket::find($id);

        if (!$ticket) {
            return response()->json([
                'msg' => 'Support ticket not found.',
            ], 404);
        }

        $validated = $validator->validated();

        if (array_key_exists('priority', $validated)) {
            $ticket->priority = $validated['priority'];
        }

        if (array_key_exists('status', $validated)) {
            $ticket->status = $validated['status'];

            if (
                in_array(
                    $validated['status'],
                    ['resolved', 'closed'],
                    true
                )
            ) {
                if (!$ticket->resolved_at) {
                    $ticket->resolved_at = now();
                }
            } else {
                // Reopening the ticket clears its resolved timestamp.
                $ticket->resolved_at = null;
            }
        }

        $ticket->save();

        return response()->json([
            'msg' => 'Support ticket updated successfully.',
            'data' => $ticket,
        ], 200);
    }
}