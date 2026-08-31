// =======================================
// GLOBAL VARIABLES
// =======================================
//const ip = "https://api.hanzgo.me";

if (!window.APP_CONFIG?.API_BASE_URL) {
  throw new Error("APP_CONFIG is missing. Load config.js before manageAcc.js.");
}

const ip = window.APP_CONFIG.API_BASE_URL;

let token = $.cookie("token");
let usr = $.cookie("username");
let role = $.cookie("role");
let profileImage = $.cookie("profileImage");

function hasActiveSession() {
  return Boolean(usr && token);
}

// =======================================
// LOAD USER SESSION & NAVBAR
// =======================================
function load_user() {
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

  if (!usr || !token) {
    // No session
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
    return;
  }

  // Session exists
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

function clearTable(tableId) {
  if ($.fn.DataTable.isDataTable(tableId)) {
    $(tableId).DataTable().clear().destroy();
  }
  $(`${tableId} tbody`).empty();
}

function renderNoAccountRow(tableId, message = "No account display") {
  const columnCount = $(`${tableId} thead th`).length || 1;
  $(`${tableId} tbody`).html(`
    <tr>
      <td colspan="${columnCount}" class="text-center">${message}</td>
    </tr>
  `);
}

function renderAccountsTable(tableId, accounts) {
  clearTable(tableId);

  if (!accounts.length) {
    renderNoAccountRow(tableId);
    return;
  }

  accounts.forEach((account) => appendTableRow(tableId, account));
  initializeDataTable(tableId);
}

function showNoAccountDisplayState() {
  const emptyText = "No account display";
  $("#countedAccounts").text(emptyText);
  $("#countedAdmins").text(emptyText);
  $("#countedSellers").text(emptyText);
  $("#countedUsers").text(emptyText);

  ["#admin-table", "#seller-table", "#user-table"].forEach((tableId) => {
    clearTable(tableId);
    renderNoAccountRow(tableId, emptyText);
  });
}

// =======================================
// SIDEBAR TOGGLE
// =======================================
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
// =======================================
// ADMIN ACCOUNT CREATION
// =======================================
function setupRegistrationForm() {
  $("#accountForm").on("submit", function (e) {
    e.preventDefault();

    const $createButton = $("#createAcc");
    const originalButtonText = $createButton.text();

    const formData = {
      username: $("#username").val().trim(),
      email: $("#email").val().trim(),
      phone_number: $("#phone_number").val().trim(),
      password: $("#password").val(),
      password_confirmation: $("#password_confirmation").val(),
      fullname: $("#fullname").val().trim(),
      role: $("#role").val(),
    };

    $.ajax({
      type: "POST",

      // Admin-specific endpoint
      url: `${ip}/api/admin/create-account`,

      contentType: "application/json",

      // Send logged-in admin token
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },

      data: JSON.stringify(formData),

      beforeSend: () => {
        $("#wait").show();

        $(".error-message").text("");
        $(".form-control, .custom-select").removeClass("is-invalid");

        $createButton
          .prop("disabled", true)
          .html(
            '<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>Adding...',
          );
      },

      success: (res) => {
        $(".error-message").text("");
        $(".form-control, .custom-select").removeClass("is-invalid");

        // Clear form
        this.reset();

        Swal.fire({
          title: "Account Created",
          text:
            res.msg ||
            "The account was created successfully and can log in immediately.",
          icon: "success",
        }).then(() => {
          window.location.replace("manageAccounts.html");
        });
      },

      error: (xhr) => {
        $(".error-message").text("");
        $(".form-control, .custom-select").removeClass("is-invalid");

        // Laravel validation errors
        if (xhr.status === 422 && xhr.responseJSON?.errors) {
          const errors = xhr.responseJSON.errors;

          Object.keys(errors).forEach((field) => {
            const message = errors[field][0];

            // Password confirmation mismatch
            if (
              field === "password" &&
              message.toLowerCase().includes("confirmation")
            ) {
              $("#password_confirmationError").text(message);
              $("#password_confirmation").addClass("is-invalid");
            } else {
              $(`#${field}Error`).text(message);
              $(`[name="${field}"]`).addClass("is-invalid");
            }
          });

          return;
        }

        // Unauthorized admin
        if (xhr.status === 401 || xhr.status === 403) {
          Swal.fire({
            icon: "warning",
            title: "Action Not Allowed",
            text: "This account cannot be permanently deleted.",
            confirmButtonText: "OK",
          });
          return;
        }

        Swal.fire({
          title: "Account Creation Failed",
          text:
            xhr.responseJSON?.msg ||
            xhr.responseJSON?.message ||
            "Unable to create the account.",
          icon: "error",
        });
      },

      complete: () => {
        $("#wait").hide();
        $createButton.prop("disabled", false).text(originalButtonText);
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

// =======================================
// APPEND TABLE ROW
// =======================================
function appendTableRow(tableId, user) {
  const isActive =
    user.is_active === true || user.is_active === 1 || user.is_active === "1";

  const statusBadge = isActive
    ? '<span class="badge badge-success">Active</span>'
    : '<span class="badge badge-secondary">Inactive</span>';

  const imageHtml = user.image
    ? `<img
         src="${ip}/FrontEnd/assets/img/user/${user.image}"
         width="50"
         height="50"
         style="object-fit: cover; border-radius: 50%;"
       />`
    : `<i class="fas fa-user-circle fa-3x text-secondary"></i>`;

  let accountStatusButton = "";
  let deleteButton = "";

  // user_id 1 = protected Super Admin
  if (Number(user.user_id) !== 1) {
    if (isActive) {
      accountStatusButton = `
        <a
          href="#"
          data-id="${user.user_id}"
          data-username="${user.username}"
          class="text-warning mx-1 deactivateBtn"
          title="Deactivate Account">
          <i class="fas fa-user-slash fa-2x"></i>
        </a>
      `;
    } else {
      accountStatusButton = `
        <a
          href="#"
          data-id="${user.user_id}"
          data-username="${user.username}"
          class="text-primary mx-1 reactivateBtn"
          title="Reactivate Account">
          <i class="fas fa-user-check fa-2x"></i>
        </a>
      `;
    }

    deleteButton = `
      <a
        href="#"
        data-id="${user.user_id}"
        class="text-danger mx-1 deleteBtn"
        title="Delete Account">
        <i class="fas fa-trash fa-2x"></i>
      </a>
    `;
  }

  $(`${tableId} tbody`).append(`
    <tr>
      <td>${user.user_id}</td>
      <td>${user.username}</td>
      <td>${user.email}</td>
      <td>${user.fullname}</td>
      <td>${user.phone_number}</td>
      <td>${user.role}</td>
      <td>${statusBadge}</td>
      <td>${imageHtml}</td>

      <td class="text-nowrap">
        <a
          href="#"
          data-id="${user.user_id}"
          class="text-success mx-1 editBtn"
          data-toggle="modal"
          data-target="#editAccountModal"
          title="Edit Account">
          <i class="fas fa-edit fa-2x"></i>
        </a>

        ${accountStatusButton}
        ${deleteButton}
      </td>
    </tr>
  `);
}

// =======================================
// LOAD ACCOUNT SUMMARY
// =======================================
function loadAccountsSummary() {
  fetchData("accountsSummary", (res) => {
    $("#countedAccounts").text(res.totalAccounts ?? 0);
    $("#countedAdmins").text(res.totalAdmins ?? 0);
    $("#countedSellers").text(res.totalSellers ?? 0);
    $("#countedUsers").text(res.totalUsers ?? 0);

    renderAccountsTable("#admin-table", res.admins || []);
    renderAccountsTable("#seller-table", res.sellers || []);
    renderAccountsTable("#user-table", res.users || []);
  });
}

// =======================================
// EDIT ACCOUNT HANDLER
// =======================================
function setupEditButtons() {
  $(document).on("click", ".editBtn", function (e) {
    e.preventDefault();

    // Clear validation from previously edited account
    $("#editAccountForm .error-message").text("");
    $(
      "#editAccountForm .form-control, #editAccountForm .custom-select",
    ).removeClass("is-invalid");

    const userId = $(this).data("id");
    $("#user_id").val(userId);

    fetchData(`getAccount_id/${userId}`, (res) => {
      $("#editUsername").val(res.username);
      $("#editEmail").val(res.email);
      $("#editPhone_number").val(res.phone_number);
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
    const $editButton = $("#editAccount");
    const originalButtonText = $editButton.text();

    $editButton.text("Updating...");

    $.ajax({
      url: `${ip}/api/updateAccount/${$("#user_id").val()}`,
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      data: fd,
      processData: false,
      contentType: false,
      beforeSend: () => {
        $("#wait").show();
        $(".error-message").text("");
        $(".form-control, .custom-select").removeClass("is-invalid");
        $editButton
          .prop("disabled", true)
          .html(
            '<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>Updating...',
          );
      },
      success: (res) => {
        if (res.status === 200) {
          Swal.fire({
            icon: "success",
            title: "Account Updated",
            text: "Changes saved successfully.",
          }).then(() => {
            $editButton.text("Update");
            this.reset();
            location.reload();
          });
        }
      },
      error: (xhr) => {
        if (xhr.status === 422 && xhr.responseJSON?.errors) {
          const errors = xhr.responseJSON.errors;
          for (let field in errors) {
            $(`#${field}Error`).text(errors[field][0]);
            $(`[name="${field}"]`).addClass("is-invalid");
          }
          return;
        }

        Swal.fire({
          icon: "error",
          title: "Error",
          text: xhr.responseJSON?.msg || xhr.responseText,
        });
      },
      complete: () => {
        $("#wait").hide();
        $editButton.prop("disabled", false).text(originalButtonText);
      },
    });
  });
}

// =======================================
// DeactivateButtons
// =======================================
function setupDeactivateButtons() {
  $(document).on("click", ".deactivateBtn", function (e) {
    e.preventDefault();

    const userId = $(this).data("id");
    const username = $(this).data("username");

    Swal.fire({
      title: "Deactivate Account?",
      text: `${username} will no longer be able to log in. Their account and records will be preserved.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Deactivate",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (!result.isConfirmed) return;

      $.ajax({
        url: `${ip}/api/account/${userId}/deactivate`,
        method: "PUT",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },

        success: function (res) {
          Swal.fire({
            icon: "success",
            title: "Account Deactivated",
            text: res.msg,
          }).then(() => {
            location.reload();
          });
        },

        error: function (xhr) {
          Swal.fire({
            icon: "error",
            title: "Unable to Deactivate",
            text:
              xhr.responseJSON?.msg || "The account could not be deactivated.",
          });
        },
      });
    });
  });
}

// =======================================
// ReactivateButtons
// =======================================
function setupReactivateButtons() {
  $(document).on("click", ".reactivateBtn", function (e) {
    e.preventDefault();

    const userId = $(this).data("id");
    const username = $(this).data("username");

    Swal.fire({
      title: "Reactivate Account?",
      text: `${username} will be allowed to log in again.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Reactivate",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (!result.isConfirmed) return;

      $.ajax({
        url: `${ip}/api/account/${userId}/reactivate`,
        method: "PUT",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },

        success: function (res) {
          Swal.fire({
            icon: "success",
            title: "Account Reactivated",
            text: res.msg,
          }).then(() => {
            location.reload();
          });
        },

        error: function (xhr) {
          Swal.fire({
            icon: "error",
            title: "Unable to Reactivate",
            text:
              xhr.responseJSON?.msg || "The account could not be reactivated.",
          });
        },
      });
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
          success: function (res) {
            Swal.fire({
              icon: "success",
              title: "Deleted!",
              text: res.msg,
            }).then(() => {
              location.reload();
            });
          },
          error: function (xhr) {
            if (xhr.status === 409) {
              Swal.fire({
                icon: "warning",
                title: "Account Cannot Be Deleted",
                text: "This account is linked to existing records. Please deactivate the account instead to preserve its history.",
                confirmButtonText: "OK",
              });
              return;
            }

            Swal.fire({
              icon: "error",
              title: "Unable to Delete Account",
              text: "Something went wrong while deleting the account. Please try again.",
              confirmButtonText: "OK",
            });
          },
        });
      }
    });
  });
}

// =======================================
// INITIALIZE ON DOCUMENT READY
// =======================================
$(document).ready(() => {
  load_user();
  setupSidebarToggle();

  if (!hasActiveSession()) {
    showNoAccountDisplayState();
    return;
  }

  loadProfileImage();
  setupRegistrationForm();
  setupEditButtons();
  setupAccountUpdate();
  setupDeactivateButtons();
  setupReactivateButtons();
  setupDeleteButtons();

  // Load all account tables and counts
  loadAccountsSummary();

  // -------------------------------
  // Fetch Cart Count
  // -------------------------------
  function updateCartCount(count) {
    $("#cart-count").text(count);
  }

  // Fetch cart count on page load
  if ((role === "user" || role === "seller") && token) {
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
  }

  // -------------------------------
  // Logout Handler
  // -------------------------------
  $("#logout").click((e) => {
    e.preventDefault();

    function clearAuthCookies() {
      const authCookies = [
        "token",
        "username",
        "role",
        "user_id",
        "profileImage",
      ];

      authCookies.forEach((cookie) => {
        // Remove cookies created with path "/"
        $.removeCookie(cookie, { path: "/" });

        // Also remove older cookies that may not have an explicit path
        $.removeCookie(cookie);
      });
    }

    function logoutFromServer() {
      $.ajax({
        url: `${ip}/api/logout`,
        type: "POST",

        headers: {
          Authorization: `Bearer ${token}`,
        },

        data: {
          token: token,
        },

        success: () => {
          clearAuthCookies();

          Swal.fire({
            icon: "success",
            title: "Logout Successful",
          }).then(() => {
            window.location.replace("login.html");
          });
        },

        error: (res) => {
          // Even if the backend token is already invalid,
          // clear the local login session.
          const msg =
            res.responseJSON?.msg ||
            "Your session has ended. Please log in again.";

          clearAuthCookies();

          Swal.fire({
            icon: "warning",
            title: "Logged Out",
            text: msg,
          }).then(() => {
            window.location.replace("login.html");
          });
        },
      });
    }

    // Explicit logout should remove the browser's FCM token.
    if (typeof removeFcmTokenFromServer === "function") {
      removeFcmTokenFromServer(function () {
        logoutFromServer();
      });
    } else {
      logoutFromServer();
    }
  });
});
