$(document).ready(function () {
  var ip = "http://localhost:8000"; // Change this to your server IP or domain

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

    // console.log({
    //   username: usr,
    //   email: email,
    //   phone_number: phoneNum,
    //   password: pwd,
    //   password_confirmation: confirmPwd,
    //   fullname: fnm,
    //   role: role,
    // });

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
        // Clear old error messages
        $(".error-message").text("");

        if (xhr.status === 422) {
          // Laravel validation error
          let errors = xhr.responseJSON.errors;

          //   if (errors.username) {
          //     $("#usernameError").text(errors.username[0]);
          //   }
          //   if (errors.email) {
          //     $("#emailError").text(errors.email[0]);
          //   }
          //   if (errors.phone_number) {
          //     $("#phone_numberError").text(errors.phone_number[0]);
          //   }
          //   if (errors.password) {
          //     $("#passwordError").text(errors.password[0]);
          //   }
          //   if (errors.password_confirmation) {
          //     $("#password_confirmationError").text(
          //       errors.password_confirmation[0]
          //     );
          //   }

          // Laravel validation error
          Object.keys(errors).forEach((field) => {
            // Show the first error message under the field
            $("#" + field + "Error").text(errors[field][0]);

            // Add Bootstrap invalid class to the input
            $("#" + field).addClass("is-invalid");
          });
        } else {
          Swal.fire({
            title: "Registration Failed",
            text: xhr.responseJSON ? xhr.responseJSON.msg : "Unknown error",
            icon: "error",
          });
        }
      },
    });
  });
});
