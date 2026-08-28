function getApiBaseUrl() {
  if (!window.APP_CONFIG?.API_BASE_URL) {
    return null;
  }

  return window.APP_CONFIG.API_BASE_URL.replace(/\/$/, "");
}

function load_user() {
  var usr = $.cookie("username");
  var token = $.cookie("token");

  if (usr !== undefined && token !== undefined) {
    window.location.replace("index.html");
  }
}

// Function to resend verification email
function resendVerificationEmail(username) {
  const ip = getApiBaseUrl();

  if (!ip) {
    Swal.fire({
      icon: "error",
      title: "Configuration Error",
      text: "Unable to connect to the server. Please try again later.",
    });
    return;
  }

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

    const ip = getApiBaseUrl();

    if (!ip) {
      console.error("APP_CONFIG is missing.");

      Swal.fire({
        title: "Configuration Error",
        text: "Unable to connect to the server. Please try again later.",
        icon: "error",
      });

      return;
    }

    var usr = $("#username").val().trim();
    var pwd = $("#password").val();

    $.ajax({
      type: "POST",
      url: ip + "/api/login",

      data: JSON.stringify({
        username: usr,
        password: pwd,
      }),

      contentType: "application/json",

      headers: {
        Accept: "application/json",
      },

      success: function (res) {
        const cookieOptions = {
          expires: 1,
          path: "/",
        };

        $.cookie("token", res.token, cookieOptions);
        $.cookie("username", usr, cookieOptions);
        $.cookie("role", res.role, cookieOptions);
        $.cookie("user_id", res.user_id, cookieOptions);

        if (res.profile_image) {
          $.cookie("profileImage", res.profile_image, cookieOptions);
        }

        console.log("Login response:", res.role);
        console.log("Saved role:", res.role);
        console.log("Saved profile image:", res.profile_image);

        Swal.fire({
          title: "Logged in successfully",
          icon: "success",
        }).then(() => {
          if (res.role === "admin" || res.role === "seller") {
            window.location.href = "dashboard.html";
          } else {
            window.location.href = "index.html";
          }
        });
      },

      error: function (xhr) {
        let errorMessage = "Access Denied: Invalid username or password.";

        if (xhr.responseJSON) {
          errorMessage =
            xhr.responseJSON.msg ||
            xhr.responseJSON.message ||
            xhr.responseJSON.error ||
            errorMessage;
        }

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
              resendVerificationEmail(usr);
            }
          });

          return;
        }

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
