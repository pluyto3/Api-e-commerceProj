$(document).ready(function () {
  $(document).ajaxStart(function () {
    $("#wait").css("display", "block");
  });

  $(document).ajaxComplete(function () {
    $("#wait").css("display", "none");
  });

  $("#signupForm").on("submit", function (e) {
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

    var usr = $("#username").val().trim();
    var email = $("#email").val().trim();
    var phoneNum = $("#phone_number").val().trim();
    var pwd = $("#password").val();
    var confirmPwd = $("#password_confirmation").val();
    var fnm = $("#fullname").val().trim();
    var role = $("#role").val();

    if (!usr) {
      $("#usernameError").text("Please enter a username.");
      return;
    }

    $.ajax({
      type: "POST",
      url: `${ip}/api/register`,
      contentType: "application/json",

      headers: {
        Accept: "application/json",
      },

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
        $(".error-message").text("");
        $(".form-control").removeClass("is-invalid");

        $("#signupForm")[0].reset();

        Swal.fire({
          title: "Successfully Registered",
          text: "Registration successful. Please check your email for verification.",
          icon: "success",
        }).then(() => {
          window.location.replace("login.html");
        });
      },

      error: function (xhr) {
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
              "Unable to register. Please try again.",
            icon: "error",
          });
        }
      },
    });
  });
});
