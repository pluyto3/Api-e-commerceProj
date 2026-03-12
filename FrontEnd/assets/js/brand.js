/* ================================
   GLOBAL VARIABLES
================================ */
const ip = "http://localhost/e-commerce/BackEnd/public";
let token = null;
let usr = null;
let role = null;
let profileImage = null;
let currentUserId = null;
let brandsCache = [];
let sellerLookup = {};
const brandImageBaseUrl =
  "http://localhost/e-commerce/BackEnd/public/FrontEnd/assets/img/brand";

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
  const description = brand.description || brand.approval_reason || "N/A";
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
// Document Ready
// =======================================
$(document).ready(function () {
  // Initialize user session
  load_user();
  loadSellerLookup();

  // -------------------------------
  // Sidebar Toggle
  // -------------------------------
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

      approvedBrands.forEach((brand) => {
        const status = normalizeBrandStatus(
          brand.status || brand.approval_status,
        );
        const seller = getBrandSellerDisplayName(brand);
        const description = brand.description || brand.approval_reason || "N/A";
        const approvedDate = formatBrandDate(
          brand.approved_at || brand.updated_at || brand.created_at,
        );

        $("#approved-brand-table tbody").append(`
          <tr>
            <td>${brand.brand_id || "N/A"}</td>
            <td>${brand.name || "N/A"}</td>
            <td>${seller}</td>
            <td>${description}</td>
            <td class="text-capitalize">${status}</td>
            <td>${approvedDate}</td>
            <td>
              <img src="${getBrandImageUrl(brand.image)}" 
                   width="50" height="50">
            </td>
            <td>
              <button class="btn btn-sm btn-info view-brand" data-id="${brand.brand_id}" data-toggle="modal" data-target="#brandApprovedDetailsModal">
                <i class="fas fa-eye"></i> View
              </button>
            </td>
          </tr>
        `);
      });

      // Initialize DataTable
      if ($.fn.DataTable.isDataTable("#approved-brand-table")) {
        $("#approved-brand-table").DataTable().destroy();
      }

      $("#approved-brand-table").DataTable({
        pageLength: 10,
        lengthChange: false,
        searching: true,
        responsive: true,
        columnDefs: [
          { orderable: false, targets: -1, className: "text-center" },
        ],
      });
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

      pendingBrands.forEach((brand) => {
        const status = normalizeBrandStatus(
          brand.status || brand.approval_status,
        );
        const seller = getBrandSellerDisplayName(brand);
        const description = brand.description || brand.approval_reason || "N/A";
        const submittedDate = formatBrandDate(
          brand.created_at || brand.submitted_at || brand.updated_at,
        );

        $("#approval-brand-table tbody").append(`
          <tr>
            <td>${brand.brand_id || "N/A"}</td>
            <td>${brand.name || "N/A"}</td>
            <td>${seller}</td>
            <td>${description}</td>
            <td class="text-capitalize">${status}</td>
            <td>${submittedDate}</td>
            <td>
              <img src="${getBrandImageUrl(brand.image)}" 
                   width="50" height="50">
            </td>
            <td>
              <button class="btn btn-sm btn-info view-brand" data-id="${brand.brand_id}" data-toggle="modal" data-target="#brandApprovalModal">
                <i class="fas fa-eye"></i> View
              </button>
            </td>
          </tr>
        `);
      });

      // Initialize DataTable
      if ($.fn.DataTable.isDataTable("#approval-brand-table")) {
        $("#approval-brand-table").DataTable().destroy();
      }

      $("#approval-brand-table").DataTable({
        pageLength: 10,
        lengthChange: false,
        searching: true,
        responsive: true,
        columnDefs: [
          { orderable: false, targets: -1, className: "text-center" },
        ],
      });
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

  function openRejectBrandPrompt(brandId) {
    Swal.fire({
      title: "Reject Brand?",
      input: "textarea",
      inputLabel: "Reason (optional)",
      inputPlaceholder: "Enter reason for rejection...",
      inputAttributes: {
        "aria-label": "Enter reason for rejection",
      },
      showCancelButton: true,
      confirmButtonText: "Reject",
      confirmButtonColor: "#d33",
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
          reason: result.value || "",
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

  // -------------------------------
  // Edit Brand (Fetch Details)
  // -------------------------------
  $(document).on("click", ".editBtn", function (e) {
    e.preventDefault();
    const brand_id = $(this).data("id");
    $("#brand_id").val(brand_id);

    $.ajax({
      url: `${ip}/api/brands/${brand_id}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      success: function (res) {
        $("#editName").val(res.name);

        const imageUrl = res.image
          ? `http://localhost/e-commerce/BackEnd/public/FrontEnd/assets/img/brand/${res.image}`
          : null;

        if (imageUrl) {
          $("#currentImagePreview").attr("src", imageUrl).show();
        } else {
          $("#currentImagePreview").hide();
        }
      },
      error: function () {
        Swal.fire("Error", "Failed to fetch brand details", "error");
      },
    });
  });

  // -------------------------------
  // Update Brand
  // -------------------------------
  $("#editBrandForm").on("submit", function (e) {
    e.preventDefault();

    const fd = new FormData(this);
    fd.append("_method", "PUT");
    $("#editBrand").text("Updating...");

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
      success: function () {
        Swal.fire("Updated!", "Brand updated successfully!", "success").then(
          () => location.reload(),
        );
      },
      error: function (xhr) {
        Swal.fire("Error", xhr.responseText, "error");
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
