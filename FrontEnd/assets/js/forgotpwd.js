var ip = "http://localhost:8000";

function load_user() {
  var usr = $.cookie("username");
  if (usr != undefined) {
    window.location.replace("index.html");
  }
}

// $(document).ajaxStart(function () {
//   $("#wait").css("display", "block");
// });
// $(document).ajaxComplete(function () {
//   $("#wait").css("display", "none");
// });

$(document).ready(function () {
  $("#forgotPasswordForm").on("submit", function (e) {
    e.preventDefault();
    sendForgotPasswordRequest();
  });

  function sendForgotPasswordRequest() {
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
      data: JSON.stringify({ email: email }),
      success: function (res) {
        Swal.fire({
          title: "Reset Link Sent",
          text: "A password reset link has been sent to your email.",
          icon: "success",
        }).then(() => {
          window.location.replace("forgot.html");
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
  }
});
