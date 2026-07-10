// ==========================
// Global Configuration
// ==========================
// const ip = "https://api.hanzgo.me";
if (!window.APP_CONFIG?.API_BASE_URL) {
  throw new Error("APP_CONFIG is missing. Load config.js before cart.js.");
}

const ip = window.APP_CONFIG.API_BASE_URL;

let token = null;
let usr = null;
let role = null;
let profileImage = null;
let accountInfoRequest = null;
let accountInfoLoaded = false;

// ==========================
// Load User Session and Update UI
// ==========================
function load_user() {
  usr = $.cookie("username");
  token = $.cookie("token");
  role = $.cookie("role");
  profileImage = $.cookie("profileImage");

  const $displayUsername = $("#displayUsername");
  const $login = $("#login");
  const $register = $("#register");
  const $logout = $("#logout");
  const $cartCount = $("#cart-count");
  const $cartNav = $("#cartNav");
  const $cartNavMobile = $("#cartNavMobile");
  const $adminDashboard = $("#adminDashboard");
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");
  const $sidebarAccounts = $("#sidebarAccounts");
  const $sidebarDashboard = $("#dashboard");
  const $sidebarBrand = $("#brand");
  const $sidebarCategory = $("#category");
  const $sidebarProduct = $("#product");

  if (!usr || !token) {
    // No session → show login/register, hide logout & cart
    $displayUsername.html("Sign In");
    $login.show();
    $register.show();
    $logout.hide();
    $cartCount.hide();
    $cartNav.hide();
    $cartNavMobile.hide();
    $adminDashboard.hide();
    $navbarProfileImage.hide();
    $defaultProfileIcon.hide();
    $sidebarAccounts.hide();
    $sidebarDashboard.hide();
    $sidebarBrand.hide();
    $sidebarCategory.hide();
    $sidebarProduct.hide();
    return;
  }

  // Session exists → show username & logout
  $displayUsername.html(`<b>${usr}</b>`);
  $login.hide();
  $register.hide();
  $logout.show();

  // Match dashboard behavior: show cart for user/seller, hide for admin
  if (role === "user" || role === "seller") {
    $cartCount.show();
    $cartNav.show();
    $cartNavMobile.show();
  } else {
    $cartCount.hide();
    $cartNav.hide();
    $cartNavMobile.hide();
  }

  // Hide account manage if seller or user
  if (role === "seller" || role === "user") {
    $sidebarAccounts.hide();
    $(".role-choice #role").prop("disabled", true);
    $(".email-field input").prop("disabled", true);
  } else {
    $sidebarAccounts.show();
    $(".role-choice #role").prop("disabled", false);
    $(".email-field input").prop("disabled", false);
  }

  // Hide specific sidebar menus for regular user
  if (role === "user") {
    $sidebarDashboard.hide();
    $sidebarBrand.hide();
    $sidebarCategory.hide();
    $sidebarProduct.hide();
  } else {
    $sidebarDashboard.show();
    $sidebarBrand.show();
    $sidebarCategory.show();
    $sidebarProduct.show();
  }

  // Show admin dashboard for admin/seller only
  role === "admin" || role === "seller"
    ? $adminDashboard.show()
    : $adminDashboard.hide();

  if (profileImage) {
    displayNavbarProfileImage(profileImage);
  }

  if (token && usr) {
    loadAccountInfo(usr, token);
  }
}

function displayNavbarProfileImage(imageFilename) {
  const baseUrl = `${ip}/FrontEnd/assets/img/user/`;
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");

  if (imageFilename && String(imageFilename).trim() !== "") {
    $navbarProfileImage
      .off("error")
      .on("error", function () {
        $(this).hide().attr("src", "");
        $defaultProfileIcon.show();
      })
      .attr("src", baseUrl + imageFilename)
      .show();
    $defaultProfileIcon.hide();
  } else {
    $navbarProfileImage.hide();
    $defaultProfileIcon.show();
  }
}

// ==========================
// Fetch User Account Info
// ==========================
function loadAccountInfo(usr, token) {
  if (accountInfoLoaded || accountInfoRequest) {
    return accountInfoRequest;
  }

  accountInfoRequest = $.ajax({
    url: `${ip}/api/getAccount_username/${usr}`,
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    success: function (res) {
      if (res.image) {
        $.cookie("profileImage", res.image, { path: "/" });
      }

      displayNavbarProfileImage(res.image);
      accountInfoLoaded = true;
    },
    error: function (xhr) {
      console.error("Error fetching account info:", xhr);
    },
    complete: function () {
      accountInfoRequest = null;
    },
  });

  return accountInfoRequest;
}

// ==========================
// Toast Notification
// ==========================
function showToast(message, type = "success") {
  const $toast = $("#toastMessage");

  // Change header color dynamically
  const $header = $toast.find(".toast-header");
  if (type === "success") {
    $header.removeClass("bg-danger").addClass("bg-success");
    $header.find("strong").text("Success");
  } else {
    $header.removeClass("bg-success").addClass("bg-danger");
    $header.find("strong").text("Error");
  }

  // Update message
  $toast.find(".toast-body").text(message);

  // Show toast (Bootstrap 4 method)
  $toast.toast("show");
}

/* ------------------------------
    Contact Form Submission Handler
------------------------------ */
function submitContactForm() {
  $(document)
    .off("submit", "#contactForm")
    .on("submit", "#contactForm", function (e) {
      e.preventDefault();

      const $btn = $("#contactSubmitBtn");

      const formData = {
        name: $("#contactName").val().trim(),
        email: $("#contactEmail").val().trim(),
        subject: $("#contactSubject").val().trim(),
        message: $("#contactMessage").val().trim(),
      };

      $btn
        .prop("disabled", true)
        .html('<i class="fas fa-spinner fa-spin mr-2"></i> Sending...');

      $.ajax({
        url: `${ip}/api/contact/send-email`,
        method: "POST",
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(formData),
        success: function (res) {
          Swal.fire(
            "Sent!",
            res.msg || "Message sent successfully!",
            "success",
          );

          $("#contactForm")[0].reset();
        },
        error: function (xhr) {
          console.error(xhr.responseText);

          Swal.fire(
            "Error",
            xhr.responseJSON?.msg ||
              "Failed to send message. Please try again.",
            "error",
          );
        },
        complete: function () {
          $btn
            .prop("disabled", false)
            .html('<i class="fas fa-paper-plane mr-2"></i> Send Message');
        },
      });
    });
}

// ==========================
// Document Ready
// ==========================
$(document).ready(function () {
  /* ------------------------------
     Load User Session
  ------------------------------ */
  load_user();
  submitContactForm();

  $(document)
    .ajaxStart(() => $("#wait").show())
    .ajaxComplete(() => $("#wait").hide());

  // --- Profile Image Preview ---
  $("#image").on("change", function (e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (event) {
        $("#profileImg").attr("src", event.target.result).show();
        $("#defaultIcon").hide();
      };
      reader.readAsDataURL(file);
    }
  });

  /* -----------------------------
     LOGOUT HANDLER
  ----------------------------- */
  $("#logout").click(() => {
    $.ajax({
      url: `${ip}/api/logout`,
      type: "POST",
      headers: { Authorization: `Bearer ${token}` },
      data: { token },
      success: () => {
        Swal.fire({ icon: "success", title: "Logout Successful" }).then(() => {
          // Clear all cookies
          Object.keys($.cookie()).forEach((cookie) => $.removeCookie(cookie));
          window.location.replace("index.html");
        });
      },
      error: (res) => {
        const msg = res.responseJSON?.msg || "Logout failed. Please try again.";
        Swal.fire({ icon: "error", title: "Error", text: msg });
      },
    });
  });
});
