<?php

namespace App\Http\Controllers;

use App\Models\SupportTicket;
use Illuminate\Http\Request;
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

        return response()->json([
            'data' => $ticket,
        ], 200);
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