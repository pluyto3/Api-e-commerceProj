
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Email Verification | Hanz-Go</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      background: linear-gradient(135deg, #edf2fa, #f8fafd);
      color: #151a2f;
    }

    .logo-box {
      margin-bottom: 12px;
      text-align: center;
    }

    .logo-box img {
      display: inline-block;
      width: 82px;
      height: 82px;
      object-fit: contain;
      border-radius: 16px;
    }

    .verification-card {
      width: 100%;
      max-width: 430px;
      padding: 38px 32px;
      text-align: center;
      background: white;
      border: 1px solid #d7e1ee;
      border-radius: 22px;
      box-shadow: 0 18px 45px rgba(20, 32, 56, 0.1);
    }

    .status-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 78px;
      height: 78px;
      margin: 0 auto 20px;
      border-radius: 50%;
      background: #e9f9ef;
      color: #168349;
      font-size: 44px;
    }

    .status-icon.error {
      background: #fff1f1;
      color: #db4444;
    }

    h1 {
      margin: 0 0 12px;
      font-size: 29px;
      font-weight: 800;
    }

    p {
      margin: 0 0 28px;
      color: #64748b;
      font-size: 15px;
      line-height: 1.65;
    }

    .login-btn {
      display: block;
      width: 100%;
      padding: 15px;
      border-radius: 12px;
      background: linear-gradient(135deg, #1d4ed8, #173b92);
      color: white;
      text-decoration: none;
      font-weight: 700;
      box-shadow: 0 8px 18px rgba(29, 78, 216, 0.18);
    }

    .login-btn:hover {
      background: #1e40af;
    }

    .footer {
      margin-top: 24px;
      color: #94a3b8;
      font-size: 12px;
    }


    /* Pending email verification */
    .status-icon.pending {
        background: #edf3ff;
        color: #1d4ed8;
    }

    /* Button styling */
    button.login-btn {
        border: none;
        font-size: 15px;
        font-family: inherit;
        cursor: pointer;
    }

    button.login-btn:active {
        transform: scale(0.98);
    }

  </style>
</head>
<body>

  <main class="verification-card">

    <div class="logo-box">
        <img
            src="{{ rtrim(config('app.frontend_url'), '/') }}/assets/img/HanzGo.png"
            alt="Hanz-Go Logo"
        >
    </div>


    @if ($verified)

        <!-- Successfully verified -->
        <div class="status-icon" aria-hidden="true">✓</div>

        <h1>Email Verified!</h1>

        <p>
            Your email address has been successfully verified.
            You can now sign in to your Hanz-Go account.
        </p>

    @elseif ($pending)

        <!-- Waiting for user confirmation -->
        <div class="status-icon pending" aria-hidden="true">✉</div>

        <h1>Verify Your Email</h1>

        <p>
            Your email is ready to be verified.
            Click the button below to confirm your email
            address and activate your Hanz-Go account.
        </p>

        <form action="{{ $verifyUrl }}" method="POST">
            <button type="submit" class="login-btn">
                Verify My Email
            </button>
        </form>

    @else

        <!-- Invalid or already used link -->
        <div class="status-icon error" aria-hidden="true">!</div>

        <h1>Verification Unavailable</h1>

        <p>
            This verification link is invalid or has already
            been used. If you verified your email earlier,
            you can try logging in.
        </p>

    @endif

    @if (!$pending)
        <a class="login-btn" href="{{ $loginUrl }}">
            Back to Login
        </a>
    @endif

    <div class="footer">
      Hanz-Go &middot; Find it, buy it, done.
    </div>

  </main>

</body>
</html>
