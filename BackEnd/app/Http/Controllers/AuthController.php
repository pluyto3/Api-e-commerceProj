<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Category;
use App\Models\Brands;
use App\Models\Checkout;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\File;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use App\Services\PushNotificationService;

class AuthController extends Controller
{
    /**
     * User registration
     */
    public function register(Request $request){

        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:255|unique:users,username',
            'email' => 'required|string|email|max:255|unique:users,email',
            'phone_number' =>'required|string|max:13|unique:users,phone_number',
            'password' => 'required|string|min:8|confirmed',
            'fullname' => 'required|string|max:255',
            'role' => 'required|string|max:50',
        ], [
            'username.unique' => 'This username is already taken.',
            'email.unique' => 'This email is already registered.',
            'phone_number.unique' => 'This phone number is already been registered.',
            'password.confirmed' => 'Password confirmation does not match.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $validated = $validator->validated();

        // Generate verification token
        $verificationToken = Str::random(15);

        // Create the user
        $user = User::create([
            'username' => $validated['username'],
            'email' => $validated['email'],
            'phone_number' => $validated['phone_number'],
            'password' => Hash::make($validated['password']),
            'fullname' => $validated['fullname'],
            'role' => $validated['role'],
            'token' => '',
            'verification_token' => $verificationToken,
        ]);

        // Send verification email
        $this->sendVerificationEmail($user);

        return response()->json([
            'msg' => 'User successfully registered.',
            'user' => $user->only(['id', 'username', 'email', 'phone_number', 'fullname', 'role']) // exclude password
        ], 201);
    } 

    /**
     * PHP Mailer for sending verification email
     */

    private function sendVerificationEmail($user){
        $mail = new PHPMailer(true);
        try {
            // Server settings from .env
            $mail->isSMTP();
            $mail->Host = config('mail.mailers.smtp.host'); // Your SMTP server
            $mail->SMTPAuth = true;
            $mail->Username = config('mail.mailers.smtp.username'); // Your SMTP username
            $mail->Password = config('mail.mailers.smtp.password');    // Your SMTP password or App Password
            $mail->Port = config('mail.mailers.smtp.port');

            if (config('mail.mailers.smtp.encryption') === 'tls') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            } elseif (config('mail.mailers.smtp.encryption') === 'ssl') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            }

            // Sender
            $mail->setFrom(
                config('mail.from.address'),
                config('mail.from.name')
            );

            // Recipient
            $mail->addAddress($user->email, $user->fullname);

            // Verification URL
            $verifyUrl = url('/api/verify-email/' . $user->verification_token);

            // Email content
            $mail->isHTML(true);
            $mail->Subject = 'Verify Your Email';
            $mail->Body = "
                Hello {$user->fullname},<br><br>
                Please click the link below to verify your email:<br>
                <a href='{$verifyUrl}'>Verify Email</a><br><br>
                Thanks,<br>
                Hanz-Go Team
            ";

            $mail->send();
        } catch (Exception $e) {
            \Log::error("Verification email could not be sent. Mailer Error: {$mail->ErrorInfo}");
        }
    }

    /**
     * Verify Email
     */
    public function verifyEmail(Request $request, $token){

        $user = User::where('verification_token', $token)->first();

        if (!$user) {
            return response()->json([
                'msg' => 'Invalid or expired verification token.'
            ], 400);
        }

            // Check if already verified
        if ($user->email_verified_at) {
            return response()->json([
                'msg' => 'Email is already verified.'
            ], 400);
        }

        $user->email_verified_at = now();
        $user->verification_token = null; // Clear the token
        $user->save();

        return response()->json([
            'msg' => 'Email successfully verified! You can now log in.',
        ], 200);
    }

    /**
     * Reset Password
     */
    public function forgotPassword(Request $request) {
        
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email|max:255|exists:users,email',
        ], [
            'email.exists' => 'This email is not registered.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $validated = $validator->validated();

        // Generate reset token
        $resetToken = Str::random(15);

        // Save the reset token to the user
        $user = User::where('email', $validated['email'])->first();
        $user->reset_token = $resetToken;
        $user->save();

        // Send reset email
        $this->sendResetEmail($user);

        return response()->json([
            'msg' => 'Password reset link has been sent to your email.',
        ], 200);
    }

    /**
     * PHP Mailer for sending reset email
     */
    public function sendResetEmail($user) {

        $mail = new PHPMailer(true);

            try {
                // Server settings from .env
                $mail->isSMTP();
                $mail->Host = config('mail.mailers.smtp.host');
                $mail->SMTPAuth = true;
                $mail->Username = config('mail.mailers.smtp.username');
                $mail->Password = config('mail.mailers.smtp.password');
                $mail->Port = config('mail.mailers.smtp.port');

            if (config('mail.mailers.smtp.encryption') === 'tls') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            } elseif (config('mail.mailers.smtp.encryption') === 'ssl') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            }

            // Sender
            $mail->setFrom(
                config('mail.from.address'),
                config('mail.from.name')
            );

            // Recipient
            $mail->addAddress($user->email, $user->fullname);

            // Reset password URL
            $resetUrl = 'http://localhost/e-commerce/FrontEnd/resetPassword.html?token=' . $user->reset_token;

            // Escape user values before placing them in HTML
            $fullname = htmlspecialchars($user->fullname, ENT_QUOTES, 'UTF-8');

            // Email content
            $mail->isHTML(true);
            $mail->Subject = 'Reset Your Password';
            $mail->Body = "
                Hello {$fullname},<br><br>
                You requested a password reset.<br>
                Please click the link below to reset your password:<br>
                <a href='{$resetUrl}'>Reset Password</a><br><br>
                If you did not request this, you can ignore this email.<br><br>
                Thanks,<br>
                Hanz-Go Team
            ";

            $mail->send();
            } catch (Exception $e) {
                \Log::error("Reset email could not be sent. Mailer Error: {$mail->ErrorInfo}");
            }
    }

    /**
     * PHP Mailer for sending reset email
     */
    
    public function resetPassword(Request $request, $token) {
        $user = User::where('reset_token', $token)->first();

        if (!$user) {
            return response()->json([
                'msg' => 'Invalid or expired reset token.'
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'password' => 'required|string|min:8|confirmed',
        ], [
            'password.confirmed' => 'Password confirmation does not match.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $validated = $validator->validated();

        // Update the user's password
        $user->password = Hash::make($validated['password']);
        $user->reset_token = null; // Clear the reset token
        $user->save();

        return response()->json([
            'msg' => 'Password has been reset successfully. You can now log in with your new password.',
        ], 200);
    }


    /**
     * User login
     */
    public function login(Request $request){
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $request->username)->first();

        if (!$user) {
            return response()->json(['msg' => 'Username does not exist.'], 400);
        }

        if (!Hash::check($request->password, $user->password)) {
            return response()->json(['msg' => 'Wrong password.'], 401);
        }

        if (is_null($user->email_verified_at)) {
            return response()->json([
                'msg' => 'Please verify your email before logging in.'
            ], 400);
        }

        $user->token = bin2hex(random_bytes(16));
        $user->save();

        return response()->json([
            'token' => $user->token,
            'username' => $user->username,
            'role' => $user->role,
            'user_id' => $user->user_id,
        ], 200);
    }

    /**
     * User logout
     */
    public function logout(Request $request){
        $tokenh = $request->bearerToken();
        if($tokenh){
            $token = $request->token;
            if($tokenh == $token){
                $user = User::where('token', $token)->first();
                if($user){
                    $user->token = '';
                    $user->save();
                    return response()->json([
                        'msg' => 'Thank you.'
                    ], 200);
                }
                else {
                    return response()->json([
                        'msg' => 'Access Denied'
                    ], 400);
                }
            }
            else{
                return response()->json([
                    'msg' => 'Invalid Token.'
                ], 400);
            }
        }
        else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
    }

    /**
     * Get Account by ID
     */
    public function getAccount_id(Request $request, $id) {
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user && $user->role === 'admin'){
                $account = User::find($id);
                if($account->role === 'admin'){
                    return response()->json($account, 200);
                } else if ($account->role === 'seller'){
                    return response()->json($account, 200); 
                } else if ($account->role === 'user') {
                    return response()->json($account, 200);
                } else {
                    return response()->json(['message' => 'Account not Found'], 404);
                }
            } else {
                return response()->json([
                    'msg' => 'No user found.'
                ], 400);
            }
        } else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
    }

    /**
     * Get Account by Username profile section
     */
    public function getAccount_username(Request $request, $username) {
        $token = $request->bearerToken();
        if($token){
            $user = User::where('token', $token)->first();
            if($user){
                $account = User::where('username', $username)->first();
                if($account){
                    return response()->json($account, 200);
                } else {
                    return response()->json(['message' => 'Account not Found'], 404);
                }
            } else {
                return response()->json([
                    'msg' => 'Invalid Token.'
                ], 400);
            }
        } else {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
    }

    /**
     * Update Account by ID
     */
    public function updateAccount(Request $request, $id) {
        $token = $request->bearerToken();
        if($token) {

            $user = User::where('token', $token)->first();

            if (!$user || $user->role !== 'admin') {
                return response()->json([
                    'msg' => 'Not Authorized. Only Admins can Update Accounts'
                ], 403);

                }

                $account = User::find($id);

                if (!$account) {
                return response()->json(['msg' => 'Account not found.'], 404);  
                }

                $validated = $request->validate([
                    'editUsername' => 'sometimes|string|max:255|unique:users,username,' . $account->user_id . ',user_id',
                    'editPhone_number' => 'sometimes|string|max:13|unique:users,phone_number,' . $account->user_id . ',user_id',
                    'editEmail'    => 'sometimes|string|email|max:255|unique:users,email,' . $account->user_id . ',user_id',
                    'editFullname' => 'sometimes|string|max:255',
                    'editRole'     => 'sometimes|string|in:admin,seller,user',
                    'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:102400'
                ], [
                    'username.unique' => 'This username is already taken.',
                    'email.unique'    => 'This email is already registered.',
                    'role.in'         => 'Role must be either admin, seller, or user.',
                ]);

                $account->username = $request->editUsername;
                $account->phone_number = $request->editPhone_number;
                $account->email = $request->editEmail;
                $account->fullname = $request->editFullname;
                $account->role = $request->editRole;
                $account->save();

                return response()->json([
                    'msg' => 'Account info updated successfully.',
                    'user' => $account->only(['user_id', 'username', 'email', 'fullname', 'role']),
                    'status' => 200,
                ]);
        } else {    
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
    }

    /**
     * Update Image Accounts
     */
    public function updateImageAccount(Request $request, $id){
        try {
            $token = $request->bearerToken();
            if (!$token) {
                return response()->json(['msg' => 'No Token Provided.'], 400);
            }

            $user = User::where('token', $token)->first();
            if (!$user) {
                return response()->json(['msg' => 'Not Authorized to Update Account'], 403);
            }

            $account = User::find($id);
            if (!$account) {
                return response()->json(['msg' => 'Account not found.'], 404);
            }

            // safer validation
            $request->validate([
                'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:102400',
            ]);

            $image = $request->file('image');
            $imageName = time() . '.' . $image->getClientOriginalExtension();
            $destinationPath = public_path('FrontEnd/assets/img/user');

            if (!File::exists($destinationPath)) {
                File::makeDirectory($destinationPath, 0755, true);
            }

            $image->move($destinationPath, $imageName);
            $account->image = $imageName;
            $account->save();

            return response()->json([
                'msg' => 'Account image updated successfully.',
                'user' => $account->only(['user_id', 'username', 'email', 'fullname', 'role', 'image']),
                'status' => 200,
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'msg' => 'Server Error: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get all Admin accounts
     */
    public function getAdmins(){

        $admins = User::where('role', 'admin')->get(['user_id', 'username', 'email', 'fullname', 'phone_number', 'role', 'image']);

        return response()->json([
            'admins' => $admins
        ], 200);
    }

    /**
     * Get All Seller Accounts
     */
    public function getSellers(){

        $sellers = User::where('role', 'seller')->get(['user_id', 'username', 'email', 'fullname', 'phone_number', 'role', 'image']);

        return response()->json([
            'sellers' => $sellers
        ], 200);
    }

    /**
     * Get All Users Accounts
     */
    public function getUsers(){

        $users = User::where('role', 'user')->get(['user_id', 'username', 'email', 'fullname', 'phone_number', 'role', 'image']);

        return response()->json([
            'users' => $users
        ], 200);
    }

    /**
     * Get account tables and counts in one request.
     */
    public function accountsSummary(){

        $columns = ['user_id', 'username', 'email', 'fullname', 'phone_number', 'role', 'image'];
        $admins = User::where('role', 'admin')->get($columns);
        $sellers = User::where('role', 'seller')->get($columns);
        $users = User::where('role', 'user')->get($columns);

        return response()->json([
            'admins' => $admins,
            'sellers' => $sellers,
            'users' => $users,
            'totalAccounts' => User::count(),
            'totalAdmins' => $admins->count(),
            'totalSellers' => $sellers->count(),
            'totalUsers' => $users->count(),
        ], 200);
    }

    /**
     * Get All Account Counts
     */
    public function countAccounts(){

        $totalAccounts = User::count();

        return response()->json([
            'totalAccounts' => $totalAccounts
        ], 200);
    }

    /**
     * Get All Admin Counts
     */
    public function countAdmins(){
        
        $totalAdmins = User::where('role', 'admin')->count();

        return response()->json([
            'totalAdmins' => $totalAdmins
        ], 200);
    }

    /**
     * Get All Seller Counts
     */
    public function countSellers(){
        
        $totalSellers = User::where('role', 'seller')->count();

        return response()->json([
            'totalSellers' => $totalSellers
        ], 200);
    }

    /**
     * Get All Users Counts
     */
    public function countUsers(){
        
        $totalUsers = User::where('role', 'user')->count();

        return response()->json([
            'totalUsers' => $totalUsers
        ], 200);
    }

    /**
     * Get All Categories Counts
     */
    public function countCategories(){
        
        $totalCategories = Category::count();

        return response()->json([
            'totalCategories' => $totalCategories
        ], 200);
    }

    /**
     * Get All Brand Counts
     */
    public function countBrands(){
        
        $totalBrands = Brands::count();

        return response()->json([
            'totalBrands' => $totalBrands
        ], 200);
    }

    /**
     * Get All Order Counts
     */
    public function countCheckout(){
        
        $totalCheckout = Checkout::count();

        return response()->json([
            'totalCheckout' => $totalCheckout
        ], 200);
    }

    /**
     * Backward-compatible alias for legacy calls
     */
    public function checkoutOrders(){
        return $this->countCheckout();
    }

    /**
     * Role Based Counts
     */

    public function counts(Request $request){
        $token = $request->bearerToken();
        $user = User::where('token', $token)->first();

        if (!$user) {
            return response()->json(['msg' => 'Unauthorized'], 401);
        }

        // Initialize counts array
        $data = [
            'role' => $user->role,
            // Default counts
            'categories' => 0,
            'brands' => 0,
            'users' => 0,
            'total_products' => 0,
            'my_products' => 0,
            'pending_approval' => 0,
            'approved_products' => 0,
            'total_orders' => 0,
            'pending_orders' => 0,
            'completed_orders' => 0,
            'cancelled_orders' => 0,
            'low_stock_products' => 0,
        ];

        // ==========================
        // ADMIN COUNTS
        // ==========================
        if ($user->role === 'admin') {
            $data['categories'] = Category::count();
            $data['brands'] = Brands::count();
            $data['users'] = User::where('role', 'user')->count();
            $data['total_products'] = Product::count();
            
            // Admin sees ALL orders
            $data['total_orders'] = Checkout::count();
            $data['pending_orders'] = Checkout::where(function ($query) {
                $query->where('shipping_status', 'pending')
                    ->orWhere('status', 'pending');
            })->count();
            $data['completed_orders'] = Checkout::where(function ($query) {
                $query->where('shipping_status', 'delivered')
                    ->orWhere('status', 'completed')
                    ->orWhere('status', 'delivered');
            })->count();
            $data['cancelled_orders'] = Checkout::where(function ($query) {
                $query->where('shipping_status', 'cancelled')
                    ->orWhere('status', 'cancelled');
            })->count();
            $data['low_stock_products'] = Product::where('stock_quantity', '>', 0)
                ->where('stock_quantity', '<=', 3)
                ->count();
        }

        // ==========================
        // SELLER COUNTS
        // ==========================
        if ($user->role === 'seller') {
            $sellerProducts = Product::where('seller_id', $user->user_id);

            $data['my_products'] = (clone $sellerProducts)->count();
            $data['pending_approval'] = (clone $sellerProducts)
                ->where(function ($query) {
                    $query->whereNull('approval_status')
                        ->orWhere('approval_status', 'pending');
                })
                ->count();
            $data['approved_products'] = (clone $sellerProducts)
                ->where('approval_status', 'approved')
                ->count();
            $data['low_stock_products'] = (clone $sellerProducts)
                ->where('stock_quantity', '>', 0)
                ->where('stock_quantity', '<=', 3)
                ->count();

            $sellerOrders = Checkout::whereHas('items', function ($query) use ($user) {
                $query->where('seller_id', $user->user_id);
            });

            $data['total_orders'] = (clone $sellerOrders)->count();
            $data['pending_orders'] = (clone $sellerOrders)
                ->where(function ($query) {
                    $query->where('shipping_status', 'pending')
                        ->orWhere('status', 'pending');
                })
                ->count();
            $data['completed_orders'] = (clone $sellerOrders)
                ->where(function ($query) {
                    $query->where('shipping_status', 'delivered')
                        ->orWhere('status', 'completed')
                        ->orWhere('status', 'delivered');
                })
                ->count();
            $data['cancelled_orders'] = (clone $sellerOrders)
                ->where(function ($query) {
                    $query->where('shipping_status', 'cancelled')
                        ->orWhere('status', 'cancelled');
                })
                ->count();
        }

        // ==========================
        // USER (optional)
        // ==========================
        return response()->json($data, 200);
    }


    /**
     * Deleting Accounts 
     */
    public function deleteAccount(Request $request, $id) {
        $token = $request->bearerToken();
        if($token) {

            $user = User::where('token', $token)->first();

            if (!$user || $user->role !== 'admin') {
                return response()->json([
                    'msg' => 'Not Authorized. Only Admins can Delete Accounts'
                ], 403);

                }

                // Prevent deleting super admin or the id = 1
                if ($id == 1) {
                    return response()->json([
                        'msg' => 'Super Admin cannot be deleted.'
                    ], 403);
                }

                $account = User::find($id);

                if (!$account) {
                return response()->json(['msg' => 'Account not found.'], 404);
                }

                // If this is the last admin, block deletion
                // if ($account->role === 'admin' && User::where('role', 'admin')->count() === 1) {
                //     return response()->json([
                //         'msg' => 'At least one admin must remain in the system.'
                //     ], 403);
                // }

                $account->delete();

                return response()->json([
                    'msg' => 'Account deleted successfully.',
                    'id' => $id,
                    'status' => 200,
                ]);
        } else {    
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 400);
        }
    }

    /**
     * Send Contact Email
     */
    public function sendContactEmail(Request $request) {

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'email' => 'required|email|max:150',
            'subject' => 'required|string|max:150',
            'message' => 'required|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'msg' => 'Please complete all required fields correctly.',
                'errors' => $validator->errors()
            ], 422);
        }

        $validated = $validator->validated();

        $mail = new PHPMailer(true);

        try {
            $mail->isSMTP();
            $mail->Host = config('mail.mailers.smtp.host');
            $mail->SMTPAuth = true;
            $mail->Username = config('mail.mailers.smtp.username');
            $mail->Password = config('mail.mailers.smtp.password');
            $mail->Port = config('mail.mailers.smtp.port');

            if (config('mail.mailers.smtp.encryption') === 'tls') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            } elseif (config('mail.mailers.smtp.encryption') === 'ssl') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            }

            // Set recipient to App Name
            $mail->setFrom(
                config('mail.from.address'),
                config('mail.from.name')
            );

            // Admin/default e-commerce email
            $mail->addAddress(env('CONTACT_ADMIN_EMAIL'));

            // Customer email, so admin can reply directly
            $mail->addReplyTo($validated['email'], $validated['name']);

            $name = htmlspecialchars($validated['name'], ENT_QUOTES, 'UTF-8');
            $email = htmlspecialchars($validated['email'], ENT_QUOTES, 'UTF-8');
            $subject = htmlspecialchars($validated['subject'], ENT_QUOTES, 'UTF-8');
            $message = nl2br(htmlspecialchars($validated['message'], ENT_QUOTES, 'UTF-8'));

            $mail->isHTML(true);
            $mail->Subject = 'Hanz-Go Contact Us Message: ' . $subject;
            $mail->Body = "
                <h2>New Contact Us Message</h2>
                <p><strong>Name:</strong> {$name}</p>
                <p><strong>Email:</strong> {$email}</p>
                <p><strong>Subject:</strong> {$subject}</p>
                <hr>
                <p><strong>Message:</strong></p>
                <p>{$message}</p>
            ";

            $mail->send();

            // Notify admin through FCM after the email is successfully sent
            try {
                $admin = User::where('email', env('CONTACT_ADMIN_EMAIL'))->first();

                \Log::info('Contact notification admin lookup:', [
                    'contact_admin_email' => env('CONTACT_ADMIN_EMAIL'),
                    'admin_found' => $admin ? true : false,
                    'admin_user_id' => $admin ? $admin->user_id : null,
                ]);

                if ($admin) {
                    app(PushNotificationService::class)->sendToUser(
                        $admin->user_id,
                        'New Contact Message',
                        'A customer sent a message through Contact Us.',
                        '',
                        'contact_message',
                        null
                    );
                } else {
                    \Log::warning('Contact FCM notification not sent: admin email not found in users table.', [
                        'contact_admin_email' => env('CONTACT_ADMIN_EMAIL'),
                    ]);
                }
            } catch (\Exception $notificationError) {
                \Log::error('Contact FCM notification failed: ' . $notificationError->getMessage());
            }

            return response()->json([
                'msg' => 'Message sent successfully!'   
            ], 200);

        } catch (Exception $e) {
            \Log::error("Contact email could not be sent. Mailer Error: {$mail->ErrorInfo}");

            return response()->json([
                'msg' => 'Message could not be sent. Please try again later.',
                'error' => $mail->ErrorInfo
            ], 500);
        }
    }
}   
