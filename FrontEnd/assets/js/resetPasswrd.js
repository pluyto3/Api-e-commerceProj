// Function to get the API base URL from the APP_CONFIG
function getApiBaseUrl() {
  if (!window.APP_CONFIG?.API_BASE_URL) {
    return null;
  }

  return window.APP_CONFIG.API_BASE_URL.replace(/\/$/, "");
}

// Extract token from URL
function getToken() {
  // If query string (?token=abcd1234)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("token")) {
    return urlParams.get("token");
  }

  // If path style (/reset-password.html/abcd1234)
  const pathParts = window.location.pathname.split("/");
  return pathParts[pathParts.length - 1];
}

$(document).ready(function () {
  const token = getToken();
  console.log("Reset token:", token);

  if (!token || token === "resetPassword.html") {
    Swal.fire({
      title: "Invalid Link",
      text: "The password reset link is missing or invalid.",
      icon: "error",
    }).then(() => {
      window.location.replace("forgot.html");
    });
    return;
  }

  //  Handle form submit
  $("#resetPasswordForm").on("submit", function (e) {
    e.preventDefault();

    const password = $("#password").val();
    const confirmPassword = $("#confirm_password").val();

    const ip = getApiBaseUrl();

    // Check if APP_CONFIG is available
    if (!ip) {
      console.error("APP_CONFIG is missing.");

      Swal.fire({
        title: "Configuration Error",
        text: "Unable to connect to the server. Please try again later.",
        icon: "error",
      });

      return;
    }

    if (!password || !confirmPassword) {
      $("#passwordError").text("Please fill in both fields.");
      return;
    }

    if (password !== confirmPassword) {
      $("#passwordError").text("Passwords do not match.");
      return;
    }

    $("#passwordError").text("");

    $.ajax({
      type: "POST",
      url: ip + "/api/reset-password/" + encodeURIComponent(token),
      contentType: "application/json",
      headers: {
        Accept: "application/json",
      },
      data: JSON.stringify({
        password: password,
        password_confirmation: confirmPassword,
      }),
      success: function (res) {
        Swal.fire({
          title: "Password Reset",
          text: "Your password has been reset successfully.",
          icon: "success",
        }).then(() => {
          window.location.replace("login.html");
        });
      },
      error: function (xhr) {
        let msg = "Something went wrong.";
        if (xhr.responseJSON && xhr.responseJSON.msg) {
          msg = xhr.responseJSON.msg;
        }
        Swal.fire({
          title: "Error",
          text: msg,
          icon: "error",
        });
      },
    });
  });
});
