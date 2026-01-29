// =======================================
// GLOBAL VARIABLES
// =======================================
const ip = "http://localhost:8000";
let token = $.cookie("token");
let usr = $.cookie("username");
let role = $.cookie("role");
let profileImage = $.cookie("profileImage");

// =======================================
// LOAD USER SESSION & NAVBAR
// =======================================
function load_user() {
  const $displayUsername = $("#displayUsername");
  const $login = $("#login");
  const $register = $("#register");
  const $logout = $("#logout");
  const $cartCount = $("#cart-count");
  const $adminDashboard = $("#adminDashboard");
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");

  if (!usr || !token) {
    // No session
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

  // Session exists
  $displayUsername.html(`<b>${usr}</b>`);
  $login.hide();
  $register.hide();
  $logout.show();
  $cartCount.show();

  // Role-based dashboard visibility
  if (["admin", "seller"].includes(role)) {
    $adminDashboard.show();
  } else {
    $adminDashboard.hide();
  }
}

// =======================================
// UTILITIES
// =======================================
$(document).ajaxStart(() => $("#wait").show());
$(document).ajaxComplete(() => $("#wait").hide());

// Generic AJAX Helper
function fetchData(url, successCallback, errorMessage) {
  $.ajax({
    url: `${ip}/api/${url}`,
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    success: successCallback,
    error: (xhr) => {
      console.error(`Error fetching ${url}:`, xhr);
      alert(errorMessage || "An error occurred. Check console for details.");
    },
  });
}

// =======================================
// SIDEBAR TOGGLE
// =======================================
function setupSidebarToggle() {
  $(".menu-btn").on("click", () => {
    $(".sidebar").addClass("collapsed");
    $(".wrapper").addClass("sidebar-collapsed");
    $(".text-link").hide();
    $(".close-btn").show();
    $(".menu-btn").hide();
  });

  $(".close-btn").on("click", () => {
    $(".sidebar").removeClass("collapsed");
    $(".wrapper").removeClass("sidebar-collapsed");
    $(".text-link").show();
    $(".close-btn").hide();
    $(".menu-btn").show();
  });
}

// =======================================
// NAVBAR PROFILE IMAGE
// =======================================
function loadProfileImage() {
  if (!usr) return console.warn("No username found in cookie.");

  fetchData(`getAccount_username/${usr}`, (res) => {
    if (res?.image) {
      $("#navbarProfileImage")
        .attr("src", `${ip}/FrontEnd/assets/img/user/${res.image}`)
        .show();
      $("#defaultProfileIcon").hide();
    } else {
      $("#navbarProfileImage").hide();
      $("#defaultProfileIcon").show();
    }
  });
}

// =======================================
// ACCOUNT REGISTRATION
// =======================================
function setupRegistrationForm() {
  $("#accountForm").on("submit", function (e) {
    e.preventDefault();

    const formData = {
      username: $("#username").val(),
      email: $("#email").val(),
      password: $("#password").val(),
      password_confirmation: $("#password_confirmation").val(),
      fullname: $("#fullname").val(),
      role: $("#role").val(),
    };

    $.ajax({
      type: "POST",
      url: `${ip}/api/register`,
      contentType: "application/json",
      data: JSON.stringify(formData),
      success: () => {
        $(".error-message").text("");
        $(".form-control").removeClass("is-invalid");
        this.reset();

        Swal.fire({
          title: "Successfully Registered",
          text: "Please log in to continue.",
          icon: "success",
        }).then(() => window.location.replace("manageAccounts.html"));
      },
      error: (xhr) => {
        $(".error-message").text("");
        if (xhr.status === 422 && xhr.responseJSON.errors) {
          const errors = xhr.responseJSON.errors;
          for (let field in errors) {
            $(`#${field}Error`).text(errors[field][0]);
          }
        } else {
          Swal.fire({
            title: "Registration Failed",
            text: xhr.responseJSON?.msg || "Unknown error",
            icon: "error",
          });
        }
      },
    });
  });
}

// =======================================
// TABLE HELPERS
// =======================================
function initializeDataTable(selector) {
  $(selector).DataTable({
    responsive: { details: { type: "column", target: "tr" } },
    scrollX: true,
    autoWidth: false,
    columnDefs: [{ targets: "_all", className: "text-center" }],
  });
  $(`${selector} thead th`).addClass("text-center");
}

function appendTableRow(tableId, user) {
  $(`${tableId} tbody`).append(`
    <tr>
      <td>${user.user_id}</td>
      <td>${user.username}</td>
      <td>${user.email}</td>
      <td>${user.fullname}</td>
      <td>${user.phone_number}</td>
      <td>${user.role}</td>
      <td><img src="${ip}/FrontEnd/assets/img/user/${user.image}" width="50" height="50"></td>
      <td>
        <a href="#" data-id="${user.user_id}" class="text-success mx-1 editBtn" data-toggle="modal" data-target="#editAccountModal">
          <i class="fas fa-edit fa-2x"></i>
        </a>
        <a href="#" data-id="${user.user_id}" class="text-danger mx-1 deleteBtn">
          <i class="fas fa-trash fa-2x"></i>
        </a>
      </td>
    </tr>
  `);
}

// =======================================
// LOAD ADMINS / SELLERS / USERS
// =======================================
function loadAdmins() {
  fetchData("admins", (res) => {
    const admins = res.admins || [];
    const tableId = "#admin-table";

    $(tableId).DataTable().clear().destroy();
    $(tableId + " tbody").empty();

    admins.forEach((admin) => appendTableRow(tableId, admin));
    initializeDataTable(tableId);
  });
}

function loadSellers() {
  fetchData("sellers", (res) => {
    const sellers = res.sellers || [];
    const tableId = "#seller-table";

    $(tableId).DataTable().clear().destroy();
    $(tableId + " tbody").empty();

    sellers.forEach((seller) => appendTableRow(tableId, seller));
    initializeDataTable(tableId);
  });
}

function loadUsers() {
  fetchData("users", (res) => {
    const users = res.users || [];
    const tableId = "#user-table";

    $(tableId).DataTable().clear().destroy();
    $(tableId + " tbody").empty();

    users.forEach((user) => appendTableRow(tableId, user));
    initializeDataTable(tableId);
  });
}

// =======================================
// EDIT ACCOUNT HANDLER
// =======================================
function setupEditButtons() {
  $(document).on("click", ".editBtn", function (e) {
    e.preventDefault();
    const userId = $(this).data("id");
    $("#user_id").val(userId);

    fetchData(`getAccount_id/${userId}`, (res) => {
      $("#editUsername").val(res.username);
      $("#editEmail").val(res.email);
      $("#editFullname").val(res.fullname);
      $("#editRole").val(res.role);
    });
  });
}

// =======================================
// UPDATE ACCOUNT
// =======================================
function setupAccountUpdate() {
  $("#editAccountForm").on("submit", function (e) {
    e.preventDefault();
    const fd = new FormData(this);
    fd.append("_method", "PUT");

    $("#editAccount").text("Updating...");

    $.ajax({
      url: `${ip}/api/updateAccount/${$("#user_id").val()}`,
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      data: fd,
      processData: false,
      contentType: false,
      success: (res) => {
        if (res.status === 200) {
          Swal.fire({
            icon: "success",
            title: "Account Updated",
            text: "Changes saved successfully.",
          }).then(() => {
            $("#editAccount").text("Update");
            this.reset();
            location.reload();
          });
        }
      },
      error: (xhr) => {
        Swal.fire({ icon: "error", title: "Error", text: xhr.responseText });
      },
    });
  });
}

// =======================================
// DELETE ACCOUNT
// =======================================
function setupDeleteButtons() {
  $(document).on("click", ".deleteBtn", function (e) {
    e.preventDefault();
    const userId = $(this).data("id");

    Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        $.ajax({
          url: `${ip}/api/deleteAccount/${userId}`,
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          success: (res) => {
            Swal.fire("Deleted!", res.msg, "success").then(() =>
              location.reload()
            );
          },
          error: (xhr) => Swal.fire("Error!", xhr.responseText, "error"),
        });
      }
    });
  });
}

// =======================================
// COUNT DASHBOARD STATS
// =======================================
function loadCounts() {
  fetchData("countedAccounts", (res) =>
    $("#countedAccounts").text(res.totalAccounts)
  );
  fetchData("countedAdmins", (res) =>
    $("#countedAdmins").text(res.totalAdmins)
  );
  fetchData("countedSellers", (res) =>
    $("#countedSellers").text(res.totalSellers)
  );
  fetchData("countedUsers", (res) => $("#countedUsers").text(res.totalUsers));
}

// =======================================
// INITIALIZE ON DOCUMENT READY
// =======================================
$(document).ready(() => {
  load_user();
  loadProfileImage();
  setupSidebarToggle();
  setupRegistrationForm();
  setupEditButtons();
  setupAccountUpdate();
  setupDeleteButtons();

  // Load all tables and counts
  loadAdmins();
  loadSellers();
  loadUsers();
  loadCounts();

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
});
