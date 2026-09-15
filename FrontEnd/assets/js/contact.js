// =======================================
// Contact Page
// =======================================

if (!window.APP_CONFIG?.API_BASE_URL) {
  throw new Error("APP_CONFIG is missing. Load config.js before contact.js.");
}

const ip = window.APP_CONFIG.API_BASE_URL;

let token = null;
let usr = null;
let role = null;
let profileImage = null;

let accountInfoRequest = null;
let accountInfoLoaded = false;

// =======================================
// Helpers
// =======================================

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getApiHeaders(extraHeaders = {}) {
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

function clearContactErrors() {
  $(".contact-field-error").text("");
  $(".contact-form .form-control").removeClass("is-invalid");
}

function showContactFieldError(fieldId, message) {
  $(`#${fieldId}`).addClass("is-invalid");
  $(`#${fieldId}Error`).text(message);
}

// =======================================
// Navbar Profile Image
// =======================================

function displayNavbarProfileImage(imageFilename) {
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");

  if (!imageFilename || String(imageFilename).trim() === "") {
    $navbarProfileImage.hide().attr("src", "");
    $defaultProfileIcon.show();
    return;
  }

  const imageUrl = `${ip}/FrontEnd/assets/img/user/${imageFilename}`;

  $navbarProfileImage
    .off("error.contactProfile")
    .on("error.contactProfile", function () {
      $(this).hide().attr("src", "");
      $defaultProfileIcon.show();
    })
    .attr("src", imageUrl)
    .show();

  $defaultProfileIcon.hide();
}

// =======================================
// Load Session
// =======================================

function loadUser() {
  usr = $.cookie("username") || null;
  token = $.cookie("token") || null;
  role = normalizeText($.cookie("role"));
  profileImage = $.cookie("profileImage") || null;

  const $displayUsername = $("#displayUsername");
  const $login = $("#login");
  const $register = $("#register");
  const $logout = $("#logout");
  const $cartNav = $("#cartNav");
  const $cartNavMobile = $("#cartNavMobile");
  const $adminDashboard = $("#adminDashboard");

  // Guest
  if (!usr || !token) {
    $displayUsername.text("My Account");

    $login.show();
    $register.show();
    $logout.hide();

    $cartNav.hide();
    $cartNavMobile.hide();

    $adminDashboard.hide();

    $("#navbarProfileImage").hide();
    $("#defaultProfileIcon").show();

    return;
  }

  // Logged-in user
  $displayUsername.html(`<b>${usr}</b>`);

  $login.hide();
  $register.hide();
  $logout.show();

  // Only customers should use the shopping cart
  if (role === "user") {
    $cartNav.show();
    $cartNavMobile.show();
  } else {
    $cartNav.hide();
    $cartNavMobile.hide();
  }

  // Admin/Seller dashboard link
  if (role === "admin" || role === "seller") {
    $adminDashboard.show();
  } else {
    $adminDashboard.hide();
  }

  if (profileImage) {
    displayNavbarProfileImage(profileImage);
  }

  loadAccountInfo();
}

// =======================================
// Load Account Information
// =======================================

function loadAccountInfo() {
  if (!usr || !token) return null;

  if (accountInfoLoaded || accountInfoRequest) {
    return accountInfoRequest;
  }

  accountInfoRequest = $.ajax({
    url: `${ip}/api/getAccount_username/${encodeURIComponent(usr)}`,
    method: "GET",

    headers: getApiHeaders(),

    success: function (res) {
      if (res?.image) {
        $.cookie("profileImage", res.image, { path: "/" });
      }

      displayNavbarProfileImage(res?.image);

      // Auto-fill authenticated customer information
      if (res?.fullname) {
        $("#contactName")
          .val(res.fullname)
          .prop("readonly", true)
          .addClass("contact-readonly");
      }

      if (res?.email) {
        $("#contactEmail")
          .val(res.email)
          .prop("readonly", true)
          .addClass("contact-readonly");
      }

      accountInfoLoaded = true;
    },

    error: function (xhr) {
      console.error(
        "Error loading account information:",
        xhr.responseText || xhr,
      );
    },

    complete: function () {
      accountInfoRequest = null;
    },
  });

  return accountInfoRequest;
}

// =======================================
// Concern / Order Number
// =======================================

function setupConcernType() {
  const orderRelatedCategories = [
    "order_concern",
    "delivery_tracking",
    "cancellation_refund",
    "payment_concern",
  ];

  $("#contactCategory")
    .off("change.contactConcern")
    .on("change.contactConcern", function () {
      const category = $(this).val();

      if (orderRelatedCategories.includes(category)) {
        $("#contactOrderGroup").stop(true, true).slideDown(150);
      } else {
        $("#contactOrderGroup").stop(true, true).slideUp(150);
        $("#contactOrderId").val("");
      }
    });
}

// =======================================
// Character Counter
// =======================================

function setupMessageCounter() {
  $("#contactMessage")
    .off("input.contactCounter")
    .on("input.contactCounter", function () {
      const length = $(this).val().length;

      $("#contactMessageCounter").text(`${length} / 2000`);
    });
}

// =======================================
// Client-side Validation
// =======================================

function validateContactForm() {
  clearContactErrors();

  const name = $("#contactName").val().trim();
  const email = $("#contactEmail").val().trim();
  const category = $("#contactCategory").val();
  const subject = $("#contactSubject").val().trim();
  const message = $("#contactMessage").val().trim();

  let valid = true;

  if (!name) {
    showContactFieldError("contactName", "Please enter your full name.");
    valid = false;
  }

  if (!email) {
    showContactFieldError("contactEmail", "Please enter your email address.");
    valid = false;
  } else {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      showContactFieldError(
        "contactEmail",
        "Please enter a valid email address.",
      );
      valid = false;
    }
  }

  if (!category) {
    showContactFieldError(
      "contactCategory",
      "Please select the type of concern.",
    );
    valid = false;
  }

  if (!subject) {
    showContactFieldError("contactSubject", "Please enter a short subject.");
    valid = false;
  }

  if (!message) {
    showContactFieldError("contactMessage", "Please describe your concern.");
    valid = false;
  }

  return valid;
}

// =======================================
// Laravel Validation Errors
// =======================================

function displayServerValidationErrors(errors) {
  if (!errors || typeof errors !== "object") return false;

  const fieldMap = {
    name: "contactName",
    email: "contactEmail",
    category: "contactCategory",
    order_id: "contactOrderId",
    subject: "contactSubject",
    message: "contactMessage",
  };

  let displayed = false;

  Object.entries(errors).forEach(([field, messages]) => {
    const fieldId = fieldMap[field];

    if (!fieldId) return;

    const message = Array.isArray(messages) ? messages[0] : String(messages);

    showContactFieldError(fieldId, message);
    displayed = true;
  });

  return displayed;
}

// =======================================
// Reset Contact Form
// =======================================

function resetContactFormAfterSuccess() {
  const savedName = $("#contactName").prop("readonly")
    ? $("#contactName").val()
    : "";

  const savedEmail = $("#contactEmail").prop("readonly")
    ? $("#contactEmail").val()
    : "";

  $("#contactForm")[0].reset();

  $("#contactName").val(savedName);
  $("#contactEmail").val(savedEmail);

  $("#contactOrderGroup").hide();
  $("#contactMessageCounter").text("0 / 2000");

  clearContactErrors();
}

// =======================================
// Submit Contact Form
// =======================================

function setupContactForm() {
  $(document)
    .off("submit.contactForm", "#contactForm")
    .on("submit.contactForm", "#contactForm", function (event) {
      event.preventDefault();

      if (!validateContactForm()) {
        return;
      }

      const $button = $("#contactSubmitBtn");

      if ($button.data("loading")) {
        return;
      }

      const formData = {
        name: $("#contactName").val().trim(),
        email: $("#contactEmail").val().trim(),
        category: $("#contactCategory").val(),
        order_id: $("#contactOrderId").val().trim() || null,
        subject: $("#contactSubject").val().trim(),
        message: $("#contactMessage").val().trim(),
      };

      $button
        .data("loading", true)
        .prop("disabled", true)
        .html('<i class="fas fa-spinner fa-spin mr-2"></i> Sending...');

      $.ajax({
        url: `${ip}/api/contact/send-email`,
        method: "POST",

        headers: getApiHeaders({
          "Content-Type": "application/json",
        }),

        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(formData),

        success: function (response) {
          resetContactFormAfterSuccess();

          const ticketNumber =
            response?.ticket_number || response?.data?.ticket_number || null;

          Swal.fire({
            icon: "success",
            title: "Message Sent",
            html: ticketNumber
              ? `Your support request has been submitted.<br><br>
                 <strong>Reference:</strong> ${ticketNumber}`
              : "Your message has been sent successfully. Our support team will review it.",
            confirmButtonText: "Okay",
          });
        },

        error: function (xhr) {
          console.error("Contact form error:", xhr.responseText || xhr);

          clearContactErrors();

          if (
            xhr.status === 422 &&
            displayServerValidationErrors(xhr.responseJSON?.errors)
          ) {
            Swal.fire(
              "Check Your Information",
              "Please correct the highlighted fields.",
              "warning",
            );

            return;
          }

          if (xhr.status === 429) {
            Swal.fire(
              "Too Many Requests",
              "You have submitted several requests recently. Please wait a moment before trying again.",
              "warning",
            );

            return;
          }

          const message =
            xhr.responseJSON?.msg ||
            xhr.responseJSON?.message ||
            "We could not send your message. Please try again.";

          Swal.fire("Unable to Send", message, "error");
        },

        complete: function () {
          $button
            .data("loading", false)
            .prop("disabled", false)
            .html('<i class="fas fa-paper-plane mr-2"></i> Send Message');
        },
      });
    });
}

// =======================================
// Logout
// =======================================

function setupLogout() {
  $("#logout")
    .off("click.contactLogout")
    .on("click.contactLogout", function (event) {
      event.preventDefault();

      function clearAuthCookies() {
        ["token", "username", "role", "user_id", "profileImage"].forEach(
          (cookie) => {
            $.removeCookie(cookie, { path: "/" });
            $.removeCookie(cookie);
          },
        );
      }

      function logoutFromServer() {
        $.ajax({
          url: `${ip}/api/logout`,
          method: "POST",

          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },

          data: {
            token: token,
          },

          success: function () {
            clearAuthCookies();

            Swal.fire({
              icon: "success",
              title: "Logout Successful",
            }).then(() => {
              window.location.replace("login.html");
            });
          },

          error: function (xhr) {
            const message =
              xhr.responseJSON?.msg ||
              "Your session has ended. Please log in again.";

            clearAuthCookies();

            Swal.fire({
              icon: "warning",
              title: "Logged Out",
              text: message,
            }).then(() => {
              window.location.replace("login.html");
            });
          },
        });
      }

      if (typeof removeFcmTokenFromServer === "function") {
        removeFcmTokenFromServer(logoutFromServer);
      } else {
        logoutFromServer();
      }
    });
}

// =======================================
// Ready
// =======================================

$(document).ready(function () {
  loadUser();

  setupConcernType();
  setupMessageCounter();
  setupContactForm();
  setupLogout();

  $(document)
    .ajaxStart(() => $("#wait").show())
    .ajaxStop(() => $("#wait").hide());
});
