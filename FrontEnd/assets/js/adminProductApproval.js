/* ================================
   ADMIN PRODUCT APPROVAL SYSTEM
================================ */

const ip = "http://localhost:8000";
let token = $.cookie("token");
let usr = $.cookie("username");
let role = $.cookie("role");
let currentProductId = null;
let allProducts = [];

console.log("adminProductApproval.js loaded", { token, usr, role, ip });

// =======================================
// User Session Handling
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

  $displayUsername.html(`<b>${usr}</b>`);
  $login.hide();
  $register.hide();
  $logout.show();

  // Show cart only for regular users (not sellers/admins)
  if (!role || (role !== "admin" && role !== "seller")) {
    $cartCount.show();
  } else {
    $cartCount.hide();
  }

  if (["admin", "seller"].includes(role)) {
    $adminDashboard.show();
  } else {
    $adminDashboard.hide();
  }
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
      // Show only pending/non-approved products in the pending table
      const pendingProducts = allProducts.filter((p) => {
        const status = p.approval_status || "pending";
        return status.toLowerCase() !== "approved";
      });
      displayProductsTable(pendingProducts, "all");
      // populate approved orders card/table from backend
      fetchAndDisplayApprovedOrders();
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
      `<tr><td colspan="11" class="text-center text-muted py-4">No products found.</td></tr>`,
    );
    return;
  }

  filteredProducts.forEach((product, index) => {
    const status = product.approval_status || "pending";
    const statusBadge = getStatusBadge(status);

    const actionButtons =
      status === "pending"
        ? `
        <button class="btn btn-sm btn-success approve-product" data-id="${product.product_id}" title="Approve">
          <i class="fas fa-check"></i> Approve
        </button>
        <button class="btn btn-sm btn-danger reject-product" data-id="${product.product_id}" title="Reject">
          <i class="fas fa-times"></i> Reject
        </button>
      `
        : `<span class="text-muted">-</span>`;

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
  const tbody = $("#ordersTable tbody");
  tbody.empty();

  const approved = (products || []).filter(
    (p) => (p.approval_status || "pending").toLowerCase() === "approved",
  );

  if (approved.length === 0) {
    tbody.html(
      `<tr><td colspan="11" class="text-center text-muted py-4">No approved orders/products found.</td></tr>`,
    );
    return;
  }

  approved.forEach((product, index) => {
    const statusBadge = getStatusBadge("approved");
    const img = buildImageCandidates(product.image)[0] || "assets/img/back.jpg";
    const row = `
      <tr>
        <td class="text-center">${product.product_id || index + 1}</td>
        <td class="text-center">${product.product_name || "N/A"}</td>
        <td class="text-center">${product.seller?.username || "N/A"}</td>
        <td class="text-center">${product.category || "N/A"}</td>
        <td class="text-center">${product.brand || "N/A"}</td>
        <td class="text-center">₱${parseFloat(product.product_price || 0).toFixed(2)}</td>
        <td class="text-center">${product.stock_quantity || 0}</td>
        <td class="text-center"><img src="${img}" alt="Product" style="width:50px;height:50px;object-fit:cover;border-radius:4px;" onerror="this.onerror=null;this.src='assets/img/back.jpg'"></td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-center">${product.approved_at || product.created_at || "N/A"}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-info view-product" data-id="${product.product_id}" title="View Details" data-toggle="modal" data-target="#productDetailsModal">
            <i class="fas fa-eye"></i> View
          </button>
        </td>
      </tr>
    `;

    tbody.append(row);
  });
}

// =======================================
// Fetch approved orders (checkouts) from backend and render
// =======================================
function fetchAndDisplayApprovedOrders() {
  const tbody = $("#ordersTable tbody");
  tbody.empty();

  $.ajax({
    url: `${ip}/api/checkout/all`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (res) {
      const orders = res || [];

      // Filter orders where first item's product has approval_status === 'approved'
      const approved = (orders || []).filter((o) => {
        const firstItem = o.items && o.items.length ? o.items[0] : null;
        const approval =
          firstItem?.product?.approval_status ||
          firstItem?.approval_status ||
          null;
        return (approval || "").toLowerCase() === "approved";
      });

      if (approved.length === 0) {
        tbody.html(
          `<tr><td colspan="11" class="text-center text-muted py-4">No approved orders found.</td></tr>`,
        );
        return;
      }

      // Deduplicate by product_id to show each approved product only once
      const uniq = {};
      approved.forEach((order) => {
        // Check all items in this order, not just the first one
        if (order.items && order.items.length) {
          order.items.forEach((item) => {
            // Only include items with approval_status === 'approved'
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
              // Keep the most recent entry for this product
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

      const uniqueProducts = Object.values(uniq);
      uniqueProducts.forEach(({ order, item }, idx) => {
        const firstItem = item;
        const prod = firstItem?.product || {};

        // Debug: log the item structure to help diagnose missing fields
        console.log("Approved order item:", { firstItem, prod, order });

        // determine product id to allow lookups when product payload is minimal
        const pid =
          firstItem?.product_id ||
          prod.product_id ||
          prod.id ||
          firstItem?.product?.product_id ||
          null;

        // try to find a full product record from previously loaded products
        const matchedProduct =
          pid && allProducts && allProducts.length
            ? allProducts.find(
                (p) => String(p.product_id || p.id) === String(pid),
              )
            : null;

        const productName =
          firstItem?.product_name ||
          prod.product_name ||
          prod.name ||
          (matchedProduct &&
            (matchedProduct.product_name || matchedProduct.name)) ||
          "N/A";

        const seller =
          // seller may be an object or a string username/id
          (prod.seller && (prod.seller.username || prod.seller)) ||
          (matchedProduct &&
            (matchedProduct.seller?.username || matchedProduct.seller)) ||
          order.user?.username ||
          "N/A";

        // Extract category with comprehensive fallbacks, then fallback to matchedProduct
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

        // Extract brand with comprehensive fallbacks, then fallback to matchedProduct
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

        console.log("Category extraction result:", {
          category,
          prod_category: prod.category,
          firstItem_category: firstItem?.category,
          matchedProduct: matchedProduct
            ? { category: matchedProduct.category, brand: matchedProduct.brand }
            : null,
        });

        const price =
          firstItem?.price ||
          prod.product_price ||
          prod.price ||
          (matchedProduct &&
            (matchedProduct.product_price || matchedProduct.price)) ||
          0;

        const stock =
          // prefer numeric stock if available, else show N/A
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
          (matchedProduct &&
            (matchedProduct.product_id || matchedProduct.id)) ||
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
    },
    error: function (xhr) {
      console.error("Error fetching approved orders:", xhr.responseText);
      tbody.html(
        `<tr><td colspan="11" class="text-center text-danger py-4">Failed to load approved orders.</td></tr>`,
      );
    },
  });
}

// helper used by action button above — opens order details modal (uses existing product modal for quick inspect)
function viewCheckout(checkoutId) {
  // try to open product details if mapping exists, otherwise fetch order details
  $.ajax({
    url: `${ip}/api/checkout/orders/${checkoutId}`,
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    success: function (res) {
      const order = res.order || res;
      if (!order)
        return Swal.fire({
          icon: "info",
          title: "No details",
          text: "No order details available.",
        });

      // populate modal with first item/product for quick view
      const item = order.items && order.items.length ? order.items[0] : null;
      if (item) {
        let prod = item.product || {};
        // fallback: if product details are not included in the order item,
        // try to find the full product record from `allProducts` by id
        const pid = item.product_id || prod.product_id || prod.id || null;
        if (
          (!prod || Object.keys(prod).length === 0) &&
          pid &&
          allProducts &&
          allProducts.length
        ) {
          const matched = allProducts.find(
            (p) => String(p.product_id || p.id) === String(pid),
          );
          if (matched) prod = matched;
        }

        const detailId = item.product_id || prod.product_id || prod.id || "N/A";
        const detailName =
          item.product_name || prod.product_name || prod.name || "N/A";
        const seller =
          (prod.seller && (prod.seller.username || prod.seller)) ||
          order.user?.username ||
          "N/A";
        const category =
          (prod.category && (prod.category.name || prod.category)) ||
          item.category ||
          "N/A";
        const brand =
          (prod.brand && (prod.brand.name || prod.brand)) ||
          item.brand ||
          "N/A";
        const price = item.price || prod.product_price || prod.price || 0;
        const stock =
          typeof prod.stock_quantity !== "undefined"
            ? prod.stock_quantity
            : typeof prod.stock !== "undefined"
              ? prod.stock
              : "N/A";
        const description =
          item.description ||
          prod.product_description ||
          prod.description ||
          "";

        $("#detailProductId").text(detailId);
        $("#detailProductName").text(detailName);
        $("#detailSeller").text(seller);
        $("#detailCategory").text(category);
        $("#detailBrand").text(brand);
        $("#detailPrice").text(`₱${parseFloat(price || 0).toFixed(2)}`);
        $("#detailStock").text(stock);
        $("#detailDescription").text(
          description
            ? description
            : `Quantity: ${item.quantity}\nSubtotal: ₱${parseFloat(item.subtotal || 0).toFixed(2)}`,
        );
        $("#detailDate").text(order.created_at || "N/A");

        const imgSource = prod.image || item.image || null;
        const img = imgSource
          ? buildImageCandidates(imgSource)[0]
          : "assets/img/back.jpg";
        $("#productImage").attr("src", img);
        $("#productDetailsModal").modal("show");
      } else {
        Swal.fire({
          icon: "info",
          title: "No items",
          text: "This order has no items to display.",
        });
      }
    },
    error: function (xhr) {
      console.error("Error fetching order details:", xhr.responseText);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to load order details.",
      });
    },
  });
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

  const status = product.approval_status || "pending";
  $("#detailStatus")
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
  if (status === "pending") {
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
// Main Initialization
// =======================================
$(document).ready(function () {
  load_user();
  setupSidebarToggle();
  loadProductsForApproval();

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
  $.ajax({
    url: `${ip}/api/cart`,
    method: "GET",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
    },
    success: function (response) {
      console.log("Cart items fetched successfully:", response);
      $("#cart-count").text(response.count || 0);
    },
  });

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

  // --- Approve Product (from table) ---
  $(document).on("click", ".approve-product", function () {
    const productId = $(this).data("id");

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
        approveProduct(productId);
      }
    });
  });

  // --- Reject Product (from table - Show Modal) ---
  $(document).on("click", ".reject-product", function () {
    const productId = $(this).data("id");
    currentProductId = productId;
    $("#rejectionReasonModal").modal("show");
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

  // --- Logout Functionality ---
  $("#logout").click(function () {
    $.ajax({
      url: `${ip}/api/logout`,
      type: "POST",
      headers: { Authorization: `Bearer ${token}` },
      data: { token },
      success: () => {
        Swal.fire({ icon: "success", title: "Logout Successful" }).then(() => {
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

  // --- AJAX Loading Indicator ---
  $(document).ajaxStart(() => $("#wait").show());
  $(document).ajaxComplete(() => $("#wait").hide());
});
