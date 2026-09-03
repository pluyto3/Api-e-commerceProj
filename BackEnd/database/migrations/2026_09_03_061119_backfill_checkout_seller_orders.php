<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $sellerOrders = DB::table('checkout_items')
            ->select(
                'checkout_id',
                'seller_id',
                DB::raw('SUM(subtotal) as seller_subtotal')
            )
            ->whereNotNull('seller_id')
            ->groupBy('checkout_id', 'seller_id')
            ->get();

        foreach ($sellerOrders as $sellerOrder) {

            $checkout = DB::table('checkouts')
                ->where('checkout_id', $sellerOrder->checkout_id)
                ->first();

            if (!$checkout) {
                continue;
            }

            $shippingStatus = strtolower(
                trim(
                    $checkout->shipping_status
                    ?? $checkout->status
                    ?? 'pending'
                )
            );

            // Convert old status names to the new standard.
            $shippingStatus = match ($shippingStatus) {
                'to ship', 'to_ship', 'processing' => 'packed',
                'complete', 'completed' => 'delivered',
                default => str_replace(
                    [' ', '-'],
                    '_',
                    $shippingStatus
                ),
            };

            DB::table('checkout_seller_orders')
                ->updateOrInsert(
                    [
                        'checkout_id' => $sellerOrder->checkout_id,
                        'seller_id' => $sellerOrder->seller_id,
                    ],
                    [
                        'shipping_status' => $shippingStatus ?: 'pending',
                        'tracking_number' => $checkout->tracking_number ?? null,
                        'seller_subtotal' => $sellerOrder->seller_subtotal ?? 0,
                        'cancelled_at' => $checkout->cancelled_at ?? null,
                        'cancelled_by' => $checkout->cancelled_by ?? null,
                        'cancellation_reason' => $checkout->cancellation_reason ?? null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
            // Intentionally left empty.
            // Backfilled seller-order records are preserved to avoid
            // accidentally deleting fulfillment history.
    }
};