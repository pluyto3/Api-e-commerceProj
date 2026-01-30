<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BrandsController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\AddToCartController;
use App\Http\Controllers\CheckoutController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
//     return $request->user();
// });

// Authentication Routes
Route::controller(AuthController::class)->group(function () {
  Route::post('/register', 'register'); // Register a new user
  Route::post('/login', 'login'); // Login an existing user 
  Route::post('/logout', 'logout'); // Logout the authenticated user
  Route::get('/admins', 'getAdmins'); // Get all admins
  Route::get('/sellers', 'getSellers'); // Get all sellers
  Route::get('/users', 'getUsers'); // Get all users
  Route::get('/countedAccounts', 'countAccounts'); // Count all users
  Route::get('/countedAdmins', 'countAdmins'); // Count all admins
  Route::get('/countedSellers', 'countSellers'); // Count all sellers
  Route::get('/countedUsers', 'countUsers'); // Count all users
  Route::get('/countedCategories', 'countCategories'); // Count all categories
  Route::get('/countedBrands', 'countBrands'); // Count all brands
  Route::get('/countedCheckout', 'countCheckout'); // Count all checkout
  Route::get('/counts', 'counts'); // Get Counts
  Route::get('/getAccount_id/{id}', 'getAccount_id'); // Get a specific user by ID
  Route::put('/updateAccount/{id}', 'updateAccount'); // Update Account
  Route::delete('/deleteAccount/{id}', 'deleteAccount'); // Deleteing Accounts
  Route::get('/verify-email/{token}', 'verifyEmail'); // Verify Email
  Route::post('/forgot-password', 'forgotPassword'); // Forgot Password
  Route::post('/reset-password/{token}', 'resetPassword'); // Reset Password
  Route::get('/getAccount_username/{username}', 'getAccount_username'); // Get a specific user by username
  Route::put('/updateImageAccount/{id}', 'updateImageAccount'); // Update Account Image
});

// Product Routes
Route::group(['prefix' => 'products'], function($router) {
    Route::controller(ProductController::class)->group(function () {
        Route::get('/', 'index'); // Get all products
        Route::post('/', 'createProduct'); // Create a new product
        Route::get('/{id}', 'getProduct_id'); // Get a specific product
        Route::put('/{id}', 'updateProduct'); // Update a specific product
        Route::delete('/{id}', 'deleteProduct'); // Delete a specific product
    });
});

// Order Routes
// Route::group(['prefix' => 'orders'], function($router) {
//     Route::controller(OrderController::class)->group(function () {
//         Route::get('/', 'index'); // Get all orders 
//         Route::get('/detail/{id}', 'get_order_id'); // Get a specific order by ID
//         Route::post('/', 'createOrder'); // Create a new Order
//         Route::get('/items/{id}', 'get_order_items'); // Get order items by ID
//         Route::get('/user/{id}', 'get_user_orders'); // Get User Orders by ID
//         Route::post('/status/{id}', 'change_order_status'); // Get User Orders by ID
//     });
// });

// Category Routes
Route::group(['prefix' => 'category'], function($router) {
    Route::controller(CategoryController::class)->group(function () {
        Route::get('/', 'index'); // Get all categories
        Route::post('/', 'createCategory'); // Create a new category
        Route::get('/{id}', 'getCategory_id'); // Get a specific category by ID
        Route::delete('/{id}', 'deleteCategory'); // Delete a specific category by ID
        Route::put('/{id}', 'updateCategory'); // Update a specific category
        Route::post('/{id}', 'updateCategory'); // Update a specific category
    });
});

// Brands Routes
Route::group(['prefix' => 'brands'], function($router) {
    Route::controller(BrandsController::class)->group(function () {
        Route::get('/', 'index'); // Get all brands
        Route::post('/', 'createBrands'); // Create a new brand
        Route::get('/{id}', 'getBrands_id'); // Get a specific brand by ID
        Route::put('/{id}', 'updateBrands'); // Update a specific brand by ID
        Route::post('/{id}', 'updateBrands'); // Update a specific brand by ID
        Route::delete('/{id}', 'deleteBrands'); // Delete a specific brand by ID
    });
});

// Location Routes
Route::group(['prefix' => 'location'], function($router) {
    Route::controller(LocationController::class)->group(function () {
       // Route::get('/', 'index');  Get all locations
        Route::put('/{id}/setDefaultAddress', 'setDefaultAddress'); // Set a location as default
        Route::get('/', 'getUserLocations'); // Get locations for a specific user
        Route::get('/{id}', 'getLocation_id'); // Get a specific location by ID
        Route::post('/', 'createLocation'); // Create a new location
        Route::put('/{id}', 'updateLocation'); // Update a specific location by ID
        Route::post('/{id}', 'updateLocation'); // Update a specific location by ID
        Route::delete('/{id}', 'deleteLocation'); // Delete a specific location by ID
    });
});

// Add to Cart Routes
Route::group(['prefix' => 'cart'], function($router) {
    Route::controller(AddToCartController::class)->group(function () {
        Route::post('/', 'addToCart'); // Add a product to the cart
        Route::get('/', 'getCart'); // Add a product to the cart
        Route::post('/{id}', 'updateCart'); // Update the cart
        Route::delete('/{id}', 'removeFromCart'); // Remove a product from the cart
    });
});

// Checkout Routes
Route::group(['prefix' => 'checkout'], function($router) {
    Route::controller(CheckoutController::class)->group(function () {
        Route::post('/', 'createCheckout'); // Create a new checkout
        Route::get('/orders', 'getUserOrders'); // Get user orders
        Route::get('/orders/{id}', 'getOrderDetails'); // Get order details by ID
        Route::put('/orders/{id}/status', 'updateStatus'); // Cancel an order by ID
        Route::put('/orders/{id}/cancel', 'cancelOrder'); // Count all orders
        Route::get('/all', 'getAllOrders'); // Get all orders (admin)
    });

// Chart Dashboard Routes
    Route::group(['prefix' => 'dashboard'], function($router) {
        Route::controller(CheckoutController::class)->group(function () {
            Route::get('/orders/monthly', 'ordersMonthly'); // Get sales data for dashboard
            Route::get('/orders/status', 'ordersByStatus'); // Get order status counts for dashboard
        });
    });
    
});