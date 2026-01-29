<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Category;
use App\Models\Brands;

class Product extends Model
{
    use HasFactory;

    protected $table = 'products';
    
    protected $fillable = [
        'category_id',
        'brand_id',
        'product_name',
        'product_price',
        'product_description',
        'stock_quantity',
        'image',
        'status',
    ];

    public function category()
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function brand()
    {
        return $this->belongsTo(Brands::class, 'brand_id');
    }

    public function cartItems()
    {
        return $this->hasMany(addToCart::class, 'product_id', 'product_id');
    }

    public function checkoutItems()
    {
        return $this->hasMany(CheckoutItem::class, 'product_id', 'product_id');
    }


    protected $primaryKey = 'product_id';
}
