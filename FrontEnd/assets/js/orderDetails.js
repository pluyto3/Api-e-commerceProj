/* ================================
   GLOBAL VARIABLES
================================ */
const ip = "http://localhost:8000";
let token = null;
let usr = null;
let role = null;
let profileImage = null;
let globalOrders = [];
let ordersTable = null;
let currentUserProfile = null;

// Fallback for jquery.cookie if the plugin fails to load
if (
  typeof window.jQuery !== "undefined" &&
  typeof window.jQuery.cookie !== "function"
) {
  window.jQuery.cookie = function (name, value, options) {
    if (arguments.length > 1) {
      const opts = options || {};
      let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
      if (typeof opts.expires === "number") {
        const date = new Date();
        date.setTime(date.getTime() + opts.expires * 864e5);
        cookie += `; expires=${date.toUTCString()}`;
      } else if (opts.expires instanceof Date) {
        cookie += `; expires=${opts.expires.toUTCString()}`;
      }
      cookie += `; path=${opts.path || "/"}`;
      if (opts.domain) cookie += `; domain=${opts.domain}`;
      if (opts.secure) cookie += "; secure";
      document.cookie = cookie;
      return cookie;
    }

    if (!name) {
      const result = {};
      const parts = document.cookie ? document.cookie.split("; ") : [];
      parts.forEach((part) => {
        const idx = part.indexOf("=");
        const key = decodeURIComponent(idx >= 0 ? part.slice(0, idx) : part);
        const val = idx >= 0 ? decodeURIComponent(part.slice(idx + 1)) : "";
        result[key] = val;
      });
      return result;
    }

    const encoded = encodeURIComponent(name).replace(/[-.+*]/g, "\\$&");
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${encoded}=([^;]*)`),
    );
    return match ? decodeURIComponent(match[1]) : null;
  };

  window.jQuery.removeCookie = function (name, options) {
    window.jQuery.cookie(name, "", {
      expires: -1,
      path: (options && options.path) || "/",
    });
    return true;
  };
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
  const $sidebarAccounts = $("#sidebarAccounts");
  const $sidebarDashboard = $("#dashboard");
  const $sidebarBrand = $("#brand");
  const $sidebarCategory = $("#category");
  const $sidebarProduct = $("#product");

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
    $sidebarAccounts.hide();
    $sidebarDashboard.hide();
    $sidebarBrand.hide();
    $sidebarCategory.hide();
    $sidebarProduct.hide();
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

  // Hide account manage if seller or user
  if (role === "seller" || role === "user") {
    $sidebarAccounts.hide();
  } else {
    $sidebarAccounts.show();
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

  // Role-based access for admin dashboard
  if (role === "admin" || role === "seller") {
    $adminDashboard.show();
  } else {
    $adminDashboard.hide();
  }
}

// =======================================
// Helpers
// =======================================
function isAdminView() {
  return role === "admin" || role === "seller";
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function formatStatusLabel(status) {
  if (!status) return "N/A";
  return String(status).replace(/_/g, " ").toUpperCase();
}

function mapStatusToSelectValue(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "processing" || normalized === "to_ship") {
    return "to ship";
  }
  if (normalized === "pending_payment") {
    return "pending";
  }
  return normalized.replace(/_/g, " ");
}

function formatCurrency(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return String(amount || "0");
  return num.toFixed(2);
}

function formatDate(value) {
  if (!value) return "N/A";
  const str = String(value);
  if (!/\d{4}/.test(str)) return str;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatAddress(order = {}, user = {}) {
  const parts = [
    order.purok,
    order.barangay,
    order.city,
    order.province,
  ].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return order.address || user.address || "N/A";
}

function resolveImageSrc(image) {
  if (!image) return "assets/img/back.jpg";
  const src = String(image);
  if (/^(https?:)?\/\//i.test(src)) return src;
  if (src.startsWith("/")) return `${ip}${src}`;
  if (src.includes("assets/")) return `${ip}/${src.replace(/^\/+/, "")}`;
  return `${ip}/FrontEnd/assets/img/product/${src}`;
}

function getOrderItems(order, itemsOverride) {
  const rawItems = itemsOverride || order.items || [];
  return rawItems.map((item) => {
    const product = item.product || {};
    const productName =
      item.product_name || product.product_name || "Unknown Product";
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price || product.product_price || 0);
    const subtotal = Number(
      item.subtotal || (quantity && price ? quantity * price : 0),
    );
    const image = item.image || product.image || null;

    return { productName, quantity, price, subtotal, image };
  });
}

function getItemSellerName(item = {}, order = {}) {
  return (
    item?.product?.seller?.username ||
    item?.seller?.username ||
    item?.seller_username ||
    item?.seller_name ||
    order?.seller?.username ||
    order?.seller?.fullname ||
    order?.seller_username ||
    order?.seller_name ||
    order?.shop_name ||
    "N/A"
  );
}

function getItemSubtotalValue(item) {
  const quantity = Number(item?.quantity || item?.qty || 0);
  const price = Number(item?.price || item?.product?.product_price || 0);
  const rawSubtotal = item?.subtotal;
  const subtotal = Number(
    rawSubtotal !== undefined && rawSubtotal !== null && rawSubtotal !== ""
      ? rawSubtotal
      : quantity * price,
  );
  return Number.isFinite(subtotal) ? subtotal : 0;
}

function getItemQuantityValue(item) {
  const quantity = Number(item?.quantity || item?.qty || 0);
  return Number.isFinite(quantity) ? quantity : 0;
}

function sumItemsTotal(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + getItemSubtotalValue(item), 0);
}

function sumItemsQuantity(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + getItemQuantityValue(item), 0);
}

function getOrderQuantityFallback(order) {
  if (!order) return 0;
  const raw =
    order.total_quantity ||
    order.total_qty ||
    order.total_items ||
    order.quantity ||
    0;
  const qty = Number(raw);
  return Number.isFinite(qty) ? qty : 0;
}

function groupItemsBySeller(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (items.length === 0) {
    return [{ seller: getOrderSellerDisplayName(order), items: [] }];
  }

  const groups = new Map();
  items.forEach((item) => {
    const seller = getItemSellerName(item, order);
    if (!groups.has(seller)) {
      groups.set(seller, { seller, items: [] });
    }
    groups.get(seller).items.push(item);
  });

  return [...groups.values()];
}

function getOrderSellerDisplayName(order) {
  if (!order) return "N/A";

  const directSeller =
    order.seller?.username ||
    order.seller?.fullname ||
    order.seller_username ||
    order.seller_name ||
    order.shop_name;

  if (directSeller) return directSeller;

  const items = order.items || [];
  if (Array.isArray(items) && items.length > 0) {
    const sellerSet = new Set(
      items
        .map(
          (item) =>
            item?.product?.seller?.username ||
            item?.seller?.username ||
            item?.seller_username ||
            item?.seller_name,
        )
        .filter(Boolean),
    );

    if (sellerSet.size > 0) {
      return [...sellerSet].join(", ");
    }
  }

  if (role === "seller" && usr) {
    return usr;
  }

  return "N/A";
}

function populateOrderDetails(order, itemsOverride) {
  const items = getOrderItems(order, itemsOverride);

  $("#summaryStatus").text(formatStatusLabel(order.status));
  $("#summaryDate").text(formatDate(order.created_at || order.updated_at));
  $("#summaryItems").text(items.length);
  const user = order.user || currentUserProfile || {};
  const customerName =
    order.customer_name || user.fullname || user.username || usr || "N/A";
  const email = order.email || user.email || "N/A";
  const address = formatAddress(order, user);
  $("#summaryCustomer").text(customerName);
  $("#summaryEmail").text(email);
  $("#summaryAddress").text(address);

  if (order.tracking_number) {
    $("#tracking").text(order.tracking_number);
  } else {
    $("#tracking").text("Not yet assigned");
  }

  let rows = "";
  let computedTotal = 0;
  items.forEach((item) => {
    computedTotal += Number(item.subtotal || item.quantity * item.price || 0);
    rows += `
      <tr>
        <td>
          <img src="${resolveImageSrc(item.image)}"
               onerror="this.src='assets/img/back.jpg'"
               style="width:70px; height:70px; object-fit:cover; border:1px solid #ddd;">
        </td>
        <td>${item.productName}</td>
        <td>${item.quantity}</td>
        <td>&#8369;${formatCurrency(item.price)}</td>
        <td>&#8369;${formatCurrency(item.subtotal)}</td>
      </tr>
    `;
  });

  $("#orderDetailsBody").html(rows);

  $("#orderTotal").text(formatCurrency(computedTotal));
}

// =======================================
// Order Management Logic
// =======================================
function fetchBuyerOrders() {
  console.log("Attempting to fetch orders...");
  const endpoint = isAdminView()
    ? `${ip}/api/checkout/all`
    : `${ip}/api/checkout/orders`;

  $.ajax({
    url: endpoint,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (res) {
      console.log("Buyer Orders:", res);
      const orders = isAdminView() ? res : res.data || res;
      globalOrders = Array.isArray(orders) ? orders : [];
      renderOrders("All");
    },
    error: function (err) {
      console.error("Error loading orders:", err);
      $("#buyerOrders").html(
        `<tr><td colspan="8" class="text-center text-danger py-4">Failed to load orders.</td></tr>`,
      );
    },
  });
}

// =======================================
// Render Orders Based on Status
// =======================================
function renderOrders(filter = "All") {
  const $table = $("#ordersTable");
  const $tbody = $("#buyerOrders");
  $tbody.empty();

  // Status Mapping
  const filterKey = normalizeStatus(filter || "all");
  const filteredOrders = (globalOrders || []).filter((o) => {
    const statusKey = normalizeStatus(o.status);
    switch (filterKey) {
      case "unpaid":
      case "pending":
      case "pending_payment":
        return statusKey === "pending" || statusKey === "pending_payment";

      case "to_ship":
      case "processing":
        return statusKey === "processing" || statusKey === "to_ship";

      case "shipped":
        return statusKey === "shipped";

      case "completed":
        return statusKey === "completed" || statusKey === "delivered";

      case "to_review":
        return statusKey === "completed" || statusKey === "delivered";

      case "all":
      default:
        return true; // "All"
    }
  });

  if ($.fn.DataTable && $.fn.DataTable.isDataTable($table)) {
    $table.DataTable().clear().destroy();
  }

  // No orders
  if (filteredOrders.length === 0) {
    $tbody.html(
      `<tr><td colspan="8" class="text-center text-muted py-4">No orders found.</td></tr>`,
    );
    return;
  }

  const canUpdateStatus = isAdminView();

  filteredOrders.forEach((order) => {
    const statusKey = normalizeStatus(order.status);
    const statusLabel = formatStatusLabel(order.status);
    const orderId = order.checkout_id || order.order_id || "N/A";
    const customer = isAdminView()
      ? order.user?.username ||
        order.user?.fullname ||
        order.customer_name ||
        (order.user_id ? `User #${order.user_id}` : "N/A")
      : usr || "N/A";
    const fallbackTotal = Number(order.total_amount || order.total || 0);
    const fallbackQuantity = getOrderQuantityFallback(order);
    const date = formatDate(order.created_at || order.updated_at);

    const safeStatus = String(order.status || "").replace(/'/g, "\\'");

    const actionButtons = [];
    actionButtons.push(`
      <button class="btn btn-info btn-sm "
        data-toggle="modal"
        data-target="#orderDetailsModal"
        data-id="${orderId}">
        <i class="fas fa-eye"></i> View
      </button>
    `);

    if (canUpdateStatus) {
      actionButtons.push(`
        <button class="btn btn-info btn-sm "
          data-toggle="modal"
          data-target="#updateStatusModal"
          onclick="openStatusModal(${orderId}, '${safeStatus}')">
          <i class="fas fa-edit"></i> Update Status
        </button>
      `);
    } else {
      if (statusKey === "pending" || statusKey === "pending_payment") {
        actionButtons.push(`
          <button class="btn btn-outline-danger btn-sm btn-cancel"
            data-id="${orderId}">
            Cancel
          </button>
        `);
      } else {
        actionButtons.push(
          `<button class="btn btn-secondary btn-sm" disabled>Cancel</button>`,
        );
      }
    }

    const sellerGroups = groupItemsBySeller(order);

    sellerGroups.forEach((group) => {
      const seller = group.seller || "N/A";
      const groupTotal = sumItemsTotal(group.items);
      const groupQuantity = sumItemsQuantity(group.items);
      const totalValue =
        group.items.length === 0
          ? fallbackTotal
          : groupTotal > 0
            ? groupTotal
            : sellerGroups.length === 1
              ? fallbackTotal
              : groupTotal;
      const quantityValue =
        group.items.length === 0
          ? fallbackQuantity
          : groupQuantity > 0
            ? groupQuantity
            : sellerGroups.length === 1
              ? fallbackQuantity
              : groupQuantity;

      const total = formatCurrency(totalValue);
      const quantity = quantityValue;

      const row = `
        <tr>
          <td>${orderId}</td>
          <td>${customer}</td>
          <td>${seller}</td>
          <td>${quantity}</td>
          <td>&#8369;${total}</td>
          <td>${statusLabel}</td>
          <td>${date}</td>
          <td class="text-center">${actionButtons.join("")}</td>
        </tr>
      `;

      $tbody.append(row);
    });
  });

  if ($.fn.DataTable) {
    ordersTable = $table.DataTable({
      pageLength: 10,
      lengthChange: false,
      responsive: true,
      columnDefs: [{ orderable: false, targets: -1 }],
    });
  }
}

// =======================================
// Update Status Modal Logic
// =======================================
function openStatusModal(orderId, currentStatus) {
  $("#statusOrderId").val(orderId);
  $("#newOrderStatus").val(mapStatusToSelectValue(currentStatus));
}

// =======================================
// Submit Status Update Logic
// =======================================
function submitOrderStatusUpdate() {
  const orderId = $("#statusOrderId").val();
  const newStatus = $("#newOrderStatus").val();

  $.ajax({
    url: `${ip}/api/checkout/orders/${orderId}/status`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    contentType: "application/json",
    data: JSON.stringify({ status: newStatus }),

    success: function () {
      Swal.fire("Updated!", "Order status updated.", "success");

      $("#updateStatusModal").modal("hide");

      fetchBuyerOrders();
    },

    error: function (xhr) {
      console.error(xhr);
      Swal.fire("Error", "Failed to update status.", "error");
    },
  });
}

// =======================================
// Order Details Modal Logic
// =======================================
function loadOrderDetails(orderId) {
  if (isAdminView()) {
    const order = (globalOrders || []).find(
      (o) => String(o.checkout_id) === String(orderId),
    );
    if (!order) {
      Swal.fire("Error", "Unable to load order details.", "error");
      return;
    }
    populateOrderDetails(order);
    return;
  }

  $.ajax({
    url: `${ip}/api/checkout/orders/${orderId}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (res) {
      console.log("Order Details:", res);
      const order = res.order || {};
      const items = res.items || order.items || [];
      populateOrderDetails(order, items);
    },
    error: function (xhr) {
      console.error(xhr);
      Swal.fire("Error", "Unable to load order details.", "error");
    },
  });
}

// =======================================
// Cancel Order Function
// =======================================
function cancelOrder(orderId) {
  $.ajax({
    url: `${ip}/api/checkout/orders/${orderId}/cancel`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (res) {
      Swal.fire("Order Cancelled!", "", "success");
      fetchBuyerOrders();
    },
    error: function (xhr) {
      console.error(xhr);
      Swal.fire("Error", "Unable to cancel order.", "error");
    },
  });
}

// =======================================
// Main Execution
// =======================================
$(document).ready(function () {
  load_user();
  fetchBuyerOrders();

  // Global AJAX handlers for loading indicator
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
        currentUserProfile = response || null;
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
        currentUserProfile = null;
        $("#navbarProfileImage").hide();
        $("#defaultProfileIcon").show();
      },
    });
  } else {
    console.error("No username found in cookie.");
  }

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
  // Tab Filtering Logic
  // -------------------------------
  document.querySelectorAll(".order-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelector(".order-tab-btn.active")
        .classList.remove("active");
      btn.classList.add("active");
      renderOrders(btn.dataset.status);
    });
  });

  // -------------------------------
  // Status Filter (Admin)
  // -------------------------------
  $("#statusFilter").on("change", function () {
    renderOrders($(this).val());
  });

  // -------------------------------
  // Cancel Button Logic
  // -------------------------------
  $(document).on("click", ".btn-cancel", function () {
    const orderId = $(this).data("id");

    Swal.fire({
      title: "Cancel Order?",
      text: "Are you sure you want to cancel this order?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, cancel it!",
    }).then((result) => {
      if (result.isConfirmed) {
        // Call API to update status to 'cancelled'
        cancelOrder(orderId);
      }
    });
  });

  // -------------------------------
  // View Order Details Modal Logic
  // -------------------------------
  $(document).on("click", "[data-target='#orderDetailsModal']", function () {
    const orderId = $(this).data("id");
    loadOrderDetails(orderId);
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
