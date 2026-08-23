// ==========================
// Global Configuration
// ==========================
//const ip = "https://api.hanzgo.me";

if (!window.APP_CONFIG?.API_BASE_URL) {
  throw new Error("APP_CONFIG is missing. Load config.js before checkout.js.");
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
    $displayUsername.html("My Account");
    $login.show();
    $register.show();
    $logout.hide();
    $cartCount.hide();
    $cartNav.hide();
    $cartNavMobile.hide();
    $adminDashboard.hide();
    $navbarProfileImage.hide();
    $defaultProfileIcon.show();
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

  // Load user account info
  if (token && usr) loadAccountInfo(usr, token);
}

// ==========================
// Display Profile Image
// ==========================
function displayProfileImage(imageFilename) {
  const baseUrl = `${ip}/FrontEnd/assets/img/user/`;
  const $img = $("#profileImg");
  const $defaultIcon = $("#defaultIcon");

  $img.off("error"); // Remove previous error handlers

  if (imageFilename && imageFilename.trim() !== "") {
    $img.attr("src", baseUrl + imageFilename).on("error", function () {
      $img.hide();
      $defaultIcon.show();
    });

    $img.show();
    $defaultIcon.hide();
  } else {
    $img.hide();
    $defaultIcon.show();
  }
}

function displayNavbarProfileImage(imageFilename) {
  const baseUrl = `${ip}/FrontEnd/assets/img/user/`;
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");

  if (imageFilename && String(imageFilename).trim() !== "") {
    $navbarProfileImage.attr("src", baseUrl + imageFilename).show();
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
      // Populate user form
      $("#user_id").val(res.user_id);
      $("#username").val(res.username);
      $("#phone_number").val(res.phone_number);
      $("#email").val(res.email);
      $("#fullname").val(res.fullname);
      $("#role").val(res.role);

      displayProfileImage(res.image);
      displayNavbarProfileImage(res.image);

      // Clear password fields
      $("#password, #password_confirmation").val("");
      accountInfoLoaded = true;
    },
    error: function (xhr) {
      console.error("Error fetching account info:", xhr);
      if (xhr.status !== 429) {
        alert("Failed to load account details. Please try again later.");
      }
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

// ==========================
// Display User Addresses
// ==========================
function displayAddresses() {
  // Add loading indicator
  $("#addressList").html("<p>Loading addresses...</p>");

  $.ajax({
    url: `${ip}/api/location`,
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    success: function (res) {
      // Extract the array from the response object (adjust if your API uses a different key)
      if (res && res.data && Array.isArray(res.data)) {
        res = res.data; // Now res is the array
      } else {
        console.error(
          "Unexpected response format. Expected { data: [...] }, got:",
          res,
        );
        $("#addressList").html(
          '<p class="text-danger">Invalid response from server.</p>',
        );
        return;
      }

      if (!res || res.length === 0) {
        console.log("No addresses to display");
        $("#addressList").html("<p>No addresses found.</p>");
        return;
      }

      const $addressList = $("#addressList");
      $addressList.empty();

      res.forEach((address) => {
        // Conditionally show 'Default' badge only if is_default is true
        const defaultBadge = address.is_default
          ? '<span class="default-badge">Default</span>'
          : "";

        const deleteButton = address.is_default
          ? "" // Hide delete button for default address
          : `<button class="btn btn-sm btn-outline-danger deleteAddress" data-id="${address.location_id}">Delete</button>`;

        const addressCard = `
          <div class="addressCard">
            <div class="addressInfo d-flex flex-column align-items-start" id="addressInfo">
                <div class="accountDetails d-flex flex-wrap align-items-center">
                  <span class="address-name">${address.fullname}</span>
                  <span class="separator">|</span>
                  <span class="address-phone ml-2">${
                    address.phone_number
                  }</span>
                </div>
                <div class="address-details d-flex flex-column align-items-start">
                  <p class="mb-1 small">${address.purok}, ${
                    address.barangay
                  },</p>
                  <p class="mb-1 small">${address.city}, ${address.province}, ${
                    address.zipcode
                  }</p>
                </div>
            </div>
            <div class="mt-2 d-flex flex-wrap align-items-center">
                ${defaultBadge} 
            </div>
            <div class="text-right mt-2">
                <div class="address-actions">
                    <a href="#" class="text-primary editAddress" data-id="${
                      address.location_id
                    }" data-target="#locationEditModal" data-toggle="modal">Edit</a>
                    <button class="btn btn-sm btn-outline-secondary setDefault" data-id="${
                      address.location_id
                    }"  ${address.is_default ? "disabled" : ""}>${
                      address.is_default ? "Set as Default" : "Set as default"
                    }</button>
                    ${deleteButton}
                </div>
            </div>
            <hr class="admin-hr"/>
          </div>
        `;
        $addressList.append(addressCard);
      });
    },
  });
}

// ==========================
// Sidebar Toggle
// ==========================
function setupSidebarToggle() {
  function isMobileScreen() {
    return window.matchMedia("(max-width: 991.98px)").matches;
  }

  function resetSidebarForMobile() {
    if (isMobileScreen()) {
      $(".sidebar").removeClass("collapsed");
      $(".wrapper").removeClass("sidebar-collapsed");

      // Remove old inline display:none caused by previous jQuery .hide()
      $(".text-link").removeAttr("style");

      $(".menu-btn").show();
      $(".close-btn").hide();
    }
  }

  $(".menu-btn")
    .off("click.sidebarToggle")
    .on("click.sidebarToggle", function () {
      if (isMobileScreen()) return;

      $(".sidebar").addClass("collapsed");
      $(".wrapper").addClass("sidebar-collapsed");

      // Do not use $(".text-link").hide() here
      $(".close-btn").show();
      $(".menu-btn").hide();
    });

  $(".close-btn")
    .off("click.sidebarToggle")
    .on("click.sidebarToggle", function () {
      if (isMobileScreen()) return;

      $(".sidebar").removeClass("collapsed");
      $(".wrapper").removeClass("sidebar-collapsed");

      // Do not use $(".text-link").show() here
      $(".close-btn").hide();
      $(".menu-btn").show();
    });

  resetSidebarForMobile();
  $(window)
    .off("resize.sidebarToggle")
    .on("resize.sidebarToggle", resetSidebarForMobile);
}

// ==========================
// Document Ready
// ==========================
$(document).ready(function () {
  /* ------------------------------
     Load User Session
  ------------------------------ */
  load_user();
  displayAddresses();
  setupSidebarToggle();

  $(document)
    .ajaxStart(() => $("#wait").show())
    .ajaxComplete(() => $("#wait").hide());

  // console.log("Loading profile for user:", usr);

  // --- Sidebar Toggle ---
  // $(".menu-btn").on("click", function () {
  //   $(".sidebar").addClass("collapsed");
  //   $(".wrapper").addClass("sidebar-collapsed");
  //   $(".text-link").hide();
  //   $(".close-btn").show();
  //   $(".menu-btn").hide();
  // });

  // $(".close-btn").on("click", function () {
  //   $(".sidebar").removeClass("collapsed");
  //   $(".wrapper").removeClass("sidebar-collapsed");
  //   $(".text-link").show();
  //   $(".close-btn").hide();
  //   $(".menu-btn").show();
  // });

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

  // --- Upload Profile Image ---
  $("#account-form").on("submit", function (e) {
    e.preventDefault();

    const fd = new FormData(this);
    fd.append("_method", "PUT");

    console.log("Uploading form data:", Array.from(fd.entries()));

    $.ajax({
      url: `${ip}/api/updateImageAccount/${$("#user_id").val()}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      data: fd,
      processData: false,
      contentType: false,
      success: function (res) {
        if (res.status === 200) {
          Swal.fire({
            icon: "success",
            title: "Profile Saved",
            text: "Your account has been updated.",
            showConfirmButton: false,
          }).then(() => location.reload());
        }
      },
      error: function (xhr) {
        Swal.fire({
          icon: "error",
          title: "Error Updating Profile",
          text: xhr.responseText,
        });
      },
    });
  });

  // --- Toggle Password Visibility ---
  $(".togglePassword").on("click", function () {
    const $targetInput = $($(this).data("target"));
    const $icon = $(this).find("i");

    const newType =
      $targetInput.attr("type") === "password" ? "text" : "password";
    $targetInput.attr("type", newType);

    $icon.toggleClass("fa-eye fa-eye-slash");
  });

  // --- Adding Address ---
  $("#locationForm").on("submit", function (e) {
    e.preventDefault();

    const fd = new FormData(this);
    $("#createLocation").text("Adding...");

    $.ajax({
      url: `${ip}/api/location`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      data: fd,
      processData: false,
      contentType: false,
      success: function () {
        Swal.fire({
          icon: "success",
          title: "Address Added Successfully",
          showConfirmButton: false,
        }).then(() => {
          $("#createLocation").text("Add");
          $("#locationForm")[0].reset();
          location.reload();
        });
      },
      error: function (xhr) {
        Swal.fire({
          icon: "error",
          title: "Error Adding Brand",
          text: xhr.responseText,
        });
      },
    });
  });

  // --- Fetch Address Handlers ---
  $(document).on("click", ".editAddress", function (e) {
    e.preventDefault();

    const addressId = $(this).data("id");
    $("#location_id").val(addressId);

    // console.log("Edit address:", addressId);

    $.ajax({
      url: `${ip}/api/location/${addressId}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      success: function (res) {
        // console.log("Address data:", res);

        const data = res;

        // Populate modal form fields
        $("#editPurok").val(data.purok);
        $("#editBarangay").val(data.barangay);
        $("#editCity").val(data.city);
        $("#editProvince").val(data.province);
        $("#editZipcode").val(data.zipcode);
      },
      error: function (xhr) {
        Swal.fire({
          icon: "error",
          title: "Error Fetching Address",
          text: xhr.responseText,
        });
      },
    });
  });

  // --- Update Address Handler ---
  $("#editLocationForm").submit(function (e) {
    e.preventDefault();

    const fd = new FormData(this);
    fd.append("_method", "PUT");

    $(".editAddress").text("Updating....");

    $.ajax({
      url: `${ip}/api/location/${$("#location_id").val()}`,
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
      },
      data: fd,
      processData: false,
      contentType: false,
      success: function (res) {
        console.log("Location updated successfully:", res);
        if (res.status === 200) {
          Swal.fire({
            icon: "success",
            title: "Location Updated Successfully",
            text: "Your location has been updated.",
            showConfirmButton: false,
          }).then(() => {
            $("#editLocation").text("Update");
            $("#editLocationForm")[0].reset(); // Reset the form
            location.reload(); // Reload the page to see changes
          });
        }
      },
      error: function (xhr) {
        Swal.fire({
          icon: "error",
          title: "Error Updating Location",
          text: xhr.responseText,
        });
      },
    });
  });

  // --- Set as Default Address Handler ---
  $(document).on("click", ".setDefault", function (e) {
    e.preventDefault();

    const addressId = $(this).data("id");
    // $("#locationId").val(addressId);

    // Add loading state to the button
    const $button = $(this);
    $button.prop("disabled", true).text("Setting...");

    // AJAX call to set as default (adjust endpoint/method as per your API)
    $.ajax({
      url: `${ip}/api/location/${addressId}/setDefaultAddress`,
      method: "PUT",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      success: function () {
        // Update UI instantly
        $(".default-badge").remove();
        $(".setDefault").prop("disabled", false).text("Set as default");
        $(".deleteAddress").show(); // Show delete for all non-defaults

        // Apply changes to selected address
        $button
          .closest(".addressCard")
          .find(".mt-2.d-flex")
          .prepend('<span class="default-badge">Default</span>');

        // $button.text("Default").prop("disabled", true);
        // $button.closest(".addressCard").find(".deleteAddress").hide();

        // Disable this button (default one)
        $button.prop("disabled", true).text("Default");

        // Hide delete button for default address
        // $button.closest(".addressCard").find(".deleteAddress").hide();

        // Toast notification
        showToast("Address set as default successfully!", "success");

        setTimeout(function () {
          window.location.reload();
        }, 1000);
      },
      error: function (xhr) {
        console.error("Error setting default address:", xhr);
        showToast("Failed to set default address. Please try again.", "danger");
      },
      complete: function () {
        $button.prop("disabled", false).text("Set as default");
      },
    });
  });

  $(document).on("click", ".deleteAddress", function (e) {
    event.preventDefault();
    const addressId = $(this).data("id");

    Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    }).then((res) => {
      if (res.isConfirmed) {
        $.ajax({
          url: `${ip}/api/location/${addressId}`,
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          success: function () {
            Swal.fire("Deleted!", res.msg, "success").then(() => {
              location.reload();
            });
          },
          error: function (xhr) {
            Swal.fire("Error", xhr.responseText, "error");
          },
        });
      }
    });
  });

  /* -----------------------------
     LOGOUT HANDLER
  ----------------------------- */
  $("#logout").click((e) => {
    e.preventDefault();

    removeFcmTokenFromServer(function () {
      $.ajax({
        url: `${ip}/api/logout`,
        type: "POST",
        headers: { Authorization: `Bearer ${token}` },
        data: { token },
        success: () => {
          Swal.fire({ icon: "success", title: "Logout Successful" }).then(
            () => {
              Object.keys($.cookie()).forEach((cookie) =>
                $.removeCookie(cookie),
              );
              window.location.replace("login.html");
            },
          );
        },
        error: (res) => {
          const msg =
            res.responseJSON?.msg || "Logout failed. Please try again.";
          Swal.fire({ icon: "error", title: "Error", text: msg });
        },
      });
    });
  });
});
