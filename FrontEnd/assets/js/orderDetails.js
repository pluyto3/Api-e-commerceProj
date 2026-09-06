/* ================================
   GLOBAL VARIABLES
================================ */
if (!window.APP_CONFIG?.API_BASE_URL) {
  throw new Error(
    "APP_CONFIG is missing. Load config.js before orderDetails.js.",
  );
}

const ip = window.APP_CONFIG.API_BASE_URL;

let token = null;
let usr = null;
let role = null;
let profileImage = null;
let globalOrders = [];
let ordersTable = null;
let currentUserProfile = null;
let currentUserId = null;
let currentSellerOrderView = "sales";
let activeUserUrlFilter = "";

// =======================================
// User Session Handling
// =======================================
function load_user() {
  usr = $.cookie("username");
  token = $.cookie("token");
  role = String($.cookie("role") || "").toLowerCase();
  profileImage = $.cookie("profileImage");
  currentUserId = $.cookie("user_id") || currentUserId;

  // DOM elements
  const $displayUsername = $("#displayUsername");
  const $login = $("#login");
  const $register = $("#register");
  const $logout = $("#logout");
  const $cartCount = $("#cart-count");
  const $cartNav = $("#cartNav");
  const $cartNavMobile = $("#cartNavMobile");
  const $adminDashboard = $("#adminDashboard");
  const $productUi = $("#productUi");
  const $registerHint = $("#registerHint");
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");
  const $sidebarAccounts = $("#sidebarAccounts");
  const $sidebarDashboard = $("#dashboard");
  const $sidebarBrand = $("#brand");
  const $sidebarCategory = $("#category");
  const $sidebarProduct = $("#product");
  const $adminWorkingPanel = $("#adminWorkingPanel");
  const $userWorkingPanel = $("#userWorkingPanel");
  const $sellerOrderViewSwitcher = $(".seller-order-view-switcher");

  // No session → show login/register
  if (!usr || !token) {
    $displayUsername.html("My Account");
    $login.show();
    $register.show();
    $logout.hide();
    $registerHint.show();
    $cartCount.hide();
    $cartNav.hide();
    $cartNavMobile.hide();
    $adminDashboard.hide();
    $productUi.hide();
    $navbarProfileImage.hide();
    $defaultProfileIcon.show();
    $sidebarAccounts.hide();
    $sidebarDashboard.hide();
    $sidebarBrand.hide();
    $sidebarCategory.hide();
    $sidebarProduct.hide();
    $adminWorkingPanel.hide();
    $userWorkingPanel.hide();
    $sellerOrderViewSwitcher.hide();
    return;
  }

  // Session exists → update UI
  $displayUsername.html(`<b>${usr}</b>`);
  $login.hide();
  $register.hide();
  $logout.show();
  $registerHint.hide();

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
    $productUi.show();
  } else {
    $adminDashboard.hide();
    $productUi.hide();
  }

  applySellerOrderView();

  if (role === "seller") {
    return;
  }

  if (isRegularUser) {
    $adminWorkingPanel.hide();
    $userWorkingPanel.show();
    $("#userWorkingPanel h1").text("My Orders");
  } else {
    $adminWorkingPanel.show();
    $userWorkingPanel.hide();
  }
}

// =======================================
// Helpers
// =======================================
function isAdminView() {
  return role === "admin" || isSellerSalesView();
}

function isSellerView() {
  return role === "seller";
}

function isSellerSalesView() {
  return isSellerView() && currentSellerOrderView === "sales";
}

function isSellerPurchasesView() {
  return isSellerView() && currentSellerOrderView === "purchases";
}

function isUserView() {
  return !!usr && !!token && (isSellerPurchasesView() || !isAdminView());
}

function getOrderDetailsUrlParams() {
  return new URLSearchParams(window.location.search || "");
}

function initializeUserOrderUrlFilters() {
  const params = getOrderDetailsUrlParams();
  const requestedStatus = normalizeStatus(params.get("status"));
  const requestedFilter = normalizeStatus(params.get("filter"));
  const validStatuses = [
    "all",
    "pending",
    "pending_payment",
    "packed",
    "processing",
    "to_ship",
    "shipped",
    "delivered",
    "completed",
    "cancelled",
  ];

  activeUserUrlFilter = ["payment", "tracking"].includes(requestedFilter)
    ? requestedFilter
    : "";

  if (requestedStatus && validStatuses.includes(requestedStatus)) {
    const statusTab = getMainOrderStatus(requestedStatus);
    $(".order-status-tabs .nav-link").removeClass("active");
    $(`.order-status-tabs .nav-link[data-status="${statusTab}"]`).addClass(
      "active",
    );
  }

  if (role === "seller" && (activeUserUrlFilter || requestedStatus)) {
    currentSellerOrderView = "purchases";
  }
}

function applySellerOrderView() {
  const $switcher = $(".seller-order-view-switcher");
  const $adminWorkingPanel = $("#adminWorkingPanel");
  const $userWorkingPanel = $("#userWorkingPanel");

  if (!isSellerView()) {
    $switcher.hide();
    return;
  }

  $switcher.show();
  $(".seller-order-view-btn")
    .removeClass("active btn-dark")
    .addClass("btn-outline-dark");
  $(`.seller-order-view-btn[data-view="${currentSellerOrderView}"]`)
    .addClass("active btn-dark")
    .removeClass("btn-outline-dark");

  if (isSellerPurchasesView()) {
    $adminWorkingPanel.hide();
    $userWorkingPanel.show();
    $("#userWorkingPanel h1").text("My Purchases");
  } else {
    $adminWorkingPanel.show();
    $userWorkingPanel.hide();
  }
}

function getLoggedInUserId() {
  return currentUserId || $.cookie("user_id") || null;
}

function valuesMatch(left, right) {
  if (
    left === undefined ||
    left === null ||
    right === undefined ||
    right === null
  ) {
    return false;
  }

  return String(left).trim() === String(right).trim();
}

function namesMatch(left, right) {
  if (!left || !right) return false;

  return (
    String(left).trim().toLowerCase() === String(right).trim().toLowerCase()
  );
}

function extractApiErrorMessage(xhr, fallback = "Something went wrong.") {
  const response = xhr?.responseJSON || {};

  if (typeof response.msg === "string" && response.msg.trim()) {
    return response.msg.trim();
  }

  if (typeof response.message === "string" && response.message.trim()) {
    return response.message.trim();
  }

  if (response.errors && typeof response.errors === "object") {
    const firstError = Object.values(response.errors).flat().find(Boolean);

    if (firstError) {
      return String(firstError);
    }
  }

  return fallback;
}

function isItemForLoggedInSeller(item = {}) {
  if (!isSellerSalesView()) return true;

  const sellerId = getLoggedInUserId();
  const sellerIdCandidates = [
    item.seller_id,
    item.seller?.user_id,
    item.seller?.id,
    item.product?.seller_id,
    item.product?.seller?.user_id,
    item.product?.seller?.id,
  ];
  const sellerNameCandidates = [
    item.seller_username,
    item.seller_name,
    item.seller?.username,
    item.product?.seller_username,
    item.product?.seller?.username,
  ];

  if (
    sellerId &&
    sellerIdCandidates.some((candidate) => valuesMatch(candidate, sellerId))
  ) {
    return true;
  }

  if (
    usr &&
    sellerNameCandidates.some((candidate) => namesMatch(candidate, usr))
  ) {
    return true;
  }

  // Match backend seller authorization: seller access is based on checkout_items.seller_id.
  // If the client does not have the current seller id cookie, trust the already
  // seller-filtered payload returned by `/api/checkout/all`.
  return !sellerId;
}

function getVisibleOrderItems(order = {}, itemsOverride) {
  const rawItems = itemsOverride || order.items || [];
  if (!Array.isArray(rawItems)) return [];

  return isSellerSalesView()
    ? rawItems.filter(isItemForLoggedInSeller)
    : rawItems;
}

function isOrderForLoggedInSeller(order = {}) {
  if (!isSellerSalesView()) return true;

  const visibleItems = getVisibleOrderItems(order);
  if (visibleItems.length > 0) {
    return true;
  }

  return (
    !getLoggedInUserId() &&
    Array.isArray(order?.items) &&
    order.items.length > 0
  );
}

function filterOrdersForCurrentRole(orders = []) {
  const normalizedOrders = Array.isArray(orders) ? orders : [];

  if (isUserView()) {
    return filterOrdersForLoggedInUser(normalizedOrders);
  }

  if (isSellerSalesView()) {
    return normalizedOrders.filter(isOrderForLoggedInSeller);
  }

  return normalizedOrders;
}

function filterOrdersForLoggedInUser(orders = []) {
  if (!isUserView()) return Array.isArray(orders) ? orders : [];

  return (Array.isArray(orders) ? orders : []).filter((order) => {
    const orderUserId = order?.user_id || order?.user?.user_id || null;
    const orderUsername = order?.user?.username || "";

    if (currentUserId && orderUserId) {
      return String(orderUserId) === String(currentUserId);
    }

    if (usr && orderUsername) {
      return String(orderUsername).toLowerCase() === String(usr).toLowerCase();
    }

    // If the backend already returned only the logged-in user's orders,
    // keep the record rather than hiding valid results.
    return true;
  });
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

function formatStatusText(status) {
  if (!status) return "N/A";
  return String(status)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapStatusToSelectValue(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "processing" || normalized === "to_ship") {
    return "packed";
  }
  if (normalized === "pending_payment") {
    return "pending";
  }
  if (normalized === "completed") {
    return "delivered";
  }
  return normalized.replace(/_/g, " ");
}

function getMainOrderStatus(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "processing" || normalized === "to_ship") return "packed";
  if (normalized === "completed") return "delivered";
  if (normalized === "pending_payment") return "pending";
  if (
    ["pending", "packed", "shipped", "delivered", "cancelled"].includes(
      normalized,
    )
  ) {
    return normalized;
  }

  return "pending";
}

function isFinalOrderStatus(status) {
  const mainStatus = getMainOrderStatus(status);
  return mainStatus === "delivered" || mainStatus === "cancelled";
}

function canCancelOrder(status) {
  return getMainOrderStatus(status) === "pending";
}

function canEditTrackingForStatus(status) {
  const mainStatus = getMainOrderStatus(status);
  return mainStatus === "packed" || mainStatus === "shipped";
}

function getStatusBadgeClass(status) {
  const mainStatus = getMainOrderStatus(status);
  if (mainStatus === "packed") return "status-processing";
  if (mainStatus === "shipped") return "status-shipped";
  if (mainStatus === "delivered") return "status-delivered";
  if (mainStatus === "cancelled") return "status-cancelled";
  return "status-pending";
}

function getPaymentBadgeClass(status) {
  const normalized = normalizeStatus(status || "pending");
  if (normalized === "paid") return "status-delivered";
  if (normalized === "failed" || normalized === "cancelled") {
    return "status-cancelled";
  }
  return "status-pending";
}

function renderStatusBadge(status, type = "order") {
  const label = formatStatusLabel(getMainOrderStatus(status));
  const badgeClass =
    type === "payment"
      ? getPaymentBadgeClass(status)
      : getStatusBadgeClass(status);

  return `<span class="order-status-badge ${badgeClass}">${label}</span>`;
}

function renderPaymentBadge(status) {
  const label = formatStatusLabel(status || "pending");
  return `<span class="order-status-badge ${getPaymentBadgeClass(status)}">${label}</span>`;
}

function hasPaymentUpdate(order = {}) {
  const paymentStatus = normalizeStatus(order.payment_status);
  return Boolean(paymentStatus && paymentStatus !== "pending");
}

function getOrderTrackingNumber(order = {}) {
  return (
    order.tracking_number ||
    order.tracking_no ||
    order.trackingCode ||
    order.tracking_code ||
    order.tracking?.number ||
    order.tracking?.tracking_number ||
    ""
  );
}

function getOrderCourier(order = {}) {
  return (
    order.courier ||
    order.courier_name ||
    order.shipping_courier ||
    order.delivery_courier ||
    order.tracking?.courier ||
    order.tracking?.courier_name ||
    ""
  );
}

function getOrderShippingDate(order = {}) {
  return (
    order.delivery_date ||
    order.delivered_at ||
    order.shipping_date ||
    order.shipped_at ||
    order.tracking?.delivery_date ||
    order.tracking?.shipped_at ||
    ""
  );
}

function hasTrackingInfo(order = {}) {
  return Boolean(
    String(getOrderTrackingNumber(order) || "").trim() ||
    String(getOrderCourier(order) || "").trim(),
  );
}

function matchesUserUrlFilter(order = {}) {
  if (activeUserUrlFilter === "payment") {
    return hasPaymentUpdate(order);
  }

  if (activeUserUrlFilter === "tracking") {
    return hasTrackingInfo(order);
  }

  return true;
}

function renderOrderTimeline(status) {
  const mainStatus = getMainOrderStatus(status);
  const steps = ["pending", "packed", "shipped", "delivered"];

  if (mainStatus === "cancelled") {
    return `
      <div class="order-status-timeline is-cancelled">
        <div class="order-status-timeline-step is-active is-cancelled">
          <span class="order-status-timeline-dot"><i class="fas fa-ban"></i></span>
          <span class="order-status-timeline-label">Cancelled</span>
        </div>
      </div>
    `;
  }

  const activeIndex = Math.max(steps.indexOf(mainStatus), 0);

  return `
    <div class="order-status-timeline">
      ${steps
        .map((step, index) => {
          const stateClass =
            index < activeIndex
              ? "is-complete"
              : index === activeIndex
                ? "is-active"
                : "";

          return `
            <div class="order-status-timeline-step ${stateClass}">
              <span class="order-status-timeline-dot">${index + 1}</span>
              <span class="order-status-timeline-label">${formatStatusLabel(step)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
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
  const rawItems = getVisibleOrderItems(order, itemsOverride);
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
  const items = getVisibleOrderItems(order);
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
  const items = getVisibleOrderItems(order);

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

  if (isSellerSalesView() && usr) {
    return [usr];
  }

  return [];
}

// =======================================
// Order Details Rendering
// =======================================
function populateOrderDetails(order, itemsOverride, viewOptions = {}) {
  const items = getOrderItems(order, itemsOverride);
  const orderId = order.checkout_id || order.order_id || "N/A";

  const shippingStatus = getMainOrderStatus(
    viewOptions.shippingStatus || order.shipping_status || order.status,
  );

  const paymentStatus = order.payment_status || "pending";

  const modalTitle = viewOptions.sellerName
    ? `Items from ${viewOptions.sellerName}`
    : `Order Details`;

  $("#orderDetailsModal .modal-title").text(modalTitle);

  $("#summaryOrderId").text(orderId);
  $("#summaryStatus").html(renderStatusBadge(shippingStatus));
  $("#summaryPaymentStatus").html(renderPaymentBadge(paymentStatus));
  $("#summaryPaymentMethod").text(
    formatStatusLabel(order.payment_method || "N/A"),
  );
  $("#summaryDate").text(formatDate(order.created_at || order.updated_at));
  $("#summaryItems").text(items.length);
  $("#orderStatusTimeline").html(renderOrderTimeline(shippingStatus));

  const user = order.user || currentUserProfile || {};
  const customerName =
    order.customer_name || user.fullname || user.username || usr || "N/A";
  const email = order.email || user.email || "N/A";
  const phone = order.phone_number || user.phone_number || "N/A";
  const address = formatAddress(order, user);

  $("#summaryCustomer").text(customerName);
  $("#summaryContact").html(`
    <div>${email}</div>
    <div class="order-details-meta">${phone}</div>
  `);
  $("#summaryAddress").text(address);

  const trackingNumber =
    viewOptions.trackingNumber || getOrderTrackingNumber(order);

  if (trackingNumber) {
    $("#tracking").removeClass("is-empty").text(trackingNumber);
  } else {
    $("#tracking").addClass("is-empty").text("Not yet assigned");
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
               class="order-details-product-image">
        </td>
        <td><span class="order-details-product-name">${item.productName}</span></td>
        <td class="text-center"><span class="order-details-qty">${item.quantity}</span></td>
        <td><span class="order-details-price">&#8369;${formatCurrency(item.price)}</span></td>
        <td><span class="order-details-subtotal">&#8369;${formatCurrency(item.subtotal)}</span></td>
      </tr>
    `;
  });

  $("#orderDetailsBody").html(
    rows ||
      `<tr><td colspan="5" class="order-details-empty text-center">No products found for this order.</td></tr>`,
  );

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

function getUserStatusBadgeClass(statusLabel) {
  const normalized = getMainOrderStatus(statusLabel);

  if (normalized === "delivered") return "status-completed";
  if (normalized === "packed") return "status-shipped";
  if (normalized === "shipped") return "status-shipped";
  if (normalized === "cancelled") return "status-cancelled";
  return "status-pending";
}

function getActiveUserStatusFilter() {
  return $(".order-status-tabs .nav-link.active").data("status") || "all";
}

function matchesUserStatusFilter(order, filterValue) {
  const selectedFilter = normalizeStatus(filterValue || "all");
  const orderStatus = getMainOrderStatus(
    order?.shipping_status || order?.status,
  );

  switch (selectedFilter) {
    case "pending":
    case "pending_payment":
      return orderStatus === "pending";
    case "to_ship":
    case "to-ship":
    case "processing":
    case "packed":
      return orderStatus === "packed";
    case "shipped":
      return orderStatus === "shipped";
    case "completed":
    case "delivered":
      return orderStatus === "delivered";
    case "cancelled":
      return orderStatus === "cancelled";
    case "all":
    default:
      return true;
  }
}

function getUserOrderSearchText(order) {
  const orderId = order?.checkout_id || order?.order_id || "N/A";
  const sellerDisplay = getOrderSellerDisplayName(order);
  const sellerNames = getOrderSellerNames(order).join(" ");
  const tracking = getOrderTrackingNumber(order) || "Not available";
  const courier = getOrderCourier(order) || "";
  const shippingDate = getOrderShippingDate(order) || "";
  const items = getOrderItems(order);
  const itemNames = items.map((item) => item.productName).join(" ");
  const headerTitle =
    items.length > 0
      ? `${items[0].productName}${items.length > 1 ? ` +${items.length - 1} more` : ""}`
      : `Order #${orderId}`;
  const total = formatCurrency(getUserOrderTotal(order));
  const rawTotal = Number(order?.total_amount || order?.total || 0);
  const rawDate = order?.created_at || order?.updated_at || "";
  const formattedDate = formatDate(rawDate);
  const filterDate = getOrderDateFilterValue(order);
  const formattedStatus = formatStatusLabel(
    order?.shipping_status || order?.status,
  );
  const formattedPaymentStatus = formatStatusLabel(order?.payment_status);

  return [
    orderId,
    `order #${orderId}`,
    `order ${orderId}`,
    headerTitle,
    sellerDisplay,
    sellerNames,
    tracking,
    courier,
    shippingDate,
    order?.shipping_status || order?.status || "",
    order?.payment_status || "",
    formattedStatus,
    formattedPaymentStatus,
    itemNames,
    total,
    rawTotal,
    rawDate,
    formattedDate,
    filterDate,
  ]
    .join(" ")
    .toLowerCase();
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

// =======================================
// Render User Orders
// =======================================
function renderUserOrders() {
  const $container = $("#userOrderListCards");
  $container.empty();

  if (!globalOrders || globalOrders.length === 0) {
    $container.html(
      `<div class="text-center text-muted py-5">No orders found.</div>`,
    );
    return;
  }

  const selectedSeller = ($("#userSellerFilter").val() || "").trim();
  const selectedDate = ($("#userDateFilter").val() || "").trim();
  const searchTerm = ($("#userOrderSearch").val() || "").trim().toLowerCase();
  const activeStatus = getActiveUserStatusFilter();

  let renderedCardCount = 0;

  (globalOrders || []).forEach((order) => {
    const orderId = order.checkout_id || order.order_id || "N/A";
    const dateValue = getOrderDateFilterValue(order);

    if (selectedDate && dateValue !== selectedDate) {
      return;
    }

    const sellerGroups = groupItemsBySeller(order);

    const allSellerGroupsPending = sellerGroups.every((group) => {
      const groupSellerId = getSellerIdForGroup(order, group);
      const sellerOrder = getSellerOrderForGroup(order, groupSellerId);

      const groupStatusKey = getMainOrderStatus(
        sellerOrder?.shipping_status || order.shipping_status || order.status,
      );

      return groupStatusKey === "pending";
    });

    const parentStatusKey = getMainOrderStatus(
      order.shipping_status || order.status,
    );

    sellerGroups.forEach((group, index) => {
      const seller = group.seller || "N/A";

      if (selectedSeller && seller !== selectedSeller) {
        return;
      }

      const groupSellerId = getSellerIdForGroup(order, group);
      const sellerOrder = getSellerOrderForGroup(order, groupSellerId);

      const groupStatusKey = getMainOrderStatus(
        sellerOrder?.shipping_status || order.shipping_status || order.status,
      );

      if (!doesStatusMatchFilter(groupStatusKey, activeStatus)) {
        return;
      }

      const sellerItems =
        group.items && group.items.length > 0
          ? group.items
          : getItemsForSellerGroup(order, groupSellerId, seller);

      const items = getOrderItems(order, sellerItems);

      const groupTotal = sumItemsTotal(sellerItems);
      const sellerOrderTotal = Number(
        sellerOrder?.subtotal ||
          sellerOrder?.total ||
          sellerOrder?.total_amount ||
          0,
      );

      const totalValue =
        groupTotal > 0
          ? groupTotal
          : sellerOrderTotal > 0
            ? sellerOrderTotal
            : sellerGroups.length === 1
              ? getUserOrderTotal(order)
              : 0;

      const total = formatCurrency(totalValue);

      const statusLabel = formatStatusLabel(groupStatusKey).toLowerCase();
      const statusDisplayLabel = formatStatusText(groupStatusKey);
      const paymentDisplayLabel = formatStatusText(
        order.payment_status || "pending",
      );

      const date = formatDate(order.created_at || order.updated_at);

      const tracking =
        getSellerTrackingNumber(order, sellerOrder) || "Not available";

      const courier =
        sellerOrder?.courier ||
        sellerOrder?.courier_name ||
        getOrderCourier(order) ||
        "Not available";

      const shippingDate =
        sellerOrder?.delivery_date ||
        sellerOrder?.delivered_at ||
        sellerOrder?.shipping_date ||
        sellerOrder?.shipped_at ||
        getOrderShippingDate(order);

      const deliveryDate = shippingDate
        ? formatDate(shippingDate)
        : "Not available";

      const headerTitle =
        items.length > 0
          ? `${items[0].productName}${items.length > 1 ? ` +${items.length - 1} more` : ""}`
          : `Order #${orderId}`;

      const headerImage =
        items.length > 0
          ? resolveImageSrc(items[0].image)
          : "assets/img/back.jpg";

      const statusClass = getUserStatusBadgeClass(groupStatusKey);
      const safeSellerName = escapeHtmlAttribute(seller);
      const safeStatus = String(groupStatusKey).replace(/'/g, "\\'");
      const collapseId = `collapseOrder${orderId}_${String(groupSellerId || index).replace(/\W/g, "_")}`;

      const searchHaystack = [
        orderId,
        `order #${orderId}`,
        seller,
        groupStatusKey,
        statusDisplayLabel,
        order.payment_status || "",
        paymentDisplayLabel,
        tracking,
        courier,
        date,
        total,
        items.map((item) => item.productName).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      if (searchTerm && !searchHaystack.includes(searchTerm)) {
        return;
      }

      const hasSellerTracking =
        tracking && tracking !== "Not available" && tracking.trim() !== "";

      const urlFilterMatches =
        activeUserUrlFilter === "payment"
          ? hasPaymentUpdate(order)
          : activeUserUrlFilter === "tracking"
            ? hasSellerTracking
            : true;

      if (!urlFilterMatches) {
        return;
      }

      const itemsHtml = items
        .map(
          (item) => `
        <div class="order-item-row d-flex justify-content-between align-items-center">
          <div class="order-item-name text-dark">${item.productName} (x${item.quantity})</div>
          <div class="order-item-price">₱${formatCurrency(item.subtotal)}</div>
        </div>
      `,
        )
        .join("");

      $container.append(`
        <div class="order-card mb-3">
          <div class="order-header d-flex align-items-start"
               data-toggle="collapse"
               data-target="#${collapseId}"
               style="cursor: pointer;">
            <div class="order-header-product d-flex align-items-center">
              <img
                src="${headerImage}"
                alt="${headerTitle}"
                class="order-header-thumb"
                onerror="this.onerror=null;this.src='assets/img/back.jpg';" />
              <div class="order-header-meta d-flex flex-column">
                <span class="order-card-title">${headerTitle}</span>
                <small class="order-card-seller text-muted">
                  Sold by ${seller}
                </small>
              </div>
            </div>

            <div class="order-header-summary text-center">
              <div class="order-card-total">₱${total}</div>
              <span class="status-badge ${statusClass}">${statusLabel}</span>
            </div>

            <div class="order-header-icon">
              <i class="fas fa-chevron-down order-chevron" aria-hidden="true"></i>
            </div>
          </div>

          <div class="collapse" id="${collapseId}">
            <div class="order-body">
              <div class="order-body-divider"></div>
              <div class="order-items-list">${itemsHtml}</div>

              <div class="order-card-footer d-flex flex-column flex-md-row justify-content-between align-items-start">
                <div class="small text-muted order-card-meta mb-3 mb-md-0">
                  <div>Order ID: #${orderId}</div>
                  <div>Seller: ${seller}</div>
                  <div>Date: ${date}</div>
                  <div>Payment Status: ${paymentDisplayLabel}</div>
                  <div>Tracking Number: ${tracking}</div>
                  <div>Courier: ${courier}</div>
                  <div>Order Status: ${statusDisplayLabel}</div>
                  <div>Delivery/Shipping Date: ${deliveryDate}</div>
                </div>

                <div class="d-flex">
                  <button
                    class="btn btn-dark btn-sm rounded px-3 mr-2 btn-view-order"
                    data-order-id="${orderId}"
                    data-seller-id="${groupSellerId}"
                    data-seller-name="${safeSellerName}"
                    data-current-status="${safeStatus}">
                    View Details
                  </button>

                  ${
                    canCancelOrder(parentStatusKey) && allSellerGroupsPending
                      ? `
                    <button class="btn btn-danger btn-sm rounded px-3 btn-cancel" data-id="${orderId}">
                      Cancel Order
                    </button>`
                      : ""
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      `);

      renderedCardCount++;
    });
  });

  if (renderedCardCount === 0) {
    $container.html(
      `<div class="text-center text-muted py-5">No matching orders found.</div>`,
    );
  }
}

// =======================================
// Order Management Logic
// =======================================
function fetchBuyerOrders() {
  console.log("Attempting to fetch orders...");
  const managementView = isAdminView();
  const endpoint = managementView
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
      const orders = managementView ? res : res.data || res;
      const normalizedOrders = Array.isArray(orders) ? orders : [];

      globalOrders = filterOrdersForCurrentRole(normalizedOrders);

      if (managementView) {
        renderOrders($("#statusFilter").val() || "all");
      } else if (isUserView()) {
        populateUserSellerFilter();
        renderUserOrders();
      }
    },
    error: function (err) {
      console.error("Error loading orders:", err);
      const errorRow = `<tr><td colspan="8" class="text-center text-danger py-4">Failed to load orders.</td></tr>`;

      if (managementView) {
        $("#buyerOrders").html(errorRow);
      } else {
        $("#userOrderListCards").html(
          `<div class="text-center text-danger py-5">Failed to load orders.</div>`,
        );
      }
    },
  });
}

// =======================================
// Order Seller Identification Logic
// =======================================
function getSellerIdForGroup(order = {}, group = {}) {
  const firstItem = group.items?.[0] || {};

  const directSellerId =
    firstItem.seller_id ||
    firstItem.seller?.user_id ||
    firstItem.seller?.id ||
    firstItem.product?.seller_id ||
    firstItem.product?.seller?.user_id ||
    firstItem.product?.seller?.id ||
    "";

  if (directSellerId) {
    return String(directSellerId);
  }

  const groupSellerName = String(group.seller || "").trim();
  const sellerOrders = Array.isArray(order.seller_orders)
    ? order.seller_orders
    : [];

  const matchedSellerOrder = sellerOrders.find((sellerOrder) => {
    return (
      namesMatch(sellerOrder.seller_name, groupSellerName) ||
      namesMatch(sellerOrder.seller?.username, groupSellerName) ||
      namesMatch(sellerOrder.username, groupSellerName)
    );
  });

  return matchedSellerOrder?.seller_id
    ? String(matchedSellerOrder.seller_id)
    : "";
}

// =======================================
// HTML Escaping Logic
// =======================================
function escapeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// =======================================
// Order Seller Order Retrieval Logic
// =======================================
function getSellerOrderForGroup(order = {}, groupSellerId = "") {
  const sellerOrders = Array.isArray(order?.seller_orders)
    ? order.seller_orders
    : [];

  return (
    sellerOrders.find((sellerOrder) => {
      return String(sellerOrder.seller_id) === String(groupSellerId);
    }) || null
  );
}

function getSellerTrackingNumber(order = {}, sellerOrder = null) {
  const sellerTracking =
    sellerOrder?.tracking_number ||
    sellerOrder?.tracking_no ||
    sellerOrder?.trackingCode ||
    sellerOrder?.tracking_code ||
    sellerOrder?.tracking?.number ||
    sellerOrder?.tracking?.tracking_number ||
    "";

  if (sellerTracking) {
    return sellerTracking;
  }

  const sellerOrders = Array.isArray(order?.seller_orders)
    ? order.seller_orders
    : [];

  // If this is a multi-seller order, do not use parent tracking
  // because it may belong to a different seller.
  if (sellerOrders.length > 1) {
    return "";
  }

  return getOrderTrackingNumber(order);
}

// =======================================
// Order Status Filtering Logic
// =======================================
function doesStatusMatchFilter(status, filterKey = "all") {
  const statusKey = getMainOrderStatus(status);
  const key = normalizeStatus(filterKey || "all");

  switch (key) {
    case "unpaid":
    case "pending":
    case "pending_payment":
      return statusKey === "pending";

    case "to_ship":
    case "processing":
    case "packed":
      return statusKey === "packed";

    case "shipped":
      return statusKey === "shipped";

    case "completed":
    case "delivered":
    case "to_review":
      return statusKey === "delivered";

    case "cancelled":
      return statusKey === "cancelled";

    case "all":
    default:
      return true;
  }
}

// =======================================
// Order Item Filtering Logic
// =======================================
function getItemsForSellerGroup(order = {}, sellerId = "", sellerName = "") {
  const items = getVisibleOrderItems(order);

  if (!sellerId && !sellerName) {
    return items;
  }

  return items.filter((item) => {
    const sellerIdCandidates = [
      item.seller_id,
      item.seller?.user_id,
      item.seller?.id,
      item.product?.seller_id,
      item.product?.seller?.user_id,
      item.product?.seller?.id,
    ];

    const sellerNameCandidates = [
      item.seller_username,
      item.seller_name,
      item.seller?.username,
      item.product?.seller_username,
      item.product?.seller?.username,
    ];

    const idMatches =
      sellerId &&
      sellerIdCandidates.some((candidate) => valuesMatch(candidate, sellerId));

    const nameMatches =
      sellerName &&
      sellerName !== "N/A" &&
      sellerNameCandidates.some((candidate) =>
        namesMatch(candidate, sellerName),
      );

    return idMatches || nameMatches;
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
  const filterKey = normalizeStatus(filter || "all");

  $tbody.empty();

  if ($.fn.DataTable && $.fn.DataTable.isDataTable($table)) {
    $table.DataTable().clear().destroy();
  }

  let renderedRowCount = 0;
  const canUpdateStatus = role === "admin" || isSellerSalesView();

  (globalOrders || []).forEach((order) => {
    const dateMatches =
      !selectedDate || getOrderDateFilterValue(order) === selectedDate;

    if (!dateMatches) {
      return;
    }

    const parentStatusKey = getMainOrderStatus(
      order.shipping_status || order.status,
    );

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

    const sellerGroups = groupItemsBySeller(order);

    sellerGroups.forEach((group) => {
      const seller = group.seller || "N/A";
      const groupSellerId = getSellerIdForGroup(order, group);
      const sellerOrder = getSellerOrderForGroup(order, groupSellerId);

      const groupStatusKey = getMainOrderStatus(
        sellerOrder?.shipping_status || order.shipping_status || order.status,
      );

      if (!doesStatusMatchFilter(groupStatusKey, filterKey)) {
        return;
      }

      const safeGroupStatus = String(groupStatusKey).replace(/'/g, "\\'");
      const safeSellerName = escapeHtmlAttribute(seller);

      const actionButtons = [];

      actionButtons.push(`
        <button class="btn btn-info btn-sm btn-view-order"
          data-order-id="${orderId}"
          data-seller-id="${groupSellerId}"
          data-seller-name="${safeSellerName}"
          data-current-status="${safeGroupStatus}">
          <i class="fas fa-eye"></i> View
        </button>
      `);

      if (canUpdateStatus && !isFinalOrderStatus(groupStatusKey)) {
        actionButtons.push(`
          <button class="btn btn-warning btn-sm btn-update-status"
            data-order-id="${orderId}"
            data-current-status="${safeGroupStatus}"
            data-seller-id="${groupSellerId}"
            data-seller-name="${safeSellerName}">
            <i class="fas fa-edit"></i> Update Status
          </button>
        `);
      } else if (canUpdateStatus) {
        actionButtons.push(`
          <button class="btn btn-secondary btn-sm" disabled>
            <i class="fas fa-lock"></i> Final
          </button>
        `);
      } else {
        if (canCancelOrder(parentStatusKey)) {
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
          <td>
            ${renderStatusBadge(groupStatusKey)}
            <br>
            ${renderPaymentBadge(order.payment_status || "pending")}
          </td>
          <td>${date}</td>
          <td class="text-center">${actionButtons.join("")}</td>
        </tr>
      `;

      $tbody.append(row);
      renderedRowCount++;
    });
  });

  if (renderedRowCount === 0) {
    $tbody.html(
      `<tr><td colspan="8" class="text-center text-muted py-4">No orders found.</td></tr>`,
    );
    return;
  }

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
function openStatusModal(orderId, currentStatus, sellerId = "") {
  $("#statusOrderId").val(orderId);
  $("#updateStatusModal").data("sellerId", sellerId);
  const order = (globalOrders || []).find(
    (item) => String(item.checkout_id) === String(orderId),
  );
  const sellerOrder = getSellerOrderForGroup(order, sellerId);

  const status = getMainOrderStatus(
    currentStatus || sellerOrder?.shipping_status || order?.shipping_status,
  );

  const finalStatus = isFinalOrderStatus(status);

  const statusFlow = {
    pending: ["packed"],
    packed: ["shipped"],
    shipped: ["delivered"],
  };

  const allowedNextStatuses = statusFlow[status] || [];
  const $statusSelect = $("#newOrderStatus");

  $statusSelect.empty();

  if (allowedNextStatuses.length > 0) {
    allowedNextStatuses.forEach(function (nextStatus) {
      $statusSelect.append(
        `<option value="${nextStatus}">${formatStatusLabel(nextStatus)}</option>`,
      );
    });
  } else {
    $statusSelect.append(
      `<option value="${status}">${formatStatusLabel(status)}</option>`,
    );
  }

  $("#newPaymentStatus").val("");
  $("#trackingNumberInput").val(getSellerTrackingNumber(order, sellerOrder));
  $("#statusFinalMessage").text("");
  $("#saveStatusUpdate").prop("disabled", finalStatus);
  $("#newOrderStatus").prop("disabled", finalStatus);

  if (finalStatus) {
    $("#statusFinalMessage").text(
      `${formatStatusLabel(status)} orders are final and can no longer be changed.`,
    );
  }

  if (isSellerSalesView()) {
    $("#paymentStatusGroup").hide();
    $("#newPaymentStatus").prop("disabled", true).val("");
  } else {
    $("#paymentStatusGroup").show();
    $("#newPaymentStatus").prop("disabled", finalStatus);
  }

  const canEditTracking = !finalStatus && canEditTrackingForStatus(status);
  $("#trackingNumberGroup").toggle(canEditTracking);
  $("#trackingNumberInput").prop("disabled", !canEditTracking);

  $("#updateStatusModal").modal("show");
}

// =======================================
// Submit Status Update Logic
// =======================================
function submitOrderStatusUpdate() {
  if (isSellerPurchasesView() || isUserView()) {
    Swal.fire(
      "Not Allowed",
      "Purchases cannot be managed from this view.",
      "warning",
    );
    return;
  }

  const orderId = $("#statusOrderId").val();
  const newStatus = $("#newOrderStatus").val();
  const newPaymentStatus = $("#newPaymentStatus").val();
  const trackingNumber = ($("#trackingNumberInput").val() || "").trim();
  const $saveButton = $("#saveStatusUpdate");
  const originalButtonText = $saveButton.text();
  const existingOrder = (globalOrders || []).find(
    (order) => String(order.checkout_id) === String(orderId),
  );

  const sellerId = $("#updateStatusModal").data("sellerId");
  const existingSellerOrder = getSellerOrderForGroup(existingOrder, sellerId);

  if (
    isFinalOrderStatus(
      existingSellerOrder?.shipping_status ||
        existingOrder?.shipping_status ||
        existingOrder?.status,
    )
  ) {
    Swal.fire(
      "Locked",
      "Delivered and cancelled orders can no longer be changed.",
      "info",
    );
    return;
  }

  const payload = {
    shipping_status: getMainOrderStatus(newStatus),
  };

  if (role === "admin" && sellerId) {
    payload.seller_id = sellerId;
  }

  if (role === "admin" && newPaymentStatus) {
    payload.payment_status = newPaymentStatus;
  }

  if (trackingNumber && canEditTrackingForStatus(payload.shipping_status)) {
    payload.tracking_number = trackingNumber;
  }

  console.log("Status update payload:", payload);

  $.ajax({
    url: `${ip}/api/checkout/orders/${orderId}/status`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    contentType: "application/json",
    data: JSON.stringify(payload),
    beforeSend: () => {
      $("#wait").show();
      $saveButton
        .prop("disabled", true)
        .html(
          '<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>Saving...',
        );
    },

    success: function (response) {
      const updatedCheckout = response?.checkout || {};
      const trackingNumber = updatedCheckout.tracking_number || "";
      const updatedOrderId = updatedCheckout.checkout_id || orderId;
      const existingOrder = (globalOrders || []).find(
        (order) => String(order.checkout_id) === String(updatedOrderId),
      );

      if (existingOrder) {
        existingOrder.status = updatedCheckout.status || newStatus;
        existingOrder.shipping_status =
          updatedCheckout.shipping_status ||
          updatedCheckout.status ||
          payload.shipping_status;
        existingOrder.payment_status =
          updatedCheckout.payment_status || existingOrder.payment_status;
        existingOrder.tracking_number =
          trackingNumber || existingOrder.tracking_number;
      }

      Swal.fire(
        "Updated!",
        trackingNumber
          ? `Order details updated successfully. Tracking Number: ${trackingNumber}`
          : "Order details updated successfully.",
        "success",
      );

      $("#updateStatusModal").modal("hide");

      fetchBuyerOrders();
    },

    error: function (xhr) {
      console.error(xhr);
      Swal.fire(
        "Error",
        extractApiErrorMessage(xhr, "Failed to update status."),
        "error",
      );
    },
    complete: () => {
      $("#wait").hide();
      $saveButton.prop("disabled", false).text(originalButtonText);
    },
  });
}

// =======================================
// Order Details Modal Logic
// =======================================
function loadOrderDetails(
  orderId,
  sellerId = "",
  sellerName = "",
  sellerStatus = "",
) {
  if (isAdminView()) {
    const order = (globalOrders || []).find(
      (o) => String(o.checkout_id) === String(orderId),
    );

    if (!order) {
      Swal.fire("Error", "Unable to load order details.", "error");
      return;
    }

    const sellerOrder = getSellerOrderForGroup(order, sellerId);
    const sellerItems = getItemsForSellerGroup(order, sellerId, sellerName);

    populateOrderDetails(order, sellerItems, {
      sellerName,
      shippingStatus:
        sellerStatus ||
        sellerOrder?.shipping_status ||
        order.shipping_status ||
        order.status,
      trackingNumber: getSellerTrackingNumber(order, sellerOrder),
    });

    $("#orderDetailsModal").modal("show");
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

      if (!Array.isArray(order.items) || order.items.length === 0) {
        order.items = items;
      }

      const sellerOrder = getSellerOrderForGroup(order, sellerId);

      const sellerItems =
        sellerId || sellerName
          ? getItemsForSellerGroup(order, sellerId, sellerName)
          : items;

      populateOrderDetails(order, sellerItems, {
        sellerName,
        shippingStatus:
          sellerStatus ||
          sellerOrder?.shipping_status ||
          order.shipping_status ||
          order.status,
        trackingNumber: getSellerTrackingNumber(order, sellerOrder),
      });

      $("#orderDetailsModal").modal("show");
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
      Swal.fire("Order Cancelled!", res.msg || "", "success");
      fetchBuyerOrders();
    },
    error: function (xhr) {
      console.error("Cancel order failed:", xhr.status, xhr.responseText);

      Swal.fire(
        "Error",
        extractApiErrorMessage(xhr, "Unable to cancel order."),
        "error",
      );
    },
  });
}

// =======================================
// Sidebar Toggle Logic
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
// Main Execution
// =======================================
$(document).ready(function () {
  load_user();
  initializeUserOrderUrlFilters();
  applySellerOrderView();
  fetchBuyerOrders();
  setupSidebarToggle();

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
        currentUserId = response?.user_id || response?.id || null;
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

        if ((isUserView() || isSellerView()) && globalOrders.length > 0) {
          globalOrders = filterOrdersForCurrentRole(globalOrders);
        }

        if (isUserView() && globalOrders.length > 0) {
          populateUserSellerFilter();
          renderUserOrders();
        } else if (isSellerSalesView() && globalOrders.length > 0) {
          renderOrders($("#statusFilter").val() || "all");
        }
      },
      error: function (xhr) {
        console.error("Error loading profile:", xhr.responseText);
        currentUserProfile = null;
        currentUserId = null;
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

  // Fetch cart count on page load for regular users.
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
  $(".order-status-tabs .nav-link").on("click", function (e) {
    e.preventDefault();
    activeUserUrlFilter = "";
    $(".order-status-tabs .nav-link").removeClass("active");
    $(this).addClass("active");
    renderUserOrders();
  });

  $(".seller-order-view-btn").on("click", function () {
    const selectedView = $(this).data("view");
    if (!isSellerView() || selectedView === currentSellerOrderView) {
      return;
    }

    currentSellerOrderView = selectedView;
    applySellerOrderView();
    globalOrders = [];
    fetchBuyerOrders();
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

  $("#newOrderStatus").on("change", function () {
    const status = getMainOrderStatus($(this).val());
    const canEditTracking = canEditTrackingForStatus(status);
    $("#trackingNumberGroup").toggle(canEditTracking);
    $("#trackingNumberInput").prop("disabled", !canEditTracking);
  });

  $("#userSellerFilter").on("change", function () {
    renderUserOrders();
  });

  $("#userDateFilter").on("change", function () {
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
  // Update Status Button Logic
  // -------------------------------
  $(document).on("click", ".btn-update-status", function (e) {
    e.preventDefault();

    const orderId = $(this).attr("data-order-id");
    const currentStatus = $(this).attr("data-current-status");
    let sellerId = $(this).attr("data-seller-id") || "";
    const sellerName = $(this).attr("data-seller-name") || "";

    $("#updateStatusModal .modal-title").text(
      `Update Order #${orderId} - ${sellerName || "Seller"}`,
    );

    console.log("Opening status modal:", {
      orderId,
      currentStatus,
      sellerId,
      sellerName,
    });

    if (role === "admin" && !sellerId && sellerName && sellerName !== "N/A") {
      $.ajax({
        url: `${ip}/api/getAccount_username/${encodeURIComponent(sellerName)}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        success: function (response) {
          sellerId = response?.user_id || response?.id || "";

          console.log("Resolved seller:", {
            sellerName,
            sellerId,
            response,
          });

          if (!sellerId) {
            Swal.fire(
              "Error",
              `Seller ID could not be found for ${sellerName}.`,
              "error",
            );
            return;
          }

          openStatusModal(orderId, currentStatus, sellerId);
        },
        error: function (xhr) {
          console.error("Failed to resolve seller:", xhr);
          Swal.fire(
            "Error",
            `Could not resolve seller ID for ${sellerName}.`,
            "error",
          );
        },
      });

      return;
    }

    openStatusModal(orderId, currentStatus, sellerId);
  });

  // -------------------------------
  // View Order Details Modal Logic
  // -------------------------------
  $(document).on(
    "click",
    ".btn-view-order, [data-target='#orderDetailsModal']",
    function (e) {
      e.preventDefault();

      const orderId = $(this).attr("data-order-id") || $(this).data("id");
      const sellerId = $(this).attr("data-seller-id") || "";
      const sellerName = $(this).attr("data-seller-name") || "";
      const currentStatus = $(this).attr("data-current-status") || "";

      loadOrderDetails(orderId, sellerId, sellerName, currentStatus);
    },
  );

  /* -----------------------------
     LOGOUT HANDLER
  ----------------------------- */
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

$(document).on(
  "show.bs.collapse",
  "#userOrderListCards .collapse",
  function () {
    $(this)
      .closest(".order-card")
      .find(".order-chevron")
      .removeClass("fa-chevron-down")
      .addClass("fa-chevron-up");
  },
);

$(document).on(
  "hide.bs.collapse",
  "#userOrderListCards .collapse",
  function () {
    $(this)
      .closest(".order-card")
      .find(".order-chevron")
      .removeClass("fa-chevron-up")
      .addClass("fa-chevron-down");
  },
);

$(document).on("input keyup search change", "#userOrderSearch", function () {
  renderUserOrders();
});
