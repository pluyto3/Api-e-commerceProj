<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Category;
use App\Models\Brands;
use App\Models\Checkout;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\File;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

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
            // Server settings
            $mail->isSMTP();
            $mail->Host = 'smtp.gmail.com'; // Your SMTP server
            $mail->SMTPAuth = true;
            $mail->Username = 'dummyodinvalhalla17@gmail.com'; // Your SMTP username
            $mail->Password = 'wycikkvaaxagvynz';    // Your SMTP password or App Password
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;  // TLS encryption;
            $mail->Port = 587;

            // Recipients
            $mail->setFrom('your_email@gmail.com', 'Your App');
            $mail->addAddress($user->email, $user->fullname);

            // Content
            $verifyUrl = url('/api/verify-email/' . $user->verification_token);
            $mail->isHTML(true);
            $mail->Subject = 'Verify Your Email';
            $mail->Body    = "Hello {$user->fullname},<br><br>
                            Please click the link below to verify your email:<br>
                            <a href='{$verifyUrl}'>Verify Email</a><br><br>
                            Thanks,<br>Your App Team";

            $mail->send();
        } catch (Exception $e) {
            \Log::error("Email could not be sent. Mailer Error: {$mail->ErrorInfo}");
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
                $mail->isSMTP();
                $mail->Host       = 'smtp.gmail.com';
                $mail->SMTPAuth   = true;
                $mail->Username   = 'dummyodinvalhalla17@gmail.com';   // Your SMTP username
                $mail->Password   = 'wycikkvaaxagvynz';      // Gmail app password
                $mail->SMTPSecure = 'tls';
                $mail->Port       = 587;

                $mail->setFrom('your_email@gmail.com', 'Your App');
                $mail->addAddress($user->email, $user->fullname);

                $resetUrl = 'http://localhost/e-commerce/FrontEnd/resetPassword.html?token=' . $user->reset_token;

                $mail->isHTML(true);
                $mail->Subject = 'Reset Your Password';
                $mail->Body    = "Hello {$user->fullname},<br><br>
                                You requested a password reset.<br>
                                Please click the link below to reset your password:<br>
                                <a href='{$resetUrl}'>Reset Password</a><br><br>
                                If you did not request this, ignore this email.<br><br>
                                Thanks,<br>Your App Team";

                $mail->send();
            } catch (Exception $e) {
                \Log::error("Reset email could not be sent. Error: {$mail->ErrorInfo}");
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
        $username = $request->username;
        if (!User::where('username', $username)->exists()) {
            return response()->json([
            'msg' => 'Username does not exist.'
            ], 400);
        }
        $password = $request->password;
        $user = User::where('username', $username)->first();
        if($user){
            if (!$user || !Hash::check($request->password, $user->password)) {
                return response()->json([
                    'msg' => 'Invalid Password.'
                ], 401);
            }
            
            // Check if email is verified
            if (is_null($user->email_verified_at)) {
                return response()->json([
                    'msg' => 'Please verify your email before logging in.'
                ], 400);
            }
             
            $token = bin2hex(random_bytes(8));
            $user->token = $token;
            $user->save();
            return response()->json([
                'token' => $token,
                'username' => $user->username,
                'role'  => $user->role,
                'user_id' => $user->user_id,
            ], 200);
        }
        else {
            return response()->json([
                'msg' => 'Access Denied.'
            ], 400);
        }
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
    public function checkoutOrders(){
        
        $totalCheckout = Checkout::count();

        return response()->json([
            'totalCheckout' => $totalCheckout
        ], 200);
    }

    /**
     * Role Based Counts
     */
     public function counts(Request $request)
    {
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
            'total_orders' => 0,
            'pending_orders' => 0,
            'completed_orders' => 0,
        ];

        // ==========================
        // ADMIN COUNTS
        // ==========================
        if ($user->role === 'admin') {
            $data['categories'] = Category::count();
            $data['brands'] = Brands::count();
            $data['users'] = User::where('role', 'user')->count();
            
            // Admin sees ALL orders
            $data['total_orders'] = Checkout::count();
            $data['pending_orders'] = Checkout::where('status', 'pending')->count();
            $data['completed_orders'] = Checkout::where('status', 'completed')->count();
        }

        // ==========================
        // SELLER COUNTS
        // ==========================
        if ($user->role === 'seller') {
            $data['total_orders'] = Checkout::where('seller_id', $user->user_id)->count();
            
            $data['pending_orders'] = Checkout::where('seller_id', $user->user_id)
                ->where('status', 'pending')
                ->count();
                
            $data['completed_orders'] = Checkout::where('seller_id', $user->user_id)
                ->where('status', 'completed')
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
}   
