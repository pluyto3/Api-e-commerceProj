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
  const $adminWorkingPanel = $("#adminWorkingPanel");
  const $userWorkingPanel = $("#userWorkingPanel");

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
    $adminWorkingPanel.hide();
    $userWorkingPanel.hide();
    return;
  }

  // Session exists → update UI
  $displayUsername.html(`<b>${usr}</b>`);
  $login.hide();
  $register.hide();
  $logout.show();

  const isRegularUser =
    !!usr && !!token && role !== "admin" && role !== "seller";

  // Match dashboard behavior: show cart for user/seller, hide for admin
  if (isRegularUser || role === "seller") {
    $cartCount.show();
    $cartNav.show();
    $cartNavMobile.show();
  } else {
    $cartCount.hide();
    $cartNav.hide();
    $cartNavMobile.hide();
  }

  // Hide account manage if seller or user
  if (role === "seller" || isRegularUser) {
    $sidebarAccounts.hide();
  } else {
    $sidebarAccounts.show();
  }

  // Hide specific sidebar menus for regular user
  if (isRegularUser) {
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

  if (isRegularUser) {
    $adminWorkingPanel.hide();
    $userWorkingPanel.show();
  } else {
    $adminWorkingPanel.show();
    $userWorkingPanel.hide();
  }
}

// =======================================
// Helpers
// =======================================
function isAdminView() {
  return role === "admin" || role === "seller";
}

function isUserView() {
  return !!usr && !!token && !isAdminView();
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

function toDateInputValue(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getOrderDateFilterValue(order = {}) {
  const explicitDate = String(order.created_date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
    return explicitDate;
  }

  const candidates = [
    order.created_at,
    order.createdAt,
    order.updated_at,
    order.updatedAt,
    order.date,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const normalizedDate = toDateInputValue(candidate);
    if (normalizedDate) {
      return normalizedDate;
    }
  }

  return "";
}

function formatAddress(order = {}, user = {}) {
  const parts = [
    order.purok,
    order.barangay,
    order.city,
    order.province,
    order.zipcode,
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
    getDirectItemSellerName(item) ||
    order?.seller?.username ||
    order?.seller?.fullname ||
    order?.seller_username ||
    order?.seller_name ||
    order?.shop_name ||
    "N/A"
  );
}

function getDirectItemSellerName(item = {}) {
  return (
    item?.product?.seller?.username ||
    item?.seller?.username ||
    item?.seller_username ||
    item?.seller_name ||
    ""
  );
}

function splitSellerNames(value) {
  if (!value) return [];

  return String(value)
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && name.toUpperCase() !== "N/A");
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
    order.item_count ||
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
  const sellerNames = getOrderSellerNames(order);
  return sellerNames.length ? sellerNames.join(", ") : "N/A";
}

function getOrderSellerNames(order) {
  if (!order) return [];

  const sellerSet = new Set();
  const items = Array.isArray(order.items) ? order.items : [];

  items.forEach((item) => {
    splitSellerNames(getDirectItemSellerName(item)).forEach((seller) =>
      sellerSet.add(seller),
    );
  });

  if (sellerSet.size > 0) {
    return [...sellerSet];
  }

  [
    order.seller?.username,
    order.seller?.fullname,
    order.seller_username,
    order.seller_name,
    order.shop_name,
  ].forEach((sellerValue) => {
    splitSellerNames(sellerValue).forEach((seller) => sellerSet.add(seller));
  });

  if (sellerSet.size > 0) {
    return [...sellerSet];
  }

  if (role === "seller" && usr) {
    return [usr];
  }

  return [];
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

function getUserOrderQuantity(order) {
  const itemsQuantity = sumItemsQuantity(order?.items);
  if (itemsQuantity > 0) return itemsQuantity;
  return getOrderQuantityFallback(order);
}

function getUserOrderTotal(order) {
  const fallbackTotal = Number(order?.total_amount || order?.total || 0);
  const itemsTotal = sumItemsTotal(order?.items);
  if (Number.isFinite(fallbackTotal) && fallbackTotal > 0) {
    return fallbackTotal;
  }
  return itemsTotal;
}

function populateUserSellerFilter() {
  const $sellerFilter = $("#userSellerFilter");
  if ($sellerFilter.length === 0) return;

  const previousValue = $sellerFilter.val() || "";
  const sellerSet = new Set();

  (globalOrders || []).forEach((order) => {
    getOrderSellerNames(order).forEach((seller) => sellerSet.add(seller));
  });

  const sellers = [...sellerSet].sort((a, b) => a.localeCompare(b));

  $sellerFilter.html(`<option value="">Filter by Seller</option>`);

  sellers.forEach((seller) => {
    $sellerFilter.append(`<option value="${seller}">${seller}</option>`);
  });

  if (sellers.includes(previousValue)) {
    $sellerFilter.val(previousValue);
  }
}

function renderUserOrders() {
  const $container = $("#userOrderListCards");
  $container.empty();

  if (!globalOrders || globalOrders.length === 0) {
    $container.html(
      `<div class="text-center text-muted py-5">No orders found.</div>`,
    );
    return;
  }

  globalOrders.forEach((order, index) => {
    const orderId = order.checkout_id || order.order_id || "N/A";
    const seller = getOrderSellerDisplayName(order);
    const total = formatCurrency(getUserOrderTotal(order));
    const statusLabel = formatStatusLabel(order.status).toLowerCase();
    const date = formatDate(order.created_at || order.updated_at);
    const tracking = order.tracking_number || "Not available";
    const items = getOrderItems(order);

    // Color Logic
    const statusClass =
      statusLabel === "completed" ? "bg-completed" : "bg-pending";
    const collapseId = `collapseOrder${orderId}`;

    let itemsHtml = items
      .map(
        (item) => `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="text-secondary">${item.productName} (x${item.quantity})</div>
        <div class="fw-bold">₱${formatCurrency(item.subtotal)}</div>
      </div>
    `,
      )
      .join("");

    $container.append(`
      <div class="order-card mb-3">
        <div class="order-header d-flex justify-content-between align-items-center" 
             data-bs-toggle="collapse" 
             data-bs-target="#${collapseId}" 
             style="cursor: pointer;">
          
          <div class="d-flex flex-column">
            <span class="fw-bold h5 mb-0">Order #${orderId}</span>
            <small class="text-muted">${seller}</small>
          </div>

          <div class="d-flex align-items-center gap-4">
            <div class="text-end">
              <div class="fw-bold h5 mb-1">₱${total}</div>
              <span class="status-badge ${statusClass}">${statusLabel}</span>
            </div>
            <i class="fas fa-chevron-down text-muted small"></i>
          </div>
        </div>

        <div class="collapse" id="${collapseId}">
          <div class="order-body border-top p-3">
            <div class="mb-3">${itemsHtml}</div>
            <div class="small text-muted mb-3">
              <div>Date: ${date}</div>
              <div>Tracking: ${tracking}</div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-dark btn-sm rounded-2 px-3" data-toggle="modal" data-target="#orderDetailsModal" data-id="${orderId}">
                View Details
              </button>
              ${
                statusLabel === "pending"
                  ? `
                <button class="btn btn-danger btn-sm rounded-2 px-3 btn-cancel" data-id="${orderId}">
                  Cancel
                </button>`
                  : ""
              }
            </div>
          </div>
        </div>
      </div>
    `);
  });
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

      if (isAdminView()) {
        renderOrders($("#statusFilter").val() || "all");
      } else if (isUserView()) {
        populateUserSellerFilter();
        renderUserOrders();
      }
    },
    error: function (err) {
      console.error("Error loading orders:", err);
      const errorRow = `<tr><td colspan="8" class="text-center text-danger py-4">Failed to load orders.</td></tr>`;

      if (isAdminView()) {
        $("#buyerOrders").html(errorRow);
      } else {
        $("#userOrderListBody").html(errorRow);
      }
    },
  });
}

// =======================================
// Render Orders Based on Status
// =======================================
function renderOrders(filter = "All") {
  if (!isAdminView()) {
    return;
  }

  const $table = $("#ordersTable");
  const $tbody = $("#buyerOrders");
  const selectedDate = ($("#adminDateFilter").val() || "").trim();
  $tbody.empty();

  // Status Mapping
  const filterKey = normalizeStatus(filter || "all");
  const filteredOrders = (globalOrders || []).filter((o) => {
    const dateMatches =
      !selectedDate || getOrderDateFilterValue(o) === selectedDate;

    if (!dateMatches) {
      return false;
    }

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

  $("#adminDateFilter").on("change", function () {
    renderOrders($("#statusFilter").val());
  });

  $("#userSellerFilter").on("change", function () {
    renderUserOrders();
  });

  $("#userDateFilter").on("change", function () {
    renderUserOrders();
  });

  $("#userOrderSearch").on("input", function () {
    renderUserOrders();
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
          window.location.replace("login.html");
        });
      },
      error: (res) => {
        const msg = res.responseJSON?.msg || "Logout failed. Please try again.";
        Swal.fire({ icon: "error", title: "Error", text: msg });
      },
    });
  });
});
