<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class addToCart extends Model
{
    use HasFactory;

    protected $table = 'add_to_cart';

    protected $fillable = [
        'user_id',
        'product_id',
        'quantity',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function product()   
    {
        return $this->belongsTo(Product::class, 'product_id', 'product_id'); 
    }

    protected $primaryKey = 'addTocart_id';
}
