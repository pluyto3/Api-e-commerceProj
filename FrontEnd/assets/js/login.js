//var ip = "https://api.hanzgo.me"; // Production server

if (!window.APP_CONFIG?.API_BASE_URL) {
  throw new Error("APP_CONFIG is missing. Load config.js before checkout.js.");
}

const ip = window.APP_CONFIG.API_BASE_URL;

function load_user() {
  var usr = $.cookie("username");
  var token = $.cookie("token");

  if (usr != undefined && token != undefined) {
    window.location.replace("index.html");
  }
}

// Function to resend verification email
function resendVerificationEmail(username) {
  Swal.fire({
    title: "Sending Verification Email",
    text: "Please wait...",
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  $.ajax({
    type: "POST",
    url: ip + "/api/resend-verification",
    data: JSON.stringify({
      username: username,
    }),
    contentType: "application/json",
    headers: {
      Accept: "application/json",
    },

    success: function (res) {
      Swal.fire({
        icon: "success",
        title: "Email Sent",
        text:
          res.msg ||
          "A new verification email has been sent. Please check your inbox.",
        confirmButtonText: "OK",
      });
    },

    error: function (xhr) {
      let errorMessage =
        "Unable to resend verification email. Please try again.";

      if (xhr.responseJSON) {
        errorMessage =
          xhr.responseJSON.msg ||
          xhr.responseJSON.message ||
          xhr.responseJSON.error ||
          errorMessage;
      }

      Swal.fire({
        icon: "error",
        title: "Unable to Send Email",
        text: errorMessage,
        confirmButtonText: "OK",
      });
    },
  });
}

$(document).ready(function () {
  load_user();

  $(document).ajaxStart(function () {
    $("#wait").css("display", "block");
  });
  $(document).ajaxComplete(function () {
    $("#wait").css("display", "none");
  });
  $("#loginForm").on("submit", function (e) {
    e.preventDefault();
    var usr = $("#username").val();
    var pwd = $("#password").val();
    $.ajax({
      type: "POST",
      url: ip + "/api/login",
      data: JSON.stringify({ username: usr, password: pwd }),
      contentType: "application/json",
      success: function (res) {
        $.cookie("token", res.token);
        $.cookie("username", $("#username").val()); // Set username cookie for redirection
        $.cookie("role", res.role);
        $.cookie("user_id", res.user_id);
        $.cookie("profileImage", res.profile_image, { path: "/" }); // Set profile image cookie

        console.log("Login response:", res.role);
        console.log("Saved role:", res.role);
        console.log("Saved profile image:", res.profile_image);

        Swal.fire({
          title: "Logged in successfully",
          icon: "success",
        }).then(() => {
          if (res.role === "admin") {
            // window.location.replace("dashboard.php");
            window.location.href = "dashboard.html";
          } else if (res.role === "seller") {
            // window.location.replace("seller-dashboard.php");
            window.location.href = "dashboard.html";
          } else {
            // window.location.replace("dashboard.php");
            window.location.href = "index.html";
          }
        });
      },
      error: function (xhr) {
        // Default error message
        let errorMessage = "Access Denied: Invalid username or password.";

        if (xhr.responseJSON) {
          errorMessage =
            xhr.responseJSON.msg ||
            xhr.responseJSON.message ||
            xhr.responseJSON.error ||
            errorMessage;
        }

        // Check if account is not yet verified
        if (
          errorMessage.toLowerCase().includes("verify your email") ||
          errorMessage.toLowerCase().includes("email verification")
        ) {
          Swal.fire({
            icon: "warning",
            title: "Email Not Verified",
            text: errorMessage,

            showDenyButton: true,

            confirmButtonText: "OK",
            denyButtonText: "Resend Verification Email",

            footer: '<a href="forgot.html">Forgot Password?</a>',
          }).then((result) => {
            if (result.isDenied) {
              // Use the username already entered in the login form
              resendVerificationEmail(usr);
            }
          });

          return;
        }

        // Normal login errors
        Swal.fire({
          icon: "error",
          title: "Error",
          text: errorMessage,
          confirmButtonText: "OK",
          footer: '<a href="forgot.html">Forgot Password?</a>',
        });
      },
    });
  });
});
