$(document).ready(function () {
  $(document).ajaxStart(function () {
    $("#wait").css("display", "block");
  });

  $(document).ajaxComplete(function () {
    $("#wait").css("display", "none");
  });

  $("#forgotPasswordForm").on("submit", function (e) {
    e.preventDefault();

    if (!window.APP_CONFIG?.API_BASE_URL) {
      console.error("APP_CONFIG is missing.");

      Swal.fire({
        title: "Configuration Error",
        text: "Unable to connect to the server. Please try again later.",
        icon: "error",
      });

      return;
    }

    const ip = window.APP_CONFIG.API_BASE_URL.replace(/\/$/, "");

    var email = $("#email").val().trim();

    if (!email) {
      $("#emailError").text("Please enter your email.");
      return;
    } else {
      $("#emailError").text("");
    }

    $.ajax({
      type: "POST",
      url: ip + "/api/forgot-password",
      contentType: "application/json",
      headers: {
        Accept: "application/json",
      },
      data: JSON.stringify({ email: email }),

      success: function (res) {
        Swal.fire({
          title: "Reset Link Sent",
          text: "A password reset link has been sent to your email.",
          icon: "success",
          confirmButtonText: "OK",
        }).then(() => {
          window.location.replace("login.html");
        });
      },

      error: function (xhr) {
        let title = "Error";
        let msg = "Something went wrong.";

        // Laravel validation errors
        if (
          xhr.responseJSON &&
          xhr.responseJSON.errors &&
          xhr.responseJSON.errors.email
        ) {
          const emailError = xhr.responseJSON.errors.email[0];

          // Email does not exist in the database
          if (emailError.toLowerCase().includes("not registered")) {
            title = "Email Not Registered";
            msg =
              "We couldn't find an account associated with this email address.";
          } else {
            msg = emailError;
          }
        }

        // Custom backend messages
        else if (xhr.responseJSON && xhr.responseJSON.msg) {
          msg = xhr.responseJSON.msg;

          // Account exists but email isn't verified
          if (
            xhr.status === 403 &&
            msg.toLowerCase().includes("verify your email")
          ) {
            title = "Email Not Verified";
          }
        }

        Swal.fire({
          title: title,
          text: msg,
          icon: "error",
          confirmButtonText: "OK",
        });
      },
    });
  });
});
