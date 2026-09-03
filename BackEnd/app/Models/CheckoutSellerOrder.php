<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CheckoutSellerOrder extends Model
{
    use HasFactory;

    protected $table = 'checkout_seller_orders';

    protected $primaryKey = 'checkout_seller_order_id';

    protected $fillable = [
        'checkout_id',
        'seller_id',
        'shipping_status',
        'tracking_number',
        'seller_subtotal',
        'cancelled_at',
        'cancelled_by',
        'cancellation_reason',
    ];

    protected $casts = [
        'seller_subtotal' => 'decimal:2',
        'cancelled_at' => 'datetime',
    ];

    public function checkout()
    {
        return $this->belongsTo(
            Checkout::class,
            'checkout_id',
            'checkout_id'
        );
    }

    public function seller()
    {
        return $this->belongsTo(
            User::class,
            'seller_id',
            'user_id'
        );
    }

    public function cancelledBy()
    {
        return $this->belongsTo(
            User::class,
            'cancelled_by',
            'user_id'
        );
    }
}