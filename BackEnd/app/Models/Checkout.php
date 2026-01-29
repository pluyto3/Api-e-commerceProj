<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Checkout extends Model
{
    use HasFactory;

    protected $table = 'checkouts';

    protected $fillable = [
        'user_id', 
        'payment_method', 
        'purok',
        'barangay',
        'city',
        'province',
        'phone_number',
        'total_amount',
        'status',
        'tracking_number'
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
    
    public function items()
    {
        return $this->hasMany(CheckoutItem::class, 'checkout_id', 'checkout_id');
    }

    public function location()
    {
        return $this->belongsTo(Location::class, 'location_id');
    }

    protected $primaryKey = 'checkout_id';

    
}
