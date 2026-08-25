$(document).ready(function () {
  //var ip = "https://api.hanzgo.me"; // Change this to your server IP or domain

  if (!window.APP_CONFIG?.API_BASE_URL) {
    throw new Error(
      "APP_CONFIG is missing. Load config.js before registration.js.",
    );
  }

  const ip = window.APP_CONFIG.API_BASE_URL;

  $(document).ajaxStart(function () {
    $("#wait").css("display", "block");
  });
  $(document).ajaxComplete(function () {
    $("#wait").css("display", "none");
  });
  $("#signupForm").on("submit", function (e) {
    e.preventDefault();

    var usr = $("#username").val().trim();
    var email = $("#email").val();
    var phoneNum = $("#phone_number").val();
    var pwd = $("#password").val();
    var confirmPwd = $("#password_confirmation").val();
    var fnm = $("#fullname").val();
    var role = $("#role").val();

    if (!usr.trim()) {
      $("#usernameError").text("Please enter a username.");
      return; // stop the AJAX request
    }

    $.ajax({
      type: "POST",
      url: ip + "/api/register",
      contentType: "application/json",
      data: JSON.stringify({
        username: usr,
        email: email,
        phone_number: phoneNum,
        password: pwd,
        password_confirmation: confirmPwd,
        fullname: fnm,
        role: role,
      }),
      success: function (res) {
        // Clear previous errors
        $(".error-message").text("");
        $(".form-control").removeClass("is-invalid");
        $("#signupForm")[0].reset();

        Swal.fire({
          title: "Successfully Registered",
          text: "Registration successful. Please go to your Email for Verification.",
          icon: "success",
        }).then(() => {
          window.location.replace("login.html");
        });
      },
      error: function (xhr) {
        // Clear previous validation errors
        $(".error-message").text("");
        $(".form-control").removeClass("is-invalid");

        if (xhr.status === 422 && xhr.responseJSON?.errors) {
          const errors = xhr.responseJSON.errors;

          Object.keys(errors).forEach((field) => {
            const message = errors[field][0];

            if (
              field === "password" &&
              message.toLowerCase().includes("confirmation")
            ) {
              $("#password_confirmationError").text(message);
              $("#password_confirmation").addClass("is-invalid");
            } else {
              $(`#${field}Error`).text(message);
              $(`#${field}`).addClass("is-invalid");
            }
          });
        } else {
          Swal.fire({
            title: "Registration Failed",
            text:
              xhr.responseJSON?.msg ||
              xhr.responseJSON?.message ||
              "Unknown error",
            icon: "error",
          });
        }
      },
    });
  });
});
