// var ip = "https://api.hanzgo.me"; // For production server
var ip = "https://api.hanzgo.me"; // For local testing

function load_user() {
  var usr = $.cookie("username");
  var token = $.cookie("token");
  if (usr != undefined && token != undefined) {
    window.location.replace("index.html");
  }
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

        // Check if the backend sent a specific error message
        if (xhr.responseJSON) {
          errorMessage =
            xhr.responseJSON.msg ||
            xhr.responseJSON.message ||
            xhr.responseJSON.error ||
            errorMessage;
        }

        Swal.fire({
          icon: "error",
          title: "Error",
          text: errorMessage,
          footer: '<a href="forgot.html">Forgot Password?</a>',
        });
      },
    });
  });
});
