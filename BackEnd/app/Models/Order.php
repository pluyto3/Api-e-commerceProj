<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $table = 'orders';

    protected $fillable = [
        'status',
        'user_id',
        'location_id',
        'total_price',
        'date_of_delivery'
    ];


    public function user()
    {
        return $this->hasMany(User::class, 'user_id');
    }

    public function location()
    {
        return $this->belongsTo(Location::class, 'location_id');
    }

    public function Items()
    {
        return $this->hasMany(OrderItems::class);
    }
}
