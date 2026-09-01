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
use Illuminate\Support\Facades\Mail;
use App\Services\PushNotificationService;
use App\Models\FcmToken;
use Illuminate\Support\Facades\DB;

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
            'role' => 'required|string|in:user,seller',
        ], [
            'username.unique' => 'This username is already taken.',
            'email.unique' => 'This email is already registered.',
            'phone_number.unique' => 'This phone number is already been registered.',
            'password.confirmed' => 'Password confirmation does not match.',
            'role.in' => 'You may register only as a Customer or Seller.',
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
        try {
            $this->sendVerificationEmail($user);

        } catch (\Throwable $e) {

            \Log::error(
                'Registration verification email failed.',
                [
                    'user_id' => $user->user_id,
                    'email' => $user->email,
                    'error' => $e->getMessage(),
                ]
            );

            return response()->json([
                'msg' => 'Your account was created, but the verification email could not be sent. Please use Resend Verification Email on the login page.'
            ], 201);
        }

        // Registration successful and verification email sent
        return response()->json([
            'msg' => 'User successfully registered. Please check your email to verify your account.',
            'user' => $user->only([
                'user_id',
                'username',
                'email',
                'phone_number',
                'fullname',
                'role'
            ])
        ], 201);
    }

    /**
     * PHP Mailer for sending verification email
     */ 
    public function adminCreateAccount(Request $request) {
        
        // Check admin authentication
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 401);
        }

        $admin = User::where('token', $token)->first();

        if (!$admin || $admin->role !== 'admin') {
            return response()->json([
                'msg' => 'Unauthorized. Only administrators can create accounts.'
            ], 403);
        }

        // Validate account data
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:255|unique:users,username',
            'email' => 'required|string|email|max:255|unique:users,email',
            'phone_number' => 'required|string|max:13|unique:users,phone_number',
            'password' => 'required|string|min:8|confirmed',
            'fullname' => 'required|string|max:255',
            'role' => 'required|string|in:admin,seller,user',
        ], [
            'username.unique' => 'This username is already taken.',
            'email.unique' => 'This email is already registered.',
            'phone_number.unique' => 'This phone number is already registered.',
            'password.confirmed' => 'Password confirmation does not match.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $validated = $validator->validated();

        // Create account as already verified
        $user = User::create([
            'username' => $validated['username'],
            'email' => $validated['email'],
            'phone_number' => $validated['phone_number'],
            'password' => Hash::make($validated['password']),
            'fullname' => $validated['fullname'],
            'role' => $validated['role'],
            'token' => '',
            'email_verified_at' => now(),
            'verification_token' => null,
        ]);

        return response()->json([
            'msg' => 'Account created successfully.',
            'user' => $user->only([
                'user_id',
                'username',
                'email',
                'phone_number',
                'fullname',
                'role',
                'email_verified_at',
            ])
        ], 201);
    }

    /**
     * PHP Mailer for sending verification email
     */
    private function sendVerificationEmail($user) {

        $verifyUrl = url(
            '/api/verify-email/' .
            urlencode($user->verification_token)
        );

        $fullname = htmlspecialchars(
            $user->fullname,
            ENT_QUOTES,
            'UTF-8'
        );

        $body = "

            <h2>Verify Your Email</h2>

            <p>Hello {$fullname},</p>

            <p>
                Please click the link below to verify your email:
            </p>

            <p>
                <a href='{$verifyUrl}'>
                    Verify Email
                </a>
            </p>

            <br>

            <p>
                If you did not create this account,
                you can safely ignore this email.
            </p>

            <br>

            <p>
                Thanks,<br>
                Hanz-Go Team
            </p>
        ";

        Mail::html($body, function ($message) use ($user) {
            $message
                ->to($user->email, $user->fullname)
                ->subject('Verify Your Email');
        });
    }

    /**
     * Resend Verification Email
     */
    public function resendVerificationEmail(Request $request){

        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::where(
            'username',
            $request->username
        )->first();

        if (!$user) {
            return response()->json([
                'msg' => 'Account not found.'
            ], 404);
        }

        // Already verified
        if (!is_null($user->email_verified_at)) {
            return response()->json([
                'msg' =>
                    'Your email is already verified. You may log in.'
            ], 400);
        }

        try {

            // Generate a fresh verification token
            $user->verification_token = Str::random(64);
            $user->save();

            // Send verification email
            $this->sendVerificationEmail($user);

            return response()->json([
                'msg' =>
                    'A new verification email has been sent. Please check your inbox.'
            ], 200);

        } catch (\Throwable $e) {

            \Log::error(
                'Resend verification email failed.',
                [
                    'user_id' => $user->user_id,
                    'email' => $user->email,
                    'error' => $e->getMessage(),
                ]
            );

            return response()->json([
                'msg' =>
                    'Unable to send the verification email. Please try again later.'
            ], 500);
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

        // Find the user first
        $user = User::where('email', $validated['email'])->first();

        // Do not allow password reset if email is not verified
        if (is_null($user->email_verified_at)) {
            return response()->json([
                'msg' => 'Please verify your email before resetting your password.'
            ], 403);
        }

        // Generate reset token only for verified accounts
        $resetToken = Str::random(15);

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

        try {

            $frontendUrl = rtrim(config('app.frontend_url'), '/');
            $resetUrl = $frontendUrl . '/resetPassword.html?token=' . urlencode($user->reset_token);
            
            $fullname = htmlspecialchars($user->fullname, ENT_QUOTES, 'UTF-8');

            $body = "
                <h2>Reset Your Password</h2>
                <p>Hello {$fullname},</p>
                <p>You requested a password reset.</p>
                <p>Please click the link below to reset your password:</p>
                <p>
                    <a href='{$resetUrl}'>Reset Password</a>
                </p>
                <br>
                <p>If you did not request this, you can ignore this email.</p>
                <br>
                <p>Thanks,<br>Hanz-Go Team</p>
            ";

            Mail::html($body, function ($message) use ($user) {
                $message->to($user->email, $user->fullname)
                    ->subject('Reset Your Password');
            });

        } catch (\Throwable $e) {
            \Log::error('Reset email could not be sent: ' . $e->getMessage());
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

        if (!$user->is_active) {
            return response()->json([
                'msg' => 'Your account has been deactivated. Please contact the administrator.'
            ], 403);
        }

        if (is_null($user->email_verified_at)) {
            return response()->json([
                'msg' => 'Please verify your email before logging in.'
            ], 400);
        }

        $user->token = bin2hex(random_bytes(16));
        $user->save();

        FcmToken::where('user_id', $user->user_id)->delete();

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
                    'editUsername.unique' =>
                        'This username is already taken.',

                    'editEmail.unique' =>
                        'This email is already registered.',

                    'editPhone_number.unique' =>
                        'This phone number is already registered.',

                    'editRole.in' =>
                        'Role must be either Admin, Seller, or Customer.',
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
     * Update logged-in user's own profile
     */
    public function updateOwnAccount(Request $request)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 401);
        }

        $user = User::where('token', $token)->first();

        if (!$user) {
            return response()->json([
                'msg' => 'Invalid Token.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'username' => [
                'required',
                'string',
                'max:255',
                'unique:users,username,' . $user->user_id . ',user_id',
            ],

            'phone_number' => [
                'required',
                'string',
                'max:13',
                'unique:users,phone_number,' . $user->user_id . ',user_id',
            ],

            'fullname' => [
                'required',
                'string',
                'max:255',
            ],

            'password' => [
                'nullable',
                'string',
                'min:8',
                'confirmed',
            ],
        ], [
            'username.unique' =>
                'This username is already taken.',

            'phone_number.unique' =>
                'This phone number is already registered.',

            'password.confirmed' =>
                'Password confirmation does not match.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $validated = $validator->validated();

        $user->username = $validated['username'];
        $user->phone_number = $validated['phone_number'];
        $user->fullname = $validated['fullname'];

        // Only change the password if a new password was entered
        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        return response()->json([
            'msg' => 'Profile updated successfully.',
            'user' => $user->only([
                'user_id',
                'username',
                'email',
                'phone_number',
                'fullname',
                'role',
                'image',
            ]),
            'status' => 200,
        ], 200);
    }

    /**
     * Update Image Accounts
     */
    public function updateImageAccount(Request $request, $id){
        try {
            $token = $request->bearerToken();

            if (!$token) {
                return response()->json([
                    'msg' => 'No Token Provided.'
                ], 401);
            }

            $user = User::where('token', $token)->first();

            if (!$user) {
                return response()->json([
                    'msg' => 'Not Authorized to Update Account'
                ], 403);
            }

            if ((int) $user->user_id !== (int) $id) {
                return response()->json([
                    'msg' => 'You are not authorized to update this profile image.'
                ], 403);
            }

            $account = $user;

            $request->validate([
                'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:10240',
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
     * Deactivate Account
     */
    public function deactivateAccount(Request $request, $id)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 401);
        }

        $admin = User::where('token', $token)->first();

        if (!$admin || $admin->role !== 'admin') {
            return response()->json([
                'msg' => 'Unauthorized. Only administrators can deactivate accounts.'
            ], 403);
        }

        $account = User::find($id);

        if (!$account) {
            return response()->json([
                'msg' => 'Account not found.'
            ], 404);
        }

        // Protect Super Admin
        if ((int) $account->user_id === 1) {
            return response()->json([
                'msg' => 'Super Admin cannot be deactivated.'
            ], 403);
        }

        // Prevent an admin from deactivating their own current account
        if ((int) $admin->user_id === (int) $account->user_id) {
            return response()->json([
                'msg' => 'You cannot deactivate your own account.'
            ], 403);
        }

        if (!$account->is_active) {
            return response()->json([
                'msg' => 'This account is already deactivated.'
            ], 409);
        }

        $account->is_active = false;

        // Immediately invalidate the user's current session
        $account->token = '';
        $account->save();

        // Remove push-notification tokens as well
        FcmToken::where('user_id', $account->user_id)->delete();

        return response()->json([
            'msg' => 'Account deactivated successfully.',
            'user' => [
                'user_id' => $account->user_id,
                'username' => $account->username,
                'role' => $account->role,
                'is_active' => $account->is_active,
            ],
        ], 200);
    }

    /**
     * Reactivate Account
     */
    public function reactivateAccount(Request $request, $id)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 401);
        }

        $admin = User::where('token', $token)->first();

        if (!$admin || $admin->role !== 'admin') {
            return response()->json([
                'msg' => 'Unauthorized. Only administrators can reactivate accounts.'
            ], 403);
        }

        $account = User::find($id);

        if (!$account) {
            return response()->json([
                'msg' => 'Account not found.'
            ], 404);
        }

        if ($account->is_active) {
            return response()->json([
                'msg' => 'This account is already active.'
            ], 409);
        }

        $account->is_active = true;
        $account->save();

        return response()->json([
            'msg' => 'Account reactivated successfully.',
            'user' => [
                'user_id' => $account->user_id,
                'username' => $account->username,
                'role' => $account->role,
                'is_active' => $account->is_active,
            ],
        ], 200);
    }

    /**
     * Get all Admin accounts
     */
    public function getAdmins(){

        $admins = User::where('role', 'admin')->get([
            'user_id',
            'username',
            'email',
            'fullname',
            'phone_number',
            'role',
            'image',
            'is_active',
        ]);

        return response()->json([
            'admins' => $admins
        ], 200);
    }

    /**
     * Get All Seller Accounts
     */
    public function getSellers(){
        $sellers = User::where('role', 'seller')->get([
            'user_id',
            'username',
            'email',
            'fullname',
            'phone_number',
            'role',
            'image',
            'is_active',
        ]);

        return response()->json([
            'sellers' => $sellers
        ], 200);
    }

    /**
     * Get All Users Accounts
     */
    public function getUsers(){

        $users = User::where('role', 'user')->get([
            'user_id',
            'username',
            'email',
            'fullname',
            'phone_number',
            'role',
            'image',
            'is_active',
        ]);

        return response()->json([
            'users' => $users
        ], 200);
    }

    /**
     * Get account tables and counts in one request.
     */
    public function accountsSummary(){

        $columns = ['user_id', 'username', 'email', 'fullname', 'phone_number', 'role', 'image', 'is_active',];
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
     * Permanently Delete Account
     */
    public function deleteAccount(Request $request, $id)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'msg' => 'No Token Provided.'
            ], 401);
        }

        $admin = User::where('token', $token)->first();

        if (!$admin || $admin->role !== 'admin') {
            return response()->json([
                'msg' => 'Unauthorized. Only administrators can delete accounts.'
            ], 403);
        }

        $account = User::find($id);

        if (!$account) {
            return response()->json([
                'msg' => 'Account not found.'
            ], 404);
        }

        // Protect Super Admin
        if ((int) $account->user_id === 1) {
            return response()->json([
                'msg' => 'Super Admin cannot be deleted.'
            ], 403);
        }

        // Prevent currently logged-in admin from deleting themselves
        if ((int) $admin->user_id === (int) $account->user_id) {
            return response()->json([
                'msg' => 'You cannot delete your own account.'
            ], 403);
        }

        /*
        * -----------------------------------------------------
        * Check for important records/history.
        * Accounts with these records must be deactivated
        * instead of permanently deleted.
        * -----------------------------------------------------
        */

        $hasImportantRecords =
            // Customer/order history
            DB::table('checkouts')
                ->where('user_id', $account->user_id)
                ->exists()

            || DB::table('orders')
                ->where('user_id', $account->user_id)
                ->exists()

            // Seller products/order history
            || DB::table('products')
                ->where('seller_id', $account->user_id)
                ->exists()

            || DB::table('checkout_items')
                ->where('seller_id', $account->user_id)
                ->exists()

            || DB::table('brands')
                ->where('seller_id', $account->user_id)
                ->exists()

            || DB::table('categories')
                ->where('seller_id', $account->user_id)
                ->exists()

            || DB::table('product_edit_requests')
                ->where('seller_id', $account->user_id)
                ->exists()

            // Admin approval/audit history
            || DB::table('brands')
                ->where('approved_by', $account->user_id)
                ->exists()

            || DB::table('categories')
                ->where('approved_by', $account->user_id)
                ->exists()

            || DB::table('products')
                ->where('approved_by', $account->user_id)
                ->exists()

            || DB::table('checkouts')
                ->where('cancelled_by', $account->user_id)
                ->exists();

        if ($hasImportantRecords) {
            return response()->json([
                'msg' => 'This account has existing records and cannot be permanently deleted. Please deactivate the account instead.'
            ], 409);
        }

        /*
        * -----------------------------------------------------
        * Account has no important history.
        * Remove temporary/support records first.
        * -----------------------------------------------------
        */

        DB::transaction(function () use ($account) {

            DB::table('add_to_cart')
                ->where('user_id', $account->user_id)
                ->delete();

            DB::table('locations')
                ->where('user_id', $account->user_id)
                ->delete();

            DB::table('fcm_tokens')
                ->where('user_id', $account->user_id)
                ->delete();

            DB::table('app_notifications')
                ->where('user_id', $account->user_id)
                ->delete();

            $account->delete();
        });

        return response()->json([
            'msg' => 'Account permanently deleted successfully.',
            'id' => $id,
        ], 200);
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

            // Send the email using the configured mailer
            try {
                $name = htmlspecialchars($validated['name'], ENT_QUOTES, 'UTF-8');
                $email = htmlspecialchars($validated['email'], ENT_QUOTES, 'UTF-8');
                $subject = htmlspecialchars($validated['subject'], ENT_QUOTES, 'UTF-8');
                $contactMessage = nl2br(htmlspecialchars($validated['message'], ENT_QUOTES, 'UTF-8'));

                $body = "
                    <h2>New Contact Us Message</h2>
                    <p><strong>Name:</strong> {$name}</p>
                    <p><strong>Email:</strong> {$email}</p>
                    <p><strong>Subject:</strong> {$subject}</p>
                    <hr>
                    <p><strong>Message:</strong></p>
                    <p>{$contactMessage}</p>
                ";

                Mail::html($body, function ($message) use ($validated) {
                    $message->to(env('CONTACT_ADMIN_EMAIL'))
                        ->replyTo($validated['email'], $validated['name'])
                        ->subject('Hanz-Go Contact Us Message: ' . $validated['subject']);
                });

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

        } catch (\Throwable $e) {
            \Log::error('Contact email could not be sent: ' . $e->getMessage());

            return response()->json([
                'msg' => 'Message could not be sent. Please try again later.'
            ], 500);
        }
    }
}   
