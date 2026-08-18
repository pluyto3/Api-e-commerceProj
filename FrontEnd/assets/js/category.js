// Global variables
let ip = "https://api.hanzgo.me";
let token = null;
let usr = null;
let role = null;
let profileImage = null;
let categoriesCache = [];
let categorySellerLookup = {};
let currentUserId = null;
const categoryImageBaseUrl =
  "https://api.hanzgo.me/FrontEnd/assets/img/category";

function getCategoryImageUrl(imageName) {
  return imageName
    ? `${categoryImageBaseUrl}/${imageName}`
    : "assets/img/back.jpg";
}

function normalizeCategoryStatus(status) {
  return String(status || "pending").toLowerCase();
}

function getCategoryStatusBadgeClass(status) {
  if (status === "approved") return;
  if (status === "rejected") return;
  if (status === "pending") return;
  return "badge-secondary";
}

// Utility function to get the status badge for a category
function getStatusBadge(status) {
  const badgeClasses = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };

  const badgeClass = badgeClasses[status] || "badge-secondary";
  return `<span class="badge ${badgeClass}">${String(status).toUpperCase()}</span>`;
}

// Utility functions for category activity
function isCategoryActive(value) {
  return value === true || value === 1 || value === "1";
}

// Utility function to get the activity badge for a category
function getCategoryActivityBadge(value) {
  if (isCategoryActive(value)) {
    return `
      <span class="badge badge-success">
        ACTIVE
      </span>
    `;
  }

  return `
    <span class="badge badge-secondary">
      DEACTIVATED
    </span>
  `;
}

function formatCategoryDate(dateValue) {
  if (!dateValue) return "N/A";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getAjaxErrorMessage(xhr, fallback = "Request failed") {
  if (xhr?.status === 0) {
    return `Cannot connect to API server (${ip}).`;
  }

  return (
    xhr?.responseJSON?.msg ||
    xhr?.responseJSON?.message ||
    xhr?.statusText ||
    fallback
  );
}

function cacheCategorySeller(category) {
  const sellerId = category?.seller?.user_id || category?.seller_id;
  const sellerUsername =
    category?.seller?.username ||
    category?.seller_username ||
    category?.seller_name;

  if (sellerId && sellerUsername) {
    categorySellerLookup[String(sellerId)] = sellerUsername;
  }
}

function getCategorySellerDisplayName(category) {
  return (
    category?.seller?.username ||
    category?.seller?.fullname ||
    category?.seller_username ||
    category?.seller_name ||
    categorySellerLookup[String(category?.seller_id || "")] ||
    "N/A"
  );
}

function loadCategorySellerLookup() {
  return $.ajax({
    url: `${ip}/api/sellers`,
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    success: function (res) {
      const sellers = res?.sellers ?? res?.data ?? res;
      if (!Array.isArray(sellers)) return;

      sellers.forEach((seller) => {
        if (seller?.user_id && seller?.username) {
          categorySellerLookup[String(seller.user_id)] = seller.username;
        }
      });
    },
    error: function (xhr) {
      console.error(
        "Failed to load category seller lookup:",
        xhr?.responseText || xhr,
      );
    },
  });
}

function populateCategoryDetailsModal(
  category,
  modalSelector = "#categoryApprovedDetailsModal",
) {
  if (!category) return;
  const $modal = $(modalSelector);
  if (!$modal.length) return;

  const status = normalizeCategoryStatus(
    category.status || category.approval_status,
  );
  cacheCategorySeller(category);

  const seller = getCategorySellerDisplayName(category);
  const description = category.description || "N/A";
  const rejectionReason = category.approval_reason || "";
  const submittedDate =
    category.created_at || category.submitted_at || category.updated_at || null;
  const imageUrl = getCategoryImageUrl(category.image);
  const categoryId = category.category_id || category.id || "";

  $modal.attr("data-category-id", categoryId);
  $modal.attr("data-category-status", status);
  $modal.find(".category-detail-id").text(categoryId || "N/A");
  $modal.find(".category-detail-name").text(category.name || "N/A");
  $modal.find(".category-detail-seller").text(seller);
  $modal.find(".category-detail-description").text(description);
  const $reasonWrap = $modal.find(".category-detail-reason-wrap");
  const $reasonText = $modal.find(".category-detail-reason");
  if (status === "rejected") {
    $reasonText.text(rejectionReason || "No rejection reason was provided.");

    $reasonWrap.show();
  } else {
    $reasonText.text("");
    $reasonWrap.hide();
  }
  $modal.find(".category-detail-date").text(formatCategoryDate(submittedDate));
  $modal
    .find(".category-detail-status")
    .removeClass("badge-success badge-danger badge-warning badge-secondary")
    .addClass(getCategoryStatusBadgeClass(status))
    .text(status.toUpperCase());

  $modal
    .find(".category-detail-image")
    .off("error")
    .attr("src", imageUrl)
    .on("error", function () {
      $(this).off("error").attr("src", "assets/img/back.jpg");
    });

  if (modalSelector === "#categoryApprovalModal") {
    const isPending = status === "pending";
    const isAdmin = role === "admin";
    const canModerate = isAdmin && isPending;

    $modal
      .find("#approveCategoryBtn, #rejectCategoryBtn")
      .prop("disabled", !canModerate)
      .toggle(canModerate);
    $modal.find("#cancelCategoryBtn").text(canModerate ? "Cancel" : "Close");
  }

  if (modalSelector === "#categoryApprovedDetailsModal") {
    const canRejectApproved = role === "admin" && status === "approved";
    $modal
      .find("#rejectApprovedCategoryBtn")
      .prop("disabled", !canRejectApproved)
      .toggle(canRejectApproved);
    $modal
      .find("#closeApprovedCategoryBtn")
      .text(canRejectApproved ? "Cancel" : "Close");
  }
}

// Function to load user session and update UI accordingly
function load_user() {
  usr = $.cookie("username");
  token = $.cookie("token");
  role = $.cookie("role");
  profileImage = $.cookie("profileImage");

  // console.log("Profile image cookie:", $.cookie("profileImage"));

  // Select elements
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
  const $addCategorySection = $(".add_category");
  const $sidebarAccounts = $("#sidebarAccounts");

  if (!usr || !token) {
    // No session → show login/register, hide logout and cart
    $displayUsername.html("My Account");
    $login.show();
    $register.show();
    $logout.hide();
    $cartCount.hide();
    $cartNav.hide();
    $cartNavMobile.hide();
    $adminDashboard.hide();

    // Show default icon, hide uploaded image
    $navbarProfileImage.hide();
    $defaultProfileIcon.show();
    $addCategorySection.hide();
    $sidebarAccounts.hide();

    return;
  }

  // Session exists → show username, show logout, hide login/register
  $displayUsername.html("<b>" + usr + "</b>");
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

  // Show/hide admin dashboard by role
  if (role === "admin" || role === "seller") {
    $adminDashboard.show();
  } else {
    $adminDashboard.hide();
  }

  // Show "Category Button" only for sellers
  if (role === "seller") {
    $addCategorySection.show();
    $sidebarAccounts.hide();
  } else {
    $addCategorySection.hide();
    $sidebarAccounts.show();
  }
}

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

$(document).ready(function () {
  load_user(); //  initialize session

  // Sidebar Toggle
  setupSidebarToggle();

  // $(".menu-btn").click(function () {
  //   $(".sidebar").addClass("collapsed");
  //   $(".wrapper").addClass("sidebar-collapsed");
  //   $(".text-link").hide();
  //   $(".close-btn").show();
  //   $(".menu-btn").hide();
  // });

  // $(".close-btn").click(function () {
  //   $(".sidebar").removeClass("collapsed");
  //   $(".wrapper").removeClass("sidebar-collapsed");
  //   $(".text-link").show();
  //   $(".close-btn").hide();
  //   $(".menu-btn").show();
  // });

  // Loading animation
  $(document).ajaxStart(() => $("#wait").show());
  $(document).ajaxComplete(() => $("#wait").hide());

  // Load profile image in navbar
  let profileReq = $.Deferred().resolve();

  if (usr) {
    profileReq = $.ajax({
      url: ip + "/api/getAccount_username/" + usr,
      type: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
      },
      dataType: "json",
      success: function (response) {
        console.log("User data:", response);

        if (response && response.image) {
          $("#navbarProfileImage").attr(
            "src",
            `${ip}/FrontEnd/assets/img/user/${response.image}`,
          );
          $("#navbarProfileImage").show();
          $("#defaultProfileIcon").hide();
        } else {
          $("#navbarProfileImage").hide();
          $("#defaultProfileIcon").show();
        }

        // STORE USER ID
        currentUserId = response.user_id;
      },
      error: function (xhr, status, error) {
        console.error("Error loading profile:", xhr.responseText);
        $("#navbarProfileImage").hide();
        $("#defaultProfileIcon").show();
      },
    });
  } else {
    console.error("No username found in cookie.");
  }

  $.when(loadCategorySellerLookup(), profileReq).always(function () {
    loadCategories();
  });

  // Creating category
  $("#categoryForm").on("submit", function (e) {
    e.preventDefault();

    const fd = new FormData(this);
    $("#createCategory").text("Adding...");

    $.ajax({
      url: ip + "/api/category",
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
      },
      data: fd,
      processData: false,
      contentType: false,
      success: function (res) {
        // console.log(res);
        Swal.fire({
          icon: "success",
          title: "Category Added Successfully",
          text: "Your category has been added.",
          showConfirmButton: false,
        }).then(() => {
          $("#createCategory").text("Add");
          $("#categoryForm")[0].reset(); // Reset the form
          location.reload(); // Reload the page to see changes
        });
      },
      error: function (xhr) {
        Swal.fire({
          icon: "error",
          title: "Error Adding Category",
          text: xhr.responseText,
        });
      },
    });
    // Move this outside the submit handler, ideally at the end of your document ready block
    $(document).on("click", ".closeBtn", function () {
      location.reload();
    });
  });

  // Utility function to filter categories by role and status
  function filterCategoriesByRole(categories, status) {
    return categories.filter((category) => {
      const categoryStatus = normalizeCategoryStatus(
        category.status || category.approval_status,
      );

      if (categoryStatus !== status) return false;

      if (role === "seller") {
        return String(category.seller_id) === String(currentUserId);
      }

      return true;
    });
  }

  // Utility function to render categories in the approved table
  function renderApprovedCategories(categories) {
    $("#approved-category-table tbody").empty();

    if (!categories || categories.length === 0) {
      $("#approved-category-table tbody").html(
        `<tr><td colspan="9" class="text-center text-muted py-4">No Approved Categories found.</td></tr>`,
      );
      return;
    }

    categories.forEach((category) => {
      const seller = getCategorySellerDisplayName(category);
      const description = category.description || "N/A";
      const approvedDate = formatCategoryDate(
        category.approved_at || category.updated_at || category.created_at,
      );
      const statusBadge = getStatusBadge(
        normalizeCategoryStatus(category.status || category.approval_status),
      );
      const active = isCategoryActive(category.is_active);
      const activityBadge = getCategoryActivityBadge(category.is_active);

      let approvedActionButtons = `
      <button
        class="btn btn-sm btn-info view-category"
        data-id="${category.category_id}">
        data-toggle="modal"
        data-target="#categoryApprovedDetailsModal">

        <i class="fas fa-eye"></i> View
      </button>
    `;

      // Seller-only actions
      if (role === "seller") {
        approvedActionButtons += `
        <button
          class="btn btn-sm btn-warning request-category-edit-btn"
          data-id="${category.category_id}">

          <i class="fas fa-edit"></i>
          Request Edit
        </button>
      `;

        // Active category
        if (active) {
          approvedActionButtons += `
          <button
            class="btn btn-sm btn-danger toggle-category-activity"
            data-id="${category.category_id}"
            data-action="deactivate">

            <i class="fas fa-ban"></i>
            Deactivate
          </button>
        `;

          // Deactivated category
        } else {
          approvedActionButtons += `
          <button
            class="btn btn-sm btn-success toggle-category-activity"
            data-id="${category.category_id}"
            data-action="reactivate">

            <i class="fas fa-check-circle"></i>
            Reactivate
          </button>
        `;
        }
      }

      $("#approved-category-table tbody").append(`
      <tr>
        <td>${category.category_id}</td>
        <td>${category.name}</td>
        <td>${seller}</td>
        <td>${description}</td>
        <td>${statusBadge}</td>
        <td>${activityBadge}</td>
        <td>${approvedDate}</td>
        <td>
          <img src="${getCategoryImageUrl(category.image)}" width="50">
        </td>
        <td>
          ${approvedActionButtons}
        </td>
      </tr>
    `);
    });
  }

  // Render Rejected Categories
  function renderRejectedCategories(categories) {
    $("#rejected-category-table tbody").empty();

    if (!categories || categories.length === 0) {
      $("#rejected-category-table tbody").html(`
        <tr>
          <td
            colspan="9"
            class="text-center text-muted py-4">
            No Rejected Categories found.
          </td>
        </tr>
      `);

      return;
    }

    categories.forEach((category) => {
      const seller = getCategorySellerDisplayName(category);

      const statusBadge = getStatusBadge("rejected");

      const reason = category.approval_reason || "No reason provided.";

      let actions = `
        <button
          class="btn btn-sm btn-info view-category"
          data-id="${category.category_id}"
          data-toggle="modal"
          data-target="#categoryApprovedDetailsModal">

          <i class="fas fa-eye"></i> View
        </button>
      `;

      if (role === "seller") {
        actions += `
          <button
            class="btn btn-sm btn-warning resubmit-category-btn"
            data-id="${category.category_id}">

            <i class="fas fa-redo"></i>
            Edit & Resubmit
          </button>
        `;
      }

      $("#rejected-category-table tbody").append(`
        <tr>
          <td>${category.category_id}</td>
          <td>${category.name}</td>
          <td>${seller}</td>
          <td>${category.description || "N/A"}</td>
          <td>${statusBadge}</td>

          <td class="text-danger">
            ${reason}
          </td>

          <td>
            ${formatCategoryDate(category.created_at)}
          </td>

          <td>
            <img
              src="${getCategoryImageUrl(category.image)}"
              width="50">
          </td>

          <td>${actions}</td>
        </tr>
      `);
    });
  }

  // Utility function to render categories in the pending table
  function renderPendingCategories(categories) {
    $("#approval-category-table tbody").empty();

    if (!categories || categories.length === 0) {
      $("#approval-category-table tbody").html(
        `<tr><td colspan="8" class="text-center text-muted py-4">No Pending Categories found.</td></tr>`,
      );
      return;
    }

    categories.forEach((category) => {
      const seller = getCategorySellerDisplayName(category);
      const description = category.description || "N/A";
      const submittedDate = formatCategoryDate(category.created_at);
      const statusBadge = getStatusBadge(
        normalizeCategoryStatus(category.status || category.approval_status),
      );

      let actionButtons = `
        <button class="btn btn-sm btn-info view-category"
        data-id="${category.category_id}"
        data-toggle="modal"
        data-target="#categoryApprovalModal">
        <i class="fas fa-eye"></i> View
        </button>
      `;

      // Add Edit button for sellers
      if (role === "seller") {
        actionButtons += `
          <button class="btn btn-sm btn-primary editBtn"
          data-id="${category.category_id}"
          <i class="fas fa-edit"></i> Edit
          </button>
        `;
      }

      $("#approval-category-table tbody").append(`
      <tr>
        <td>${category.category_id}</td>
        <td>${category.name}</td>
        <td>${seller}</td>
        <td>${description}</td>
        <td>${statusBadge}</td>
        <td>${submittedDate}</td>
        <td>
          <img src="${getCategoryImageUrl(category.image)}" width="50">
        </td>
        <td>
          ${actionButtons}
        </td>
      </tr>
    `);
    });
  }

  // Main function to load categories and render tables
  function loadCategories() {
    $.ajax({
      url: `${ip}/api/category`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      success: function (res) {
        const categories = res.data ?? res;
        categoriesCache = Array.isArray(categories) ? categories : [];

        const approved = filterCategoriesByRole(categoriesCache, "approved");

        const pending = filterCategoriesByRole(categoriesCache, "pending");

        const rejected = filterCategoriesByRole(categoriesCache, "rejected");

        renderApprovedCategories(approved);
        renderPendingCategories(pending);
        renderRejectedCategories(rejected);
      },
    });
  }

  // Resubmit Category Button
  $(document).on("click", ".resubmit-category-btn", function (e) {
    e.preventDefault();

    const categoryId = $(this).data("id");

    Swal.fire({
      title: "Resubmit Category?",
      text: "Correct the rejected category and submit it again for administrator review.",
      icon: "info",
      showCancelButton: true,
      confirmButtonText: "Edit Category",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (!result.isConfirmed) return;

      openCategoryEditModal(categoryId, "resubmit");
    });
  });

  // View category details (Approved Modal)
  $(document).on("click", ".view-category", function (e) {
    e.preventDefault();
    const categoryId = $(this).data("id");
    const targetModal =
      $(this).data("target") || "#categoryApprovedDetailsModal";
    $(targetModal).attr("data-category-id", categoryId);

    const cachedCategory = categoriesCache.find(
      (category) =>
        String(category.category_id || category.id || "") ===
        String(categoryId || ""),
    );
    if (cachedCategory) {
      populateCategoryDetailsModal(cachedCategory, targetModal);
    }

    $.ajax({
      url: `${ip}/api/category/${categoryId}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      success: function (res) {
        const category = res.data ?? res;
        populateCategoryDetailsModal(category, targetModal);

        if (category) {
          const cacheIndex = categoriesCache.findIndex(
            (item) =>
              String(item.category_id || item.id || "") ===
              String(category.category_id || category.id || ""),
          );

          if (cacheIndex >= 0) {
            categoriesCache[cacheIndex] = category;
          } else {
            categoriesCache.push(category);
          }
        }
      },
      error: function (xhr) {
        Swal.fire(
          "Error",
          getAjaxErrorMessage(xhr, "Failed to fetch category details"),
          "error",
        );
      },
    });
  });

  // Reject Category Prompt
  function openRejectCategoryPrompt(categoryId) {
    Swal.fire({
      title: "Reject Category?",
      input: "textarea",
      inputLabel: "Reason for rejection",
      inputPlaceholder: "Enter reason for rejection...",

      inputAttributes: {
        "aria-label": "Enter reason for rejection",
      },

      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return "Please enter a reason for rejecting this category.";
        }
      },

      showCancelButton: true,
      confirmButtonText: "Reject",
      confirmButtonColor: "#d33",
    }).then((result) => {
      if (!result.isConfirmed) return;

      $.ajax({
        url: `${ip}/api/category/${categoryId}/reject`,
        method: "PUT",

        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },

        data: {
          reason: result.value.trim(),
        },

        success: function (res) {
          Swal.fire(
            "Rejected",
            res?.msg || "Category rejected successfully.",
            "success",
          ).then(() => location.reload());
        },

        error: function (xhr) {
          Swal.fire(
            "Error",
            getAjaxErrorMessage(xhr, "Rejection failed"),
            "error",
          );
        },
      });
    });
  }

  // Category Approval Modal Actions
  $("#approveCategoryBtn").on("click", function () {
    const categoryId = $("#categoryApprovalModal").attr("data-category-id");

    if (!categoryId) {
      Swal.fire("Error", "No category selected.", "error");
      return;
    }

    if (role !== "admin") {
      Swal.fire(
        "Unauthorized",
        "Only admins can approve categories.",
        "warning",
      );
      return;
    }

    $.ajax({
      url: `${ip}/api/category/${categoryId}/approve`,
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      success: function (res) {
        Swal.fire("Approved", res?.msg || "Category approved.", "success").then(
          () => location.reload(),
        );
      },
      error: function (xhr) {
        Swal.fire(
          "Error",
          getAjaxErrorMessage(xhr, "Approval failed"),
          "error",
        );
      },
    });
  });

  $("#rejectCategoryBtn").on("click", function () {
    const categoryId = $("#categoryApprovalModal").attr("data-category-id");

    if (!categoryId) {
      Swal.fire("Error", "No category selected.", "error");
      return;
    }

    if (role !== "admin") {
      Swal.fire(
        "Unauthorized",
        "Only admins can reject categories.",
        "warning",
      );
      return;
    }

    openRejectCategoryPrompt(categoryId);
  });

  $("#rejectApprovedCategoryBtn").on("click", function () {
    const categoryId = $("#categoryApprovedDetailsModal").attr(
      "data-category-id",
    );

    if (!categoryId) {
      Swal.fire("Error", "No category selected.", "error");
      return;
    }

    if (role !== "admin") {
      Swal.fire(
        "Unauthorized",
        "Only admins can reject categories.",
        "warning",
      );
      return;
    }

    openRejectCategoryPrompt(categoryId);
  });

  // Editing Category
  $(document).on("click", ".editBtn", function (e) {
    e.preventDefault();

    openCategoryEditModal($(this).data("id"), "edit");
  });

  // Reusable Edit / Request Edit / Resubmit
  function openCategoryEditModal(categoryId, mode = "edit") {
    $("#category_id").val(categoryId);

    $.ajax({
      url: `${ip}/api/category/${categoryId}`,
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },

      success: function (res) {
        const category = res.data ?? res;

        $("#editName").val(category.name || "");
        $("#editDescription").val(category.description || "");

        if (category.image) {
          $("#currentImagePreview")
            .attr("src", getCategoryImageUrl(category.image))
            .show();
        } else {
          $("#currentImagePreview").hide();
        }

        $("#editCategoryForm").data("edit-mode", mode);

        if (mode === "request-edit") {
          $("#editCategoryModal .modal-title").text("Request Category Update");

          $("#editCategory").html(
            '<i class="fas fa-paper-plane"></i> Submit for Review',
          );
        } else if (mode === "resubmit") {
          $("#editCategoryModal .modal-title").text(
            "Edit and Resubmit Category",
          );

          $("#editCategory").html(
            '<i class="fas fa-redo"></i> Resubmit for Review',
          );
        } else {
          $("#editCategoryModal .modal-title").text("Edit Pending Category");

          $("#editCategory").html('<i class="fas fa-save"></i> Update');
        }

        $("#editCategoryModal").modal("show");
      },

      error: function (xhr) {
        Swal.fire(
          "Error",
          getAjaxErrorMessage(xhr, "Failed to fetch category."),
          "error",
        );
      },
    });
  }

  // Add Request Edit
  $(document).on("click", ".request-category-edit-btn", function (e) {
    e.preventDefault();

    const categoryId = $(this).data("id");

    Swal.fire({
      title: "Request Category Edit?",

      html: `
        <p>
          Changes to an approved category must
          be reviewed again by an administrator.
        </p>

        <p class="mb-0">
          <strong>
            After submission, the category will
            return to Pending status.
          </strong>
        </p>
      `,

      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Continue Editing",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      openCategoryEditModal(categoryId, "request-edit");
    });
  });

  // Update Category
  $("#editCategoryForm").on("submit", function (e) {
    e.preventDefault();

    const fd = new FormData(this);

    const mode = $(this).data("edit-mode") || "edit";

    $("#editCategory").prop("disabled", true).text("Submitting...");

    $.ajax({
      url: `${ip}/api/category/${$("#category_id").val()}`,

      method: "POST",

      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },

      data: fd,
      processData: false,
      contentType: false,

      success: function (res) {
        $("#editCategoryModal").modal("hide");

        let title = "Category Updated";

        if (mode === "request-edit") {
          title = "Edit Request Submitted";
        }

        if (mode === "resubmit") {
          title = "Category Resubmitted";
        }

        Swal.fire({
          icon: "success",
          title: title,
          text: res?.msg || "Category submitted successfully.",
        }).then(() => {
          location.reload();
        });
      },

      error: function (xhr) {
        $("#editCategory").prop("disabled", false);

        Swal.fire(
          "Error",
          getAjaxErrorMessage(xhr, "Unable to update category."),
          "error",
        );
      },
    });
  });

  // Deactivate & Reactivate Javascript
  $(document).on("click", ".toggle-category-activity", function (e) {
    e.preventDefault();

    const categoryId = $(this).data("id");
    const action = $(this).data("action");

    const isDeactivating = action === "deactivate";

    Swal.fire({
      title: isDeactivating ? "Deactivate Category?" : "Reactivate Category?",

      text: isDeactivating
        ? "This category will no longer be available to customers. No category data will be deleted."
        : "This approved category will become available to customers again.",

      icon: isDeactivating ? "warning" : "question",

      showCancelButton: true,

      confirmButtonText: isDeactivating ? "Yes, Deactivate" : "Yes, Reactivate",

      cancelButtonText: "Cancel",
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      $.ajax({
        url: `${ip}/api/category/${categoryId}/${action}`,

        method: "PUT",

        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },

        success: function (res) {
          Swal.fire({
            icon: "success",

            title: isDeactivating
              ? "Category Deactivated"
              : "Category Reactivated",

            text: res?.msg || "Category availability updated successfully.",
          }).then(() => {
            location.reload();
          });
        },

        error: function (xhr) {
          Swal.fire(
            "Error",
            getAjaxErrorMessage(xhr, "Unable to update category availability."),
            "error",
          );
        },
      });
    });
  });

  // Delete Category
  $(document).on("click", ".deleteBtn", function (e) {
    e.preventDefault();
    const category_id = $(this).data("id");

    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        $.ajax({
          url: ip + "/api/category/" + category_id,
          method: "DELETE",
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json",
          },
          success: function (res) {
            Swal.fire("Deleted!", res.msg, "success").then(() => {
              location.reload(); // Reload the page to see changes
            });
          },
          error: function (xhr) {
            Swal.fire("Error!", xhr.responseText, "error");
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

  // Fetch cart count on page load for regular users.
  if (role === "user" && token) {
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
