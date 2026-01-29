// ==========================
// Global Configuration
// ==========================
const ip = "http://localhost:8000";
let token = null;
let usr = null;
let role = null;
let profileImage = null;

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
  const $adminDashboard = $("#adminDashboard");
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");

  if (!usr || !token) {
    // No session → show login/register, hide logout & cart
    $displayUsername.html("My Account");
    $login.show();
    $register.show();
    $logout.hide();
    $cartCount.hide();
    $adminDashboard.hide();
    $navbarProfileImage.hide();
    $defaultProfileIcon.show();
    return;
  }

  // Session exists → show username & logout
  $displayUsername.html(`<b>${usr}</b>`);
  $login.hide();
  $register.hide();
  $logout.show();
  $cartCount.show();

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

// ==========================
// Fetch User Account Info
// ==========================
function loadAccountInfo(usr, token) {
  $.ajax({
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

      // Clear password fields
      $("#password, #password_confirmation").val("");
    },
    error: function (xhr) {
      console.error("Error fetching account info:", xhr);
      alert("Failed to load account details. Please try again later.");
    },
  });
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
          res
        );
        $("#addressList").html(
          '<p class="text-danger">Invalid response from server.</p>'
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
// Document Ready
// ==========================
$(document).ready(function () {
  /* ------------------------------
     Load User Session
  ------------------------------ */
  load_user();
  displayAddresses();

  $(document)
    .ajaxStart(() => $("#wait").show())
    .ajaxComplete(() => $("#wait").hide());

  // console.log("Loading profile for user:", usr);

  // --- Sidebar Toggle ---
  $(".menu-btn").on("click", function () {
    $(".sidebar").addClass("collapsed");
    $(".wrapper").addClass("sidebar-collapsed");
    $(".text-link").hide();
    $(".close-btn").show();
    $(".menu-btn").hide();
  });

  $(".close-btn").on("click", function () {
    $(".sidebar").removeClass("collapsed");
    $(".wrapper").removeClass("sidebar-collapsed");
    $(".text-link").show();
    $(".close-btn").hide();
    $(".menu-btn").show();
  });

  // -------------------------------
  // Global AJAX Loading Animation
  // -------------------------------
  $(document)
    .ajaxStart(() => $("#wait").show())
    .ajaxComplete(() => $("#wait").hide());

  // --- Load Navbar Profile Image ---
  if (usr) {
    $.ajax({
      url: `${ip}/api/getAccount_username/${usr}`,
      type: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      dataType: "json",
      success: function (response) {
        // console.log("User data:", response);
        const $navbarProfileImage = $("#navbarProfileImage");
        const $defaultProfileIcon = $("#defaultProfileIcon");

        if (response?.image) {
          $navbarProfileImage
            .attr("src", `${ip}/FrontEnd/assets/img/user/${response.image}`)
            .show();
          $defaultProfileIcon.hide();
        } else {
          $navbarProfileImage.hide();
          $defaultProfileIcon.show();
        }
      },
      error: function (xhr) {
        console.error("Error loading profile:", xhr.responseText);
        $("#navbarProfileImage").hide();
        $("#defaultProfileIcon").show();
      },
    });
  } else {
    console.error("No username found in cookie.");
  }

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
            title: "Profile Updated Successfully",
            text: "Your account has been updated.",
            showConfirmButton: false,
          }).then(() => location.reload());
        }
      },
      error: function (xhr) {
        Swal.fire({
          icon: "error",
          title: "Error Updating Account",
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

  // -------------------------------
  // Fetch Cart Count
  // -------------------------------
  function updateCartCount(count) {
    $("#cart-count").text(count);
  }

  // Fetch cart count on page load
  $.ajax({
    url: `${ip}/api/cart`,
    method: "GET",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
    },
    success: function (response) {
      console.log("Cart items fetched successfully:", response);
      updateCartCount(response.count);
    },
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
