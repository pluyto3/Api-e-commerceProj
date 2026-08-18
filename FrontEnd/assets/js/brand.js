/* ================================
   GLOBAL VARIABLES
================================ */
const ip = "https://api.hanzgo.me";
let token = null;
let usr = null;
let role = null;
let profileImage = null;
let currentUserId = null;
let brandsCache = [];
let sellerLookup = {};
const brandImageBaseUrl = "https://api.hanzgo.me/FrontEnd/assets/img/brand";

function getBrandImageUrl(imageName) {
  return imageName
    ? `${brandImageBaseUrl}/${imageName}`
    : "assets/img/back.jpg";
}

function normalizeBrandStatus(status) {
  return String(status || "pending").toLowerCase();
}

function getBrandStatusBadgeClass(status) {
  if (status === "approved") return;
  if (status === "rejected") return;
  if (status === "pending") return;
  return "badge-secondary";
}

function getStatusBadge(status) {
  const badgeClasses = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };

  const badgeClass = badgeClasses[status] || "badge-secondary";
  return `<span class="badge ${badgeClass}">${String(status).toUpperCase()}</span>`;
}

function isBrandActive(value) {
  return value === true || value === 1 || value === "1";
}

function getBrandActivityBadge(value) {
  if (isBrandActive(value)) {
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

function formatBrandDate(dateValue) {
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

function cacheSeller(brand) {
  const sellerId = brand?.seller?.user_id || brand?.seller_id;
  const sellerUsername =
    brand?.seller?.username || brand?.seller_username || brand?.seller_name;

  if (sellerId && sellerUsername) {
    sellerLookup[String(sellerId)] = sellerUsername;
  }
}

function getBrandSellerDisplayName(brand) {
  return (
    brand?.seller?.username ||
    brand?.seller?.fullname ||
    brand?.seller_username ||
    brand?.seller_name ||
    sellerLookup[String(brand?.seller_id || "")] ||
    "N/A"
  );
}

function getBrandSellerId(brand) {
  return (
    brand?.seller?.user_id || brand?.seller?.id || brand?.seller_id || null
  );
}

function getBrandSellerUsername(brand) {
  const sellerId = getBrandSellerId(brand);
  return (
    brand?.seller?.username ||
    brand?.seller_username ||
    sellerLookup[String(sellerId || "")] ||
    brand?.seller_name ||
    null
  );
}

function isBrandOwnedByCurrentSeller(brand) {
  if (role !== "seller") return true;
  if (!usr) return false;

  const sellerId = getBrandSellerId(brand);
  if (currentUserId && sellerId) {
    return String(sellerId) === String(currentUserId);
  }

  const sellerUsername = getBrandSellerUsername(brand);
  if (!sellerUsername) return false;
  return sellerUsername.toLowerCase() === usr.toLowerCase();
}

function filterBrandsForRole(brands) {
  if (role !== "seller") return brands;
  return brands.filter(isBrandOwnedByCurrentSeller);
}

function loadSellerLookup() {
  $.ajax({
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
          sellerLookup[String(seller.user_id)] = seller.username;
        }
      });
    },
    error: function (xhr) {
      console.error("Failed to load seller lookup:", xhr?.responseText || xhr);
    },
  });
}

function populateBrandApprovedDetailsModal(
  brand,
  modalSelector = "#brandApprovedDetailsModal",
) {
  if (!brand) return;
  const $modal = $(modalSelector);
  if (!$modal.length) return;

  const status = normalizeBrandStatus(brand.status || brand.approval_status);
  cacheSeller(brand);
  const seller = getBrandSellerDisplayName(brand);
  const description = brand.description || "N/A";
  const rejectionReason = brand.approval_reason || "";
  const submittedDate =
    brand.created_at || brand.submitted_at || brand.updated_at || null;
  const imageUrl = getBrandImageUrl(brand.image);
  const brandId = brand.brand_id || brand.id || "";

  $modal.attr("data-brand-id", brandId);
  $modal.attr("data-brand-status", status);

  $modal.find(".brand-detail-id").text(brandId || "N/A");
  $modal.find(".brand-detail-name").text(brand.name || "N/A");
  $modal.find(".brand-detail-seller").text(seller);
  $modal.find(".brand-detail-description").text(description);
  const $reasonWrap = $modal.find(".brand-detail-reason-wrap");
  const $reasonText = $modal.find(".brand-detail-reason");

  if (status === "rejected") {
    $reasonText.text(rejectionReason || "No rejection reason was provided.");
    $reasonWrap.show();
  } else {
    $reasonText.text("");
    $reasonWrap.hide();
  }

  if (modalSelector === "#brandApprovedDetailsModal") {
    const title =
      status === "rejected"
        ? "Rejected Brand Details"
        : status === "approved"
          ? "Approved Brand Details"
          : "Brand Details";

    $modal.find(".modal-title").text(title);
  }

  $modal.find(".brand-detail-date").text(formatBrandDate(submittedDate));
  $modal
    .find(".brand-detail-status")
    .removeClass("badge-success badge-danger badge-warning badge-secondary")
    .addClass(getBrandStatusBadgeClass(status))
    .text(status.toUpperCase());

  $modal
    .find(".brand-detail-image")
    .off("error")
    .attr("src", imageUrl)
    .on("error", function () {
      $(this).off("error").attr("src", "assets/img/back.jpg");
    });

  if (modalSelector === "#brandApprovalModal") {
    const isPending = status === "pending";
    const isAdmin = role === "admin";
    const canModerate = isAdmin && isPending;

    $modal
      .find("#approveBrandBtn, #rejectBrandBtn")
      .prop("disabled", !canModerate)
      .toggle(canModerate);
    $modal.find("#cancelBrandBtn").text(canModerate ? "Cancel" : "Close");
  }

  if (modalSelector === "#brandApprovedDetailsModal") {
    const canRejectApproved = role === "admin" && status === "approved";

    $modal
      .find("#rejectApprovedBrandBtn")
      .prop("disabled", !canRejectApproved)
      .toggle(canRejectApproved);
    $modal
      .find("#closeApprovedBrandBtn")
      .text(canRejectApproved ? "Cancel" : "Close");
  }
}

// =======================================
// User Session Handling
// =======================================
function load_user() {
  usr = $.cookie("username");
  token = $.cookie("token");
  role = $.cookie("role");
  profileImage = $.cookie("profileImage");

  // DOM elements
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
  const $addBrandSection = $(".add_brand");
  const $sidebarAccounts = $("#sidebarAccounts");

  // No session → show login/register
  if (!usr || !token) {
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
    $addBrandSection.hide();
    $sidebarAccounts.hide();
    return;
  }

  // Session exists → update UI
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

  // Role-based access
  if (role === "admin" || role === "seller") {
    $adminDashboard.show();
  } else {
    $adminDashboard.hide();
  }

  // Show "Create Brand" button only to sellers
  if (role === "seller") {
    $addBrandSection.show();
    $sidebarAccounts.hide();
  } else {
    $addBrandSection.hide();
    $sidebarAccounts.show();
  }
}

// =======================================
// Sidebar Toggle
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
// Document Ready
// =======================================
$(document).ready(function () {
  // Initialize user session
  load_user();
  loadSellerLookup();
  setupSidebarToggle();

  // -------------------------------
  // Sidebar Toggle
  // -------------------------------
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

  // -------------------------------
  // Global AJAX Loading Animation
  // -------------------------------
  $(document)
    .ajaxStart(() => $("#wait").show())
    .ajaxComplete(() => $("#wait").hide());

  // -------------------------------
  // Load Navbar Profile Image
  // -------------------------------
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
        const $navbarProfileImage = $("#navbarProfileImage");
        const $defaultProfileIcon = $("#defaultProfileIcon");
        currentUserId = response?.user_id || response?.id || null;

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

  // =======================================
  // CRUD: BRAND MANAGEMENT
  // =======================================

  // -------------------------------
  // Create Brand
  // -------------------------------
  $("#brandForm").on("submit", function (e) {
    e.preventDefault();

    const fd = new FormData(this);
    $("#createBrand").text("Adding...");

    $.ajax({
      url: `${ip}/api/brands`,
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
          title: "Brand Added Successfully",
          showConfirmButton: false,
        }).then(() => {
          $("#createBrand").text("Add");
          $("#brandForm")[0].reset();
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

  // -------------------------------
  // Display Approved Brands (Table)
  // -------------------------------
  $.ajax({
    url: `${ip}/api/brands`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (res) {
      const brands = res.data ?? res;
      brandsCache = Array.isArray(brands) ? brands : [];
      brandsCache.forEach(cacheSeller);

      const approvedBrands = filterBrandsForRole(brandsCache).filter(
        (brand) =>
          normalizeBrandStatus(brand.status || brand.approval_status) ===
          "approved",
      );

      // Initialize DataTable
      if ($.fn.DataTable.isDataTable("#approved-brand-table")) {
        $("#approved-brand-table").DataTable().destroy();
      }
      $("#approved-brand-table tbody").empty();

      if (!approvedBrands || approvedBrands.length === 0) {
        $("#approved-brand-table tbody").html(
          `<tr><td colspan="9" class="text-center text-muted py-4">No Approved Brands found.</td></tr>`,
        );
      } else {
        approvedBrands.forEach((brand) => {
          const status = normalizeBrandStatus(
            brand.status || brand.approval_status,
          );
          const statusBadge = getStatusBadge(status);
          const active = isBrandActive(brand.is_active);
          const activityBadge = getBrandActivityBadge(brand.is_active);
          const seller = getBrandSellerDisplayName(brand);
          const description =
            brand.description || brand.approval_reason || "N/A";
          const approvedDate = formatBrandDate(
            brand.approved_at || brand.updated_at || brand.created_at,
          );

          let approvedActionButtons = `
            <button
              class="btn btn-sm btn-info view-brand"
              data-id="${brand.brand_id}"
              data-toggle="modal"
              data-target="#brandApprovedDetailsModal">
              <i class="fas fa-eye"></i> View
            </button>
          `;

          if (role === "seller") {
            // Request Edit is always available
            // while the brand remains approved.
            approvedActionButtons += `
    <button
      class="btn btn-sm btn-warning request-edit-btn"
      data-id="${brand.brand_id}">
      <i class="fas fa-edit"></i> Request Edit
    </button>
  `;

            // Active brand → Deactivate
            if (active) {
              approvedActionButtons += `
                <button
                  class="btn btn-sm btn-danger toggle-brand-activity"
                  data-id="${brand.brand_id}"
                  data-action="deactivate">

                  <i class="fas fa-ban"></i>
                  Deactivate
                </button>
              `;

              // Deactivated brand → Reactivate
            } else {
              approvedActionButtons += `
                <button
                  class="btn btn-sm btn-success toggle-brand-activity"
                  data-id="${brand.brand_id}"
                  data-action="reactivate">

                  <i class="fas fa-check-circle"></i>
                  Reactivate
                </button>
              `;
            }
          }

          $("#approved-brand-table tbody").append(`
            <tr>
              <td>${brand.brand_id || "N/A"}</td>
              <td>${brand.name || "N/A"}</td>
              <td>${seller}</td>
              <td>${description}</td>
              <td>${statusBadge}</td>
              <td>${activityBadge}</td>
              <td>${approvedDate}</td>
              <td>
                <img src="${getBrandImageUrl(brand.image)}" 
                     width="50" height="50">
              </td>
              <td>
                ${approvedActionButtons}
              </td>
            </tr>
          `);
        });

        $("#approved-brand-table").DataTable({
          pageLength: 10,
          lengthChange: false,
          searching: true,
          responsive: true,
          columnDefs: [
            { orderable: false, targets: -1, className: "text-center" },
          ],
        });
      }
    },
    error: function (xhr) {
      console.error("Error fetching brands:", xhr);
      Swal.fire(
        "Error",
        getAjaxErrorMessage(xhr, "Failed to load brands"),
        "error",
      );
    },
  });

  // -------------------------------
  // Display Approval Brands (Table)
  // -------------------------------
  $.ajax({
    url: `${ip}/api/brands`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (res) {
      const brands = res.data ?? res;
      brandsCache = Array.isArray(brands) ? brands : [];
      brandsCache.forEach(cacheSeller);

      const pendingBrands = filterBrandsForRole(brandsCache).filter(
        (brand) =>
          normalizeBrandStatus(brand.status || brand.approval_status) ===
          "pending",
      );

      // Initialize DataTable
      if ($.fn.DataTable.isDataTable("#approval-brand-table")) {
        $("#approval-brand-table").DataTable().destroy();
      }
      $("#approval-brand-table tbody").empty();

      if (!pendingBrands || pendingBrands.length === 0) {
        $("#approval-brand-table tbody").html(
          `<tr><td colspan="8" class="text-center text-muted py-4">No Pending Brands found.</td></tr>`,
        );
      } else {
        pendingBrands.forEach((brand) => {
          const status = normalizeBrandStatus(
            brand.status || brand.approval_status,
          );
          const statusBadge = getStatusBadge(status);
          const seller = getBrandSellerDisplayName(brand);
          const description =
            brand.description || brand.approval_reason || "N/A";
          const submittedDate = formatBrandDate(
            brand.created_at || brand.submitted_at || brand.updated_at,
          );

          let actionButtons = `
            <button class="btn btn-sm btn-info view-brand" data-id="${brand.brand_id}" data-toggle="modal" data-target="#brandApprovalModal">
              <i class="fas fa-eye"></i> View
            </button>
          `;

          // Add Edit button for sellers
          if (role === "seller") {
            actionButtons += `
              <button class="btn btn-sm btn-primary editBtn" data-id="${brand.brand_id}">
                <i class="fas fa-edit"></i> Edit
              </button>
            `;
          }

          $("#approval-brand-table tbody").append(`
            <tr>
              <td>${brand.brand_id || "N/A"}</td>
              <td>${brand.name || "N/A"}</td>
              <td>${seller}</td>
              <td>${description}</td>
              <td>${statusBadge}</td>
              <td>${submittedDate}</td>
              <td>
                <img src="${getBrandImageUrl(brand.image)}" 
                     width="50" height="50">
              </td>
              <td>
                ${actionButtons}
              </td>
            </tr>
          `);
        });

        $("#approval-brand-table").DataTable({
          pageLength: 10,
          lengthChange: false,
          searching: true,
          responsive: true,
          columnDefs: [
            { orderable: false, targets: -1, className: "text-center" },
          ],
        });
      }
    },
    error: function (xhr) {
      console.error("Error fetching brands:", xhr);
      Swal.fire(
        "Error",
        getAjaxErrorMessage(xhr, "Failed to load brands"),
        "error",
      );
    },
  });

  // =======================================
  // Display Rejected Brands
  // =======================================
  $.ajax({
    url: `${ip}/api/brands`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },

    success: function (res) {
      const brands = res.data ?? res;
      const allBrands = Array.isArray(brands) ? brands : [];

      allBrands.forEach(cacheSeller);

      const rejectedBrands = filterBrandsForRole(allBrands).filter(
        (brand) =>
          normalizeBrandStatus(brand.status || brand.approval_status) ===
          "rejected",
      );

      if ($.fn.DataTable.isDataTable("#rejected-brand-table")) {
        $("#rejected-brand-table").DataTable().destroy();
      }

      $("#rejected-brand-table tbody").empty();

      if (rejectedBrands.length === 0) {
        $("#rejected-brand-table tbody").html(`
        <tr>
          <td
            colspan="9"
            class="text-center text-muted py-4">
            No Rejected Brands found.
          </td>
        </tr>
      `);

        return;
      }

      rejectedBrands.forEach((brand) => {
        const status = normalizeBrandStatus(
          brand.status || brand.approval_status,
        );

        const seller = getBrandSellerDisplayName(brand);

        const statusBadge = getStatusBadge(status);

        const description = brand.description || "N/A";

        const rejectionReason = brand.approval_reason || "No reason provided.";

        const submittedDate = formatBrandDate(
          brand.created_at || brand.submitted_at || brand.updated_at,
        );

        let actionButtons = `
        <button
          class="btn btn-sm btn-info view-brand"
          data-id="${brand.brand_id}"
          data-toggle="modal"
          data-target="#brandApprovedDetailsModal">

          <i class="fas fa-eye"></i>
          View
        </button>
      `;

        if (role === "seller") {
          actionButtons += `
          <button
            class="btn btn-sm btn-warning resubmit-brand-btn"
            data-id="${brand.brand_id}">

            <i class="fas fa-redo"></i>
            Edit & Resubmit
          </button>
        `;
        }

        $("#rejected-brand-table tbody").append(`
        <tr>
          <td>${brand.brand_id || "N/A"}</td>

          <td>${brand.name || "N/A"}</td>

          <td>${seller}</td>

          <td>${description}</td>

          <td>${statusBadge}</td>

          <td>
            <span class="text-danger">
              ${rejectionReason}
            </span>
          </td>

          <td>${submittedDate}</td>

          <td>
            <img
              src="${getBrandImageUrl(brand.image)}"
              width="50"
              height="50">
          </td>

          <td>
            ${actionButtons}
          </td>
        </tr>
      `);
      });

      $("#rejected-brand-table").DataTable({
        pageLength: 10,
        lengthChange: false,
        searching: true,
        responsive: true,
        columnDefs: [
          {
            orderable: false,
            targets: -1,
            className: "text-center",
          },
        ],
      });
    },

    error: function (xhr) {
      console.error("Error fetching rejected brands:", xhr);
    },
  });

  // -------------------------------
  // View Brand (Approved Details Modal)
  // -------------------------------
  $(document).on("click", ".view-brand", function (e) {
    e.preventDefault();
    const brandId = $(this).data("id");
    const targetModal = $(this).data("target") || "#brandApprovedDetailsModal";
    $(targetModal).attr("data-brand-id", brandId);

    const cachedBrand = brandsCache.find(
      (brand) =>
        String(brand.brand_id || brand.id || "") === String(brandId || ""),
    );
    if (cachedBrand) {
      populateBrandApprovedDetailsModal(cachedBrand, targetModal);
    }

    $.ajax({
      url: `${ip}/api/brands/${brandId}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      success: function (res) {
        const brand = res.data ?? res;
        populateBrandApprovedDetailsModal(brand, targetModal);

        if (brand) {
          const cacheIndex = brandsCache.findIndex(
            (item) =>
              String(item.brand_id || item.id || "") ===
              String(brand.brand_id || brand.id || ""),
          );

          if (cacheIndex >= 0) {
            brandsCache[cacheIndex] = brand;
          } else {
            brandsCache.push(brand);
          }
        }
      },
      error: function () {
        Swal.fire("Error", "Failed to fetch brand details", "error");
      },
    });
  });

  // -------------------------------
  // Reject Brand Prompt
  // -------------------------------
  function openRejectBrandPrompt(brandId) {
    const showRejectAlert = () => {
      Swal.fire({
        title: "Reject Brand?",
        input: "textarea",
        inputLabel: "Reason for rejection",
        inputPlaceholder: "Enter the reason why this brand is rejected...",
        inputAttributes: {
          "aria-label": "Enter reason for rejection",
        },
        showCancelButton: true,
        confirmButtonText: "Reject",
        confirmButtonColor: "#d33",
        focusConfirm: false,
        didOpen: () => {
          const input = Swal.getInput();
          if (input) input.focus();
        },
        inputValidator: (value) => {
          if (!value || !value.trim()) {
            return "Please enter a reason for rejecting this brand.";
          }
        },
      }).then((result) => {
        if (!result.isConfirmed) return;

        $.ajax({
          url: `${ip}/api/brands/${brandId}/reject`,
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
              res?.msg || "Brand rejected successfully.",
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
    };

    // If a Bootstrap modal is open, close it first
    const $openModal = $(".modal.show");

    if ($openModal.length) {
      $openModal.one("hidden.bs.modal", function () {
        showRejectAlert();
      });

      $openModal.modal("hide");
    } else {
      showRejectAlert();
    }
  }

  // -------------------------------
  // Brand Approval Modal Actions
  // -------------------------------
  $("#approveBrandBtn").on("click", function () {
    const brandId = $("#brandApprovalModal").attr("data-brand-id");

    if (!brandId) {
      Swal.fire("Error", "No brand selected.", "error");
      return;
    }

    if (role !== "admin") {
      Swal.fire("Unauthorized", "Only admins can approve brands.", "warning");
      return;
    }

    $.ajax({
      url: `${ip}/api/brands/${brandId}/approve`,
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      success: function (res) {
        Swal.fire("Approved", res?.msg || "Brand approved.", "success").then(
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

  $("#rejectBrandBtn").on("click", function () {
    const brandId = $("#brandApprovalModal").attr("data-brand-id");

    if (!brandId) {
      Swal.fire("Error", "No brand selected.", "error");
      return;
    }

    if (role !== "admin") {
      Swal.fire("Unauthorized", "Only admins can reject brands.", "warning");
      return;
    }

    openRejectBrandPrompt(brandId);
  });

  $("#rejectApprovedBrandBtn").on("click", function () {
    const brandId = $("#brandApprovedDetailsModal").attr("data-brand-id");

    if (!brandId) {
      Swal.fire("Error", "No brand selected.", "error");
      return;
    }

    if (role !== "admin") {
      Swal.fire("Unauthorized", "Only admins can reject brands.", "warning");
      return;
    }

    openRejectBrandPrompt(brandId);
  });

  // =======================================
  // Open Brand Edit Modal
  // =======================================
  function openBrandEditModal(brandId, mode = "edit") {
    $("#brand_id").val(brandId);

    $.ajax({
      url: `${ip}/api/brands/${brandId}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },

      success: function (res) {
        const brand = res.data ?? res;

        $("#editName").val(brand.name || "");
        $("#editDescription").val(brand.description || "");

        if (brand.image) {
          $("#currentImagePreview")
            .attr("src", getBrandImageUrl(brand.image))
            .show();
        } else {
          $("#currentImagePreview").hide();
        }

        // Remember why the edit modal was opened.
        $("#editBrandForm").data("edit-mode", mode);

        if (mode === "request-edit") {
          $("#editBrandModal .modal-title").text("Request Brand Update");

          $("#editBrand").html(
            '<i class="fas fa-paper-plane"></i> Submit for Review',
          );
        } else if (mode === "resubmit") {
          $("#editBrandModal .modal-title").text("Edit and Resubmit Brand");

          $("#editBrand").html(
            '<i class="fas fa-redo"></i> Resubmit for Review',
          );
        } else {
          $("#editBrandModal .modal-title").text("Edit Pending Brand");

          $("#editBrand").html('<i class="fas fa-save"></i> Update');
        }

        $("#editBrandModal").modal("show");
      },

      error: function (xhr) {
        Swal.fire(
          "Error",
          getAjaxErrorMessage(xhr, "Failed to fetch brand details"),
          "error",
        );
      },
    });
  }

  // =======================================
  // Edit Pending Brand
  // =======================================
  $(document).on("click", ".editBtn", function (e) {
    e.preventDefault();

    const brandId = $(this).data("id");

    openBrandEditModal(brandId, "edit");
  });

  // =======================================
  // Request Edit for Approved Brand
  // =======================================
  $(document).on("click", ".request-edit-btn", function (e) {
    e.preventDefault();

    const brandId = $(this).data("id");

    Swal.fire({
      title: "Request Brand Edit?",
      html: `
      <p>
        Changes to an approved brand must be reviewed again
        by an administrator.
      </p>

      <p class="mb-0">
        <strong>After you submit the changes, the brand will
        return to Pending status until it is approved again.</strong>
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

      openBrandEditModal(brandId, "request-edit");
    });
  });

  // =======================================
  // Edit and Resubmit Rejected Brand
  // =======================================
  $(document).on("click", ".resubmit-brand-btn", function (e) {
    e.preventDefault();

    const brandId = $(this).data("id");

    Swal.fire({
      title: "Resubmit Brand?",
      html: `
        <p>
          You can correct the information that caused
          the brand to be rejected.
        </p>

        <p class="mb-0">
          After submitting your changes, the brand will
          return to <strong>Pending</strong> status for
          administrator review.
        </p>
      `,
      icon: "info",
      showCancelButton: true,
      confirmButtonText: "Edit Brand",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      openBrandEditModal(brandId, "resubmit");
    });
  });

  // -------------------------------
  // Update Brand
  // -------------------------------
  $("#editBrandForm").on("submit", function (e) {
    e.preventDefault();

    const fd = new FormData(this);
    const mode = $(this).data("edit-mode") || "edit";

    $("#editBrand").prop("disabled", true).text("Submitting...");

    $.ajax({
      url: `${ip}/api/brands/${$("#brand_id").val()}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      data: fd,
      processData: false,
      contentType: false,

      success: function (res) {
        $("#editBrandModal").modal("hide");

        let title = "Brand Updated";

        if (mode === "request-edit") {
          title = "Edit Request Submitted";
        }

        if (mode === "resubmit") {
          title = "Brand Resubmitted";
        }

        Swal.fire({
          icon: "success",
          title: title,
          text: res?.msg || "Brand submitted successfully.",
        }).then(() => {
          location.reload();
        });
      },

      error: function (xhr) {
        $("#editBrand").prop("disabled", false);

        Swal.fire(
          "Error",
          getAjaxErrorMessage(xhr, "Unable to update brand."),
          "error",
        );
      },
    });
  });

  // -------------------------------
  // Delete Brand
  // -------------------------------
  $(document).on("click", ".deleteBtn", function (e) {
    e.preventDefault();
    const brand_id = $(this).data("id");

    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        $.ajax({
          url: `${ip}/api/brands/${brand_id}`,
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          success: function (res) {
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

  // =======================================
  // Deactivate / Reactivate Brand
  // =======================================
  $(document).on("click", ".toggle-brand-activity", function (e) {
    e.preventDefault();

    const brandId = $(this).data("id");
    const action = $(this).data("action");

    const isDeactivating = action === "deactivate";

    Swal.fire({
      title: isDeactivating ? "Deactivate Brand?" : "Reactivate Brand?",

      text: isDeactivating
        ? "This brand will no longer be visible to customers. No brand data will be deleted."
        : "This approved brand will become available to customers again.",

      icon: isDeactivating ? "warning" : "question",

      showCancelButton: true,

      confirmButtonText: isDeactivating ? "Yes, Deactivate" : "Yes, Reactivate",

      cancelButtonText: "Cancel",
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      $.ajax({
        url: `${ip}/api/brands/${brandId}/${action}`,
        method: "PUT",

        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },

        success: function (res) {
          Swal.fire({
            icon: "success",

            title: isDeactivating ? "Brand Deactivated" : "Brand Reactivated",

            text: res?.msg || "Brand availability updated successfully.",
          }).then(() => {
            location.reload();
          });
        },

        error: function (xhr) {
          Swal.fire(
            "Error",
            getAjaxErrorMessage(xhr, "Unable to update brand availability."),
            "error",
          );
        },
      });
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
