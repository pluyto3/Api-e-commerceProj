<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CheckoutItem extends Model
{
    use HasFactory;

    protected $table = 'checkout_items';

    protected $primaryKey = 'checkout_item_id';

    protected $fillable = [
        'checkout_id',
        'product_id',
        'quantity',
        'price',
        'subtotal',
    ];

    public function checkout()
    {
        return $this->belongsTo(Checkout::class, 'checkout_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
