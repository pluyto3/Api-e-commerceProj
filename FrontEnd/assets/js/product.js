/* ================================
   ADMIN PRODUCT APPROVAL SYSTEM
================================ */

// const ip = "https://api.hanzgo.me";

if (!window.APP_CONFIG?.API_BASE_URL) {
  throw new Error("APP_CONFIG is missing. Load config.js before checkout.js.");
}

const ip = window.APP_CONFIG.API_BASE_URL;

let token = $.cookie("token");
let usr = $.cookie("username");
let role = ($.cookie("role") || "").toLowerCase();
let currentProductId = null;
let allProducts = [];
let approvedOrdersCache = [];

console.log("adminProductApproval.js loaded", { token, usr, role, ip });

function canUseCart() {
  return role === "user" || role === "seller";
}

function updateCartCount(count) {
  $("#cart-count").text(count || 0);
}

function loadCartCount() {
  if (!token || role !== "user") {
    updateCartCount(0);
    return;
  }

  $.ajax({
    url: `${ip}/api/cart`,
    method: "GET",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
    },
    success: function (response) {
      console.log("Cart items fetched successfully:", response);
      updateCartCount(response.count || 0);
    },
    error: function (xhr) {
      console.error("Error fetching cart count:", xhr.responseText);
      updateCartCount(0);
    },
  });
}

// =======================================
// User Session Handling
// =======================================
function load_user() {
  token = $.cookie("token");
  usr = $.cookie("username");
  role = ($.cookie("role") || "").toLowerCase();

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
  const $addCategorySection = $(".add_product");
  const $addProductSection = $("#addProductSection");
  const $sidebarAccounts = $("#sidebarAccounts");

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
    $addCategorySection.hide();
    $addProductSection.addClass("d-none");
    $sidebarAccounts.hide();
    return;
  }

  $displayUsername.html(`<b>${usr}</b>`);
  $login.hide();
  $register.hide();
  $logout.show();

  // Match dashboard behavior: show cart for user/seller, hide for admin
  if (canUseCart()) {
    $cartCount.show();
    $cartNav.show();
    $cartNavMobile.show();
  } else {
    $cartCount.hide();
    $cartNav.hide();
    $cartNavMobile.hide();
  }

  if (["admin", "seller"].includes(role)) {
    $adminDashboard.show();
  } else {
    $adminDashboard.hide();
  }

  if (role === "seller") {
    $addCategorySection.show();
    $addProductSection.removeClass("d-none");
    $sidebarAccounts.hide();
  } else {
    $addCategorySection.hide();
    $addProductSection.addClass("d-none");
    $sidebarAccounts.show();
  }
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
// Load Products for Approval
// =======================================
function loadProductsForApproval() {
  $.ajax({
    url: `${ip}/api/products`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (res) {
      console.log("All Products:", res);
      allProducts = res.data || res || [];

      // ======================================
      // FILTER PRODUCTS IF SELLER IS LOGGED IN
      // ======================================
      let filteredProducts = allProducts;

      if (role === "seller") {
        filteredProducts = allProducts.filter((p) => {
          return p.seller?.username === usr;
        });
      }

      // ======================================
      // SEPARATE PRODUCTS BY APPROVAL STATUS
      // ======================================
      const pendingProducts = filteredProducts.filter((p) => {
        return (p.approval_status || "pending").toLowerCase() === "pending";
      });

      const approvedProducts = filteredProducts.filter((p) => {
        return (p.approval_status || "").toLowerCase() === "approved";
      });

      const rejectedProducts = filteredProducts.filter((p) => {
        return (p.approval_status || "").toLowerCase() === "rejected";
      });

      // ======================================
      // DISPLAY TABLES
      // ======================================
      displayProductsTable(pendingProducts, "all");

      // Keep using your EXISTING approved function for now
      displayApprovedOrders(approvedProducts);

      // Keep using your EXISTING rejected function for now
      displayRejectedProducts(rejectedProducts);
    },
    error: function (xhr) {
      console.error("Error loading products:", xhr.responseText);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to load products.",
      });
      // show message in table so admin sees immediate feedback
      const tbody = $("#product-table tbody");
      tbody.html(
        `<tr><td colspan="11" class="text-center text-danger py-4">Failed to load products. Check console for details.</td></tr>`,
      );
    },
  });
}

// =======================================
// Display Products in Table
// =======================================
function displayProductsTable(products, statusFilter = "all") {
  const tbody = $("#product-table tbody");
  tbody.empty();

  let filteredProducts = products;

  if (statusFilter !== "all") {
    filteredProducts = products.filter((p) => {
      const status = p.approval_status || "pending";
      return status.toLowerCase() === statusFilter.toLowerCase();
    });
  }

  if (filteredProducts.length === 0) {
    tbody.html(
      `<tr><td colspan="11" class="text-center text-muted py-4">No Pending Products found.</td></tr>`,
    );
    return;
  }

  filteredProducts.forEach((product, index) => {
    const status = product.approval_status || "pending";
    const statusBadge = getStatusBadge(status);

    let actionButtons = "";

    // Seller Actions: Edit
    if (role === "seller") {
      actionButtons += `
        <button class="btn btn-sm btn-primary edit-product" data-id="${product.product_id}" title="Edit" data-toggle="modal" data-target="#editProductModal">
          <i class="fas fa-edit"></i> Edit
        </button>`;
    }

    const row = `
      <tr>
        <td>${product.product_id || index + 1}</td>
        <td>${product.product_name || "N/A"}</td>
        <td>${product.seller?.username || "N/A"}</td>
        <td>${product.category || "N/A"}</td>
        <td>${product.brand || "N/A"}</td>
        <td>₱${parseFloat(product.product_price).toFixed(2)}</td>
        <td>${product.stock_quantity || 0}</td>
        <td>
          <img src="${buildImageCandidates(product.image)[0]}" 
               alt="Product" 
               style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"
               onerror="this.onerror=function(){this.onerror=null;this.src='${buildImageCandidates(product.image)[1] || "assets/img/back.jpg"}'};this.src='${buildImageCandidates(product.image)[1] || "assets/img/back.jpg"}'">
        </td>
        <td>${statusBadge}</td>
        <td>${product.created_at || "N/A"}</td>
        <td>
          <button class="btn btn-sm btn-info view-product" data-id="${product.product_id}" title="View Details" data-toggle="modal" data-target="#productDetailsModal">
            <i class="fas fa-eye"></i> View
          </button>
          ${actionButtons}
        </td>
      </tr>
    `;

    tbody.append(row);
  });
}

// =======================================
// Populate Approved Orders Card/Table
// =======================================
function displayApprovedOrders(products) {
  const tbody = $("#approvedProductsTable tbody");
  tbody.empty();

  const approved = (products || []).filter(
    (p) => (p.approval_status || "pending").toLowerCase() === "approved",
  );

  if (approved.length === 0) {
    tbody.html(
      `<tr><td colspan="12" class="text-center text-muted py-4">No Approved Products found.</td></tr>`,
    );
    return;
  }

  approved.forEach((product, index) => {
    const statusBadge = getStatusBadge("approved");
    const img = buildImageCandidates(product.image)[0];

    let category = "N/A";
    if (product.category) {
      category =
        typeof product.category === "object"
          ? product.category.name || String(product.category)
          : product.category;
    } else if (product.category_name) {
      category = product.category_name;
    } else if (product.categoryName) {
      category = product.categoryName;
    }

    let brand = "N/A";
    if (product.brand) {
      brand =
        typeof product.brand === "object"
          ? product.brand.name || String(product.brand)
          : product.brand;
    } else if (product.brand_name) {
      brand = product.brand_name;
    } else if (product.brandName) {
      brand = product.brandName;
    }

    // ======================================
    // APPROVED PRODUCT ACTION BUTTONS
    // ======================================
    let actionButtons = `
      <button
        class="btn btn-sm btn-info view-product"
        data-id="${product.product_id}"
        title="View Details"
        data-toggle="modal"
        data-target="#productDetailsModal">
        <i class="fas fa-eye"></i> View
      </button>
    `;

    if (role === "seller") {
      // Request Edit
      actionButtons += `
        <button
          class="btn btn-sm btn-warning request-product-edit"
          data-id="${product.product_id}">
          <i class="fas fa-edit"></i> Request Edit
        </button>
      `;

      // Update Stock
      actionButtons += `
        <button
          class="btn btn-sm btn-primary update-product-stock"
          data-id="${product.product_id}">
          <i class="fas fa-boxes"></i> Update Stock
        </button>
      `;

      // Activate / Deactivate
      if (product.status === "active") {
        actionButtons += `
          <button
            class="btn btn-sm btn-danger toggle-product-availability"
            data-id="${product.product_id}"
            data-action="inactive">
            <i class="fas fa-ban"></i> Deactivate
          </button>
        `;
      } else if (product.status === "inactive") {
        actionButtons += `
          <button
            class="btn btn-sm btn-success toggle-product-availability"
            data-id="${product.product_id}"
            data-action="active">
            <i class="fas fa-check"></i> Activate
          </button>
        `;
      }
    }

    const row = `
      <tr>
        <td class="text-center">${product.product_id || index + 1}</td>
        <td class="text-center">${product.product_name || "N/A"}</td>
        <td class="text-center">${product.seller?.username || "N/A"}</td>
        <td class="text-center">${category}</td>
        <td class="text-center">${brand}</td>
        <td class="text-center">₱${parseFloat(product.product_price || 0).toFixed(2)}</td>
        <td class="text-center">${product.stock_quantity || 0}</td>
        <td class="text-center"><img src="${img}" alt="Product" style="width:50px;height:50px;object-fit:cover;border-radius:4px;" onerror="this.onerror=null;this.src='assets/img/back.jpg'"></td>
        <td class="text-center">
          ${getStatusBadge(product.approval_status || "approved")}
        </td>
        <td class="text-center">
          ${getAvailabilityBadge(product.status)}
        </td>
        <td class="text-center">
          ${formatDate(product.approved_at || product.created_at)}
        </td>
        <td class="text-center">
          ${actionButtons}
        </td>
      </tr>
    `;

    tbody.append(row);
  });
}

// =======================================
// Get Availability Badge
// =======================================
function getAvailabilityBadge(status) {
  const normalizedStatus = (status || "active").toLowerCase();

  if (normalizedStatus === "active") {
    return `<span class="badge badge-success">ACTIVE</span>`;
  }

  if (normalizedStatus === "inactive") {
    return `<span class="badge badge-secondary">INACTIVE</span>`;
  }

  if (normalizedStatus === "out_of_stock") {
    return `<span class="badge badge-danger">OUT OF STOCK</span>`;
  }

  return `<span class="badge badge-secondary">${normalizedStatus.toUpperCase()}</span>`;
}

// Normalize order status for filtering
function normalizeOrderStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (normalized === "processing" || normalized === "to_ship") {
    return "to ship";
  }
  if (normalized === "pending_payment") {
    return "pending";
  }
  return normalized.replace(/_/g, " ");
}

// Render approved orders with optional status filter
function renderApprovedOrdersTable(statusFilter = "all") {
  const tbody = $("#approvedProductsTable tbody");
  tbody.empty();

  const filterValue = String(statusFilter || "all").toLowerCase();
  const filtered = (approvedOrdersCache || []).filter(({ order }) => {
    if (filterValue === "all") return true;
    return normalizeOrderStatus(order.status) === filterValue;
  });

  if (filtered.length === 0) {
    tbody.html(
      `<tr><td colspan="12" class="text-center text-muted py-4">No orders found.</td></tr>`,
    );
    return;
  }

  filtered.forEach(({ order, item }, idx) => {
    const firstItem = item;
    const prod = firstItem?.product || {};

    const pid =
      firstItem?.product_id ||
      prod.product_id ||
      prod.id ||
      firstItem?.product?.product_id ||
      null;

    const matchedProduct =
      pid && allProducts && allProducts.length
        ? allProducts.find((p) => String(p.product_id || p.id) === String(pid))
        : null;

    const productName =
      firstItem?.product_name ||
      prod.product_name ||
      prod.name ||
      (matchedProduct &&
        (matchedProduct.product_name || matchedProduct.name)) ||
      "N/A";

    const seller =
      (prod.seller && (prod.seller.username || prod.seller)) ||
      (matchedProduct &&
        (matchedProduct.seller?.username || matchedProduct.seller)) ||
      order.user?.username ||
      "N/A";

    let category = "N/A";
    if (prod.category) {
      category =
        typeof prod.category === "object"
          ? prod.category.name ||
            prod.category.category_name ||
            prod.category.title ||
            String(prod.category)
          : String(prod.category);
    } else if (firstItem?.category) {
      category =
        typeof firstItem.category === "object"
          ? firstItem.category.name || String(firstItem.category)
          : String(firstItem.category);
    } else if (prod.category_name) {
      category = prod.category_name;
    } else if (prod.categoryName) {
      category = prod.categoryName;
    } else if (matchedProduct) {
      category =
        matchedProduct.category ||
        matchedProduct.category_name ||
        matchedProduct.categoryName ||
        (matchedProduct.category &&
          (matchedProduct.category.name || matchedProduct.category)) ||
        "N/A";
    }

    let brand = "N/A";
    if (prod.brand) {
      brand =
        typeof prod.brand === "object"
          ? prod.brand.name ||
            prod.brand.brand_name ||
            prod.brand.title ||
            String(prod.brand)
          : String(prod.brand);
    } else if (firstItem?.brand) {
      brand =
        typeof firstItem.brand === "object"
          ? firstItem.brand.name || String(firstItem.brand)
          : String(firstItem.brand);
    } else if (prod.brand_name) {
      brand = prod.brand_name;
    } else if (prod.brandName) {
      brand = prod.brandName;
    } else if (matchedProduct) {
      brand =
        matchedProduct.brand ||
        matchedProduct.brand_name ||
        matchedProduct.brandName ||
        (matchedProduct.brand &&
          (matchedProduct.brand.name || matchedProduct.brand)) ||
        "N/A";
    }

    const price =
      firstItem?.price ||
      prod.product_price ||
      prod.price ||
      (matchedProduct &&
        (matchedProduct.product_price || matchedProduct.price)) ||
      0;

    const stock =
      typeof prod.stock_quantity !== "undefined"
        ? prod.stock_quantity
        : typeof prod.stock !== "undefined"
          ? prod.stock
          : (matchedProduct &&
              (matchedProduct.stock_quantity || matchedProduct.stock)) ||
            "N/A";

    const img = prod.image
      ? buildImageCandidates(prod.image)[0]
      : firstItem?.image
        ? buildImageCandidates(firstItem.image)[0]
        : matchedProduct && matchedProduct.image
          ? buildImageCandidates(matchedProduct.image)[0]
          : "assets/img/back.jpg";

    const approvalStatus =
      prod.approval_status || firstItem?.approval_status || "N/A";

    const prodIdDisplay =
      firstItem?.product_id ||
      prod.product_id ||
      (matchedProduct && (matchedProduct.product_id || matchedProduct.id)) ||
      order.checkout_id ||
      idx + 1;

    const row = `
      <tr>
        <td class="text-center">${prodIdDisplay}</td>
        <td class="text-center">${productName}</td>
        <td class="text-center">${seller}</td>
        <td class="text-center">${category}</td>
        <td class="text-center">${brand}</td>
        <td class="text-center">₱${parseFloat(price || 0).toFixed(2)}</td>
        <td class="text-center">${stock}</td>
        <td class="text-center"><img src="${img}" alt="Product" style="width:50px;height:50px;object-fit:cover;border-radius:4px;" onerror="this.onerror=null;this.src='assets/img/back.jpg'"></td>
        <td class="text-center"><span class="badge">${(approvalStatus || "").toUpperCase()}</span></td>
        <td class="text-center">${formatDate(order.created_at || order.updated_at)}</td>
        <td class="text-center"><button class="btn btn-sm btn-info" data-id="${order.checkout_id}" onclick="viewCheckout(${order.checkout_id})" data-toggle="modal" data-target="#productDetailsModal"><i class="fas fa-eye"></i> View</button></td>
      </tr>
    `;

    tbody.append(row);
  });
}

// =======================================
// Fetch approved orders (checkouts) from backend and render
// =======================================
function fetchAndDisplayApprovedOrders() {
  const tbody = $("#approvedProductsTable tbody");
  tbody.empty();

  $.ajax({
    url: `${ip}/api/checkout/all`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (res) {
      console.log("Approved Orders:", res);
      const orders = res || [];

      // Filter orders where first item's product has approval_status === 'approved'
      let approved = (orders || []).filter((o) => {
        const firstItem = o.items && o.items.length ? o.items[0] : null;
        const approval =
          firstItem?.product?.approval_status ||
          firstItem?.approval_status ||
          null;

        return (approval || "").toLowerCase() === "approved";
      });

      // FILTER IF SELLER
      if (role === "seller") {
        approved = approved.filter((o) => {
          const firstItem = o.items && o.items.length ? o.items[0] : null;
          return firstItem?.product?.seller?.username === usr;
        });
      }

      if (approved.length === 0) {
        tbody.html(
          `<tr><td colspan="12" class="text-center text-muted py-4">No approved orders found.</td></tr>`,
        );
        return;
      }

      // Deduplicate by product_id to show each approved product only once
      const uniq = {};
      approved.forEach((order) => {
        if (order.items && order.items.length) {
          order.items.forEach((item) => {
            const itemApprovalStatus =
              item?.product?.approval_status ||
              item?.approval_status ||
              "pending";
            if (itemApprovalStatus.toLowerCase() !== "approved") return;

            const pid = item?.product_id || item?.product?.product_id;
            if (!pid) return;

            const date = order.created_at || order.updated_at || null;

            if (!uniq[pid]) {
              uniq[pid] = { order, item, date };
            } else {
              const existingDate = uniq[pid].date;
              if (
                date &&
                (!existingDate || new Date(date) > new Date(existingDate))
              ) {
                uniq[pid] = { order, item, date };
              }
            }
          });
        }
      });

      approvedOrdersCache = Object.values(uniq);
      renderApprovedOrdersTable($("#statusFilter").val());
    },
    error: function (xhr) {
      console.error("Error fetching approved orders:", xhr.responseText);
      tbody.html(
        `<tr><td colspan="12" class="text-center text-danger py-4">Failed to load approved orders.</td></tr>`,
      );
    },
  });
}

// helper used by action button above — opens order details modal (uses existing product modal for quick inspect)
function viewCheckout(checkoutId) {
  // find order in cache
  const cached = approvedOrdersCache.find(
    (o) => o.order.checkout_id == checkoutId,
  );
  if (!cached) {
    return Swal.fire({
      icon: "error",
      title: "Error",
      text: "Order not found.",
    });
  }

  const { order, item } = cached;
  let prod = item?.product || {};

  // fallback to allProducts if product info missing
  const pid = item?.product_id || prod.product_id || prod.id || null;
  if ((!prod || Object.keys(prod).length === 0) && pid && allProducts.length) {
    const matched = allProducts.find(
      (p) => String(p.product_id || p.id) === String(pid),
    );
    if (matched) prod = matched;
  }

  $("#detailProductId").text(
    item?.product_id || prod.product_id || prod.id || "N/A",
  );
  $("#detailProductName").text(
    item?.product_name || prod.product_name || prod.name || "N/A",
  );
  $("#detailSeller").text(
    prod.seller?.username || prod.seller || order.user?.username || "N/A",
  );

  let category = "N/A";
  if (prod.category) {
    category =
      typeof prod.category === "object"
        ? prod.category.name ||
          prod.category.category_name ||
          prod.category.title ||
          String(prod.category)
        : String(prod.category);
  } else if (item?.category) {
    category =
      typeof item.category === "object"
        ? item.category.name || String(item.category)
        : String(item.category);
  } else if (prod.category_name) {
    category = prod.category_name;
  } else if (prod.categoryName) {
    category = prod.categoryName;
  }
  $("#detailCategory").text(category);

  let brand = "N/A";
  if (prod.brand) {
    brand =
      typeof prod.brand === "object"
        ? prod.brand.name ||
          prod.brand.brand_name ||
          prod.brand.title ||
          String(prod.brand)
        : String(prod.brand);
  } else if (item?.brand) {
    brand =
      typeof item.brand === "object"
        ? item.brand.name || String(item.brand)
        : String(item.brand);
  } else if (prod.brand_name) {
    brand = prod.brand_name;
  } else if (prod.brandName) {
    brand = prod.brandName;
  }
  $("#detailBrand").text(brand);

  $("#detailPrice").text(
    `₱${parseFloat(item?.price || prod.product_price || prod.price || 0).toFixed(2)}`,
  );
  $("#detailStock").text(prod.stock_quantity ?? prod.stock ?? "N/A");
  $("#detailDescription").text(
    item?.description ||
      prod.product_description ||
      prod.description ||
      `Quantity: ${item?.quantity}\nSubtotal: ₱${parseFloat(item?.subtotal || 0).toFixed(2)}`,
  );
  $("#detailDate").text(formatDate(order.created_at) || "N/A");

  const status = prod.approval_status || item?.approval_status || "Approved";
  $("#detailPendingStatus")
    .removeClass()
    .addClass("badge")
    .addClass(
      status.toLowerCase() === "pending"
        ? "Pending"
        : status.toLowerCase() === "approved"
          ? "Approved"
          : "Rejected",
    )
    .text(status.toUpperCase());

  const img =
    prod.image || item?.image
      ? buildImageCandidates(prod.image || item?.image)[0]
      : "assets/img/back.jpg";
  $("#productImage").attr("src", img);

  // Hide admin action buttons when viewing from order context to avoid accidental actions
  $("#approveBtn").hide();
  $("#rejectBtn").hide();

  $("#productDetailsModal").modal("show");
}

// =======================================
// Format Date Helper
// =======================================
function formatDate(dateString) {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    const options = { year: "numeric", month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  } catch (e) {
    return dateString;
  }
}

// =======================================
// Get Status Badge
// =======================================
function getStatusBadge(status) {
  const badgeClasses = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };

  const badgeClass = badgeClasses[status] || "badge-secondary";
  return `<span class="badge ${badgeClass}">${status.toUpperCase()}</span>`;
}

// =======================================
// Image URL Normalization
// =======================================
function buildImageSrc(image) {
  if (!image) return "assets/img/back.jpg";

  // If it's already an absolute URL, return as-is
  if (/^(https?:)?\/\//i.test(image)) return image;

  // If the returned path already contains 'assets', make it relative
  if (image.includes("assets/")) {
    // remove any leading slashes
    return image.replace(/^\/+/, "");
  }

  // If it contains FrontEnd prefix, strip up to 'assets/' so path works from this HTML
  const idx = image.indexOf("assets/");
  if (idx !== -1) return image.slice(idx);

  // Assume it's just a filename stored in DB
  return `assets/img/product/${image}`;
}

// Build multiple candidate URLs to try (artisan server, apache/XAMPP paths, relative)
function buildImageCandidates(image) {
  if (!image) return ["assets/img/back.jpg"];

  // extract filename (if an already partial path is provided)
  const filename = String(image).split("/").pop();

  // helper to join paths without duplicating segments or slashes
  function joinParts(...parts) {
    return parts
      .map((p) => String(p || "").replace(/(^\/+|\/+$)/g, ""))
      .filter(Boolean)
      .join("/");
  }

  // candidate 1: Laravel dev server (if used)
  const c1 = joinParts(ip, "FrontEnd", "assets", "img", "product", filename);

  // derive project base from current pathname (e.g., /e-commerce)
  let projectBase = window.location.pathname || "";
  if (projectBase.includes("/FrontEnd"))
    projectBase = projectBase.split("/FrontEnd")[0];
  else if (projectBase.includes("/BackEnd"))
    projectBase = projectBase.split("/BackEnd")[0];
  // ensure leading slash for origin joining
  if (!projectBase.startsWith("/"))
    projectBase = projectBase ? `/${projectBase}` : "";
  const base = window.location.origin + projectBase;

  // candidate 2: XAMPP/Apache served BackEnd public folder
  const c2 = joinParts(
    base,
    "BackEnd",
    "public",
    "FrontEnd",
    "assets",
    "img",
    "product",
    filename,
  );

  // candidate 3: relative FrontEnd path
  const c3 = joinParts(base, "FrontEnd", "assets", "img", "product", filename);

  return [c1, c2, c3];
}

// =======================================
// Dropdown Loaders (Category & Brand)
// =======================================
function loadCategories($select = $("#category_id"), callback) {
  $.ajax({
    url: `${ip}/api/category`,
    method: "GET",
    dataType: "json",
    headers: { Authorization: `Bearer ${token}` },
    success: (res) => {
      const categories = res.categories || res.data || res || [];
      $select
        .empty()
        .append(
          '<option value="" disabled selected>Select a category</option>',
        );
      (Array.isArray(categories) ? categories : []).forEach((cat) => {
        if ((cat.status || "pending").toLowerCase() !== "approved") return;
        const id = cat.category_id || cat.id;
        const name = cat.name || cat.category_name;
        if (id && name)
          $select.append(`<option value="${id}">${name}</option>`);
      });
      if (callback) callback();
    },
    error: (xhr) => {
      console.error("Error loading categories:", xhr.responseText);
      $select.html("<option disabled>Error loading categories</option>");
      if (callback) callback();
    },
  });
}

function loadBrands($select = $("#brand_id"), callback) {
  $.ajax({
    url: `${ip}/api/brands`,
    method: "GET",
    dataType: "json",
    headers: { Authorization: `Bearer ${token}` },
    success: (res) => {
      const brands = res.brands || res.data || res || [];
      $select
        .empty()
        .append('<option value="" disabled selected>Select a brand</option>');
      (Array.isArray(brands) ? brands : []).forEach((brand) => {
        if ((brand.status || "pending").toLowerCase() !== "approved") return;
        const id = brand.brand_id || brand.id;
        const name = brand.name || brand.brand_name;
        if (id && name)
          $select.append(`<option value="${id}">${name}</option>`);
      });
      if (callback) callback();
    },
    error: (xhr) => {
      console.error("Error loading brands:", xhr.responseText);
      $select.html("<option disabled>Error loading brands</option>");
      if (callback) callback();
    },
  });
}

// =======================================
// Load Product Details
// =======================================
function loadProductDetails(productId) {
  const product = allProducts.find((p) => p.product_id == productId);

  if (!product) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Product not found.",
    });
    return;
  }

  console.log("Product Details:", product);

  // Populate modal fields
  $("#detailProductId").text(product.product_id || "N/A");
  $("#detailProductName").text(product.product_name || "N/A");
  $("#detailSeller").text(product.seller?.username || "N/A");
  $("#detailCategory").text(product.category || "N/A");
  $("#detailBrand").text(product.brand || "N/A");
  $("#detailPrice").text(`₱${parseFloat(product.product_price).toFixed(2)}`);
  $("#detailStock").text(product.stock_quantity || 0);
  $("#detailDescription").text(product.product_description || "N/A");
  $("#detailDate").text(product.created_at || "N/A");
  $("#detailDate").text(formatDate(product.created_at));

  // Status badge
  const status = product.approval_status || "pending";
  $("#detailPendingStatus")
    .removeClass()
    .addClass("badge")
    .addClass(
      status === "pending"
        ? "Pending"
        : status === "approved"
          ? "Approved"
          : "Rejected",
    )
    .text(status.toUpperCase());

  // Product image with chained fallbacks
  const _candidates = buildImageCandidates(product.image);
  const $prodImg = $("#productImage");
  $prodImg.off("error");
  $prodImg.attr("src", _candidates[0]);
  $prodImg.on("error", function () {
    $prodImg.off("error");
    $prodImg.attr("src", _candidates[1] || "assets/img/back.jpg");
    $prodImg.on("error", function () {
      $prodImg.off("error");
      $prodImg.attr("src", "assets/img/back.jpg");
    });
  });

  currentProductId = product.product_id;

  // Show/hide approve/reject buttons based on status
  if (role === "admin" && status === "pending") {
    $("#approveBtn").show();
    $("#rejectBtn").show();
  } else {
    $("#approveBtn").hide();
    $("#rejectBtn").hide();
  }
}

// =======================================
// Approve Product
// =======================================
function approveProduct(productId) {
  $.ajax({
    url: `${ip}/api/products/${productId}/approve`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (res) {
      Swal.fire({
        icon: "success",
        title: "Approved!",
        text: "Product has been approved successfully.",
      }).then(() => {
        $("#productDetailsModal").modal("hide");
        loadProductsForApproval();
      });
    },
    error: function (xhr) {
      console.error("Error approving product:", xhr.responseText);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: xhr.responseJSON?.message || "Failed to approve product.",
      });
    },
  });
}

// =======================================
// Reject Product
// =======================================
function rejectProduct(productId, reason = "") {
  $.ajax({
    url: `${ip}/api/products/${productId}/reject`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    data: JSON.stringify({ reason: reason }),
    success: function (res) {
      Swal.fire({
        icon: "success",
        title: "Rejected!",
        text: "Product has been rejected.",
      }).then(() => {
        $("#rejectionReasonModal").modal("hide");
        $("#productDetailsModal").modal("hide");
        loadProductsForApproval();
      });
    },
    error: function (xhr) {
      console.error("Error rejecting product:", xhr.responseText);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: xhr.responseJSON?.message || "Failed to reject product.",
      });
    },
  });
}

// =======================================
// Display Rejected Products
// =======================================
function displayRejectedProducts(products) {
  const tbody = $("#rejectedProductsTable tbody");
  tbody.empty();

  if (!products || products.length === 0) {
    tbody.html(`
      <tr>
        <td colspan="8" class="text-center text-muted py-4">
          No Rejected Products found.
        </td>
      </tr>
    `);
    return;
  }

  products.forEach((product, index) => {
    let actionButtons = `
      <button
        class="btn btn-sm btn-info view-product"
        data-id="${product.product_id}"
        data-toggle="modal"
        data-target="#productDetailsModal">
        <i class="fas fa-eye"></i> View
      </button>
    `;

    if (role === "seller") {
      actionButtons += `
        <button
          class="btn btn-sm btn-warning edit-product"
          data-id="${product.product_id}"
          data-toggle="modal"
          data-target="#editProductModal">
          <i class="fas fa-edit"></i> Edit & Resubmit
        </button>
      `;
    }

    const row = `
      <tr>
        <td>${product.product_id || index + 1}</td>
        <td>${product.product_name || "N/A"}</td>
        <td>${product.seller?.username || "N/A"}</td>
        <td>${product.category || "N/A"}</td>
        <td>${product.brand || "N/A"}</td>

        <td>
          ${product.approval_reason || "No reason provided"}
        </td>

        <td>
          ${formatDate(product.updated_at || product.created_at)}
        </td>

        <td>
          ${actionButtons}
        </td>
      </tr>
    `;

    tbody.append(row);
  });
}

// =======================================
// Main Initialization
// =======================================
$(document).ready(function () {
  load_user();
  setupSidebarToggle();
  loadProductsForApproval();

  // --- Add Product Handler ---
  $(".add_product").on("click", () => {
    loadCategories();
    loadBrands();
  });

  // --- Create Product Form Submit ---
  $("#productForm").on("submit", function (e) {
    e.preventDefault();

    const categoryId = $("#category_id").val();
    const brandId = $("#brand_id").val();

    if (!categoryId || !brandId) {
      return Swal.fire(
        "Validation Error",
        "Please select both a category and a brand.",
        "error",
      );
    }

    const fd = new FormData(this);
    fd.set("category_id", categoryId);
    fd.set("brand_id", brandId);

    $("#createProduct").text("Adding...").prop("disabled", true);

    $.ajax({
      url: `${ip}/api/products`,
      method: "POST",
      data: fd,
      processData: false,
      contentType: false,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      success: (res, _, xhr) => {
        $("#createProduct").text("Create").prop("disabled", false);
        Swal.fire({
          icon: "success",
          title: "Product Added",
          text: "Your product has been added and is pending approval.",
          showConfirmButton: false,
          timer: 2000,
        }).then(() => {
          $("#productForm")[0].reset();
          $("#productModal").modal("hide");
          loadProductsForApproval();
        });
      },
      error: (xhr) => {
        $("#createProduct").text("Create").prop("disabled", false);
        let msg = xhr.responseJSON?.msg || "Failed to add product";
        if (xhr.status === 422 && xhr.responseJSON?.errors) {
          msg = Object.values(xhr.responseJSON.errors)
            .map((e) => e[0])
            .join("\n");
        }
        Swal.fire("Error", msg, "error");
      },
    });
  });

  // --- Edit Product Handler (Populate Modal) ---
  $(document).on("click", ".edit-product", function () {
    const productId = $(this).data("id");
    $("#edit_product_id").val(productId);

    // Load categories and brands into the edit modal dropdowns
    loadCategories($("#edit_category_id"), () => {
      loadBrands($("#edit_brand_id"), () => {
        // Fetch product details
        const product = allProducts.find((p) => p.product_id == productId);
        if (product) {
          $("#edit_category_id").val(
            product.category_id || product.category?.category_id,
          );
          $("#edit_brand_id").val(product.brand_id || product.brand?.brand_id);
          $("#edit_product_name").val(product.product_name);
          $("#edit_product_price").val(product.product_price);
          $("#edit_product_description").val(product.product_description);
          $("#edit_stock_quantity").val(product.stock_quantity);
          $("#edit_status").val(product.status || "active");

          const imgUrl = buildImageCandidates(product.image)[0];
          $("#edit_image_preview").attr("src", imgUrl).show();
        }
      });
    });
  });

  // --- Edit Product Form Submit ---
  $("#editProductForm").on("submit", function (e) {
    e.preventDefault();
    const productId = $("#edit_product_id").val();
    const fd = new FormData(this);
    fd.append("_method", "PUT"); // Important for Laravel PUT requests via POST

    $("#updateProductBtn").text("Updating...").prop("disabled", true);

    $.ajax({
      url: `${ip}/api/products/${productId}`,
      method: "POST", // Use POST with _method=PUT
      data: fd,
      processData: false,
      contentType: false,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      success: (res) => {
        $("#updateProductBtn").text("Update").prop("disabled", false);
        Swal.fire({
          icon: "success",
          title: "Product Updated",
          text: "Product details have been updated successfully.",
          timer: 2000,
          showConfirmButton: false,
        }).then(() => {
          $("#editProductModal").modal("hide");
          loadProductsForApproval();
        });
      },
      error: (xhr) => {
        $("#updateProductBtn").text("Update").prop("disabled", false);
        let msg = xhr.responseJSON?.msg || "Failed to update product";
        if (xhr.status === 422 && xhr.responseJSON?.errors) {
          msg = Object.values(xhr.responseJSON.errors)
            .map((e) => e[0])
            .join("\n");
        }
        Swal.fire("Error", msg, "error");
      },
    });
  });

  // --- Order Status Filter ---
  $("#statusFilter").on("change", function () {
    renderApprovedOrdersTable($(this).val());
  });

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
  }

  // --- Fetch Cart Count ---
  loadCartCount();

  // --- Product Filter Buttons ---
  $(".product-filter-btn").on("click", function () {
    $(".product-filter-btn").removeClass("active");
    $(this).addClass("active");

    const status = $(this).data("status");
    displayProductsTable(allProducts, status);
  });

  // --- View Product Details ---
  $(document).on("click", ".view-product", function () {
    const productId = $(this).data("id");
    loadProductDetails(productId);
  });

  // --- Submit Rejection ---
  $("#submitRejectionBtn").on("click", function () {
    const reason = $("#rejectionReason").val();

    if (!reason.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Required",
        text: "Please provide a reason for rejection.",
      });
      return;
    }

    rejectProduct(currentProductId, reason);
    $("#rejectionReason").val("");
  });

  // --- Approve from Modal ---
  $("#approveBtn").on("click", function () {
    Swal.fire({
      title: "Approve Product?",
      text: "Are you sure you want to approve this product?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#28a745",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, Approve",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        approveProduct(currentProductId);
      }
    });
  });

  // --- Reject from Modal ---
  $("#rejectBtn").on("click", function () {
    $("#rejectionReasonModal").modal("show");
  });

  // =======================================
  // Update Product Stock
  // =======================================
  $(document).on("click", ".update-product-stock", function () {
    const productId = $(this).data("id");

    const product = allProducts.find((p) => p.product_id == productId);

    if (!product) {
      return Swal.fire("Error", "Product not found.", "error");
    }

    Swal.fire({
      title: "Update Stock",
      input: "number",
      inputLabel: `Current stock: ${product.stock_quantity}`,
      inputValue: product.stock_quantity,
      inputAttributes: {
        min: 0,
        step: 1,
      },
      showCancelButton: true,
      confirmButtonText: "Update Stock",

      inputValidator: (value) => {
        if (value === "") {
          return "Please enter the stock quantity.";
        }

        if (parseInt(value) < 0) {
          return "Stock cannot be negative.";
        }
      },
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      const newStock = parseInt(result.value);

      $.ajax({
        url: `${ip}/api/products/${productId}/stock`,
        method: "PUT",

        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },

        data: JSON.stringify({
          stock_quantity: newStock,
        }),

        success: function (res) {
          Swal.fire({
            icon: "success",
            title: "Stock Updated",
            text: res.msg || "Product stock has been updated.",
          });

          loadProductsForApproval();
        },

        error: function (xhr) {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: xhr.responseJSON?.msg || "Failed to update stock.",
          });
        },
      });
    });
  });

  // =======================================
  // Activate / Deactivate Product
  // =======================================
  $(document).on("click", ".toggle-product-availability", function () {
    const productId = $(this).data("id");
    const action = $(this).data("action");

    const activating = action === "active";

    Swal.fire({
      title: activating ? "Activate Product?" : "Deactivate Product?",

      text: activating
        ? "This product will become available to customers."
        : "This product will no longer be available to customers.",

      icon: "question",
      showCancelButton: true,

      confirmButtonText: activating ? "Yes, Activate" : "Yes, Deactivate",

      cancelButtonText: "Cancel",
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      $.ajax({
        url: `${ip}/api/products/${productId}/availability`,
        method: "PUT",

        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },

        data: JSON.stringify({
          status: action,
        }),

        success: function (res) {
          Swal.fire({
            icon: "success",
            title: activating ? "Product Activated" : "Product Deactivated",
            text: res.msg,
          });

          loadProductsForApproval();
        },

        error: function (xhr) {
          Swal.fire({
            icon: "error",
            title: "Error",
            text:
              xhr.responseJSON?.msg || "Failed to update product availability.",
          });
        },
      });
    });
  });

  // --- Logout Functionality ---
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

  // --- AJAX Loading Indicator ---
  $(document).ajaxStart(() => $("#wait").show());
  $(document).ajaxComplete(() => $("#wait").hide());
});
