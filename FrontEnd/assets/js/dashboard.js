// =======================================
// GLOBAL VARIABLES
// =======================================
const ip = "http://165.245.179.185:8080";
let token = $.cookie("token");
let usr = $.cookie("username");
let role = $.cookie("role");
let profileImage = $.cookie("profileImage");
let orderChart = null;
let statusChart = null;
let ordersTable = null;
const LOW_STOCK_ALERT_THRESHOLD = 3;
const SELLER_CAN_SHOP = true;
const dashboardState = {
  counts: null,
  totalSellers: 0,
  totalProducts: 0,
  products: [],
  categories: [],
  brands: [],
};

function normalizeNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character] || character;
  });
}

function toTitleCase(value) {
  const cleaned = String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "N/A";
  }

  return cleaned.replace(/\w\S*/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalizeNumber(value));
}

function formatPaymentLabel(value) {
  const normalizedPayment = normalizeStatus(value);

  if (!normalizedPayment) {
    return "N/A";
  }

  if (normalizedPayment === "cod") {
    return "COD";
  }

  return toTitleCase(value);
}

function formatOrderStatusLabel(value) {
  return toTitleCase(value);
}

function getOrderStatusClass(status) {
  switch (normalizeStatus(status)) {
    case "pending":
    case "processing":
    case "packed":
    case "to ship":
    case "to_ship":
      return "dashboard-status-pill--pending";
    case "completed":
    case "delivered":
    case "received":
      return "dashboard-status-pill--completed";
    case "shipped":
    case "shipping":
    case "to receive":
    case "to_receive":
      return "dashboard-status-pill--shipped";
    case "cancelled":
    case "canceled":
      return "dashboard-status-pill--cancelled";
    default:
      return "dashboard-status-pill--neutral";
  }
}

function getOrderStatusState(status) {
  switch (normalizeStatus(status)) {
    case "pending":
    case "to ship":
    case "to_ship":
      return "pending";
    case "processing":
    case "packed":
      return "processing";
    case "shipped":
    case "shipping":
    case "to receive":
    case "to_receive":
      return "shipped";
    case "completed":
    case "delivered":
    case "received":
      return "delivered";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "pending";
  }
}

function getOrderStatusBadge(status) {
  const normalizedStatus = getOrderStatusState(status);

  const statusClasses = {
    pending: "status-pending",
    processing: "status-processing",
    shipped: "status-shipped",
    delivered: "status-delivered",
    cancelled: "status-cancelled",
  };

  return statusClasses[normalizedStatus] || "status-pending";
}

function getOrderStatusDisplay(status) {
  const normalizedStatus = getOrderStatusState(status);

  const statusLabels = {
    pending: "Pending",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  return statusLabels[normalizedStatus] || formatOrderStatusLabel(status);
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

function valuesMatch(left, right) {
  if (
    left === null ||
    left === undefined ||
    right === null ||
    right === undefined
  ) {
    return false;
  }

  return String(left).trim() === String(right).trim();
}

function getDashboardLoggedInUserId() {
  return $.cookie("user_id") || null;
}

function getNextOrderStatus(currentStatus) {
  const normalizedStatus = getOrderStatusState(currentStatus);

  if (normalizedStatus === "pending") return "processing";
  if (normalizedStatus === "processing") return "shipped";
  if (normalizedStatus === "shipped") return "delivered";

  return null;
}

function isFinalOrderStatus(currentStatus) {
  const normalizedStatus = getOrderStatusState(currentStatus);

  return normalizedStatus === "delivered" || normalizedStatus === "cancelled";
}

function isOrderOwnedByLoggedInSeller(order = {}) {
  if (role !== "seller") {
    return true;
  }

  const sellerId = getDashboardLoggedInUserId();
  const items = Array.isArray(order?.items) ? order.items : [];

  if (!items.length) {
    return !sellerId;
  }

  if (!sellerId) {
    return true;
  }

  return items.some((item) => {
    const sellerIdCandidates = [
      item?.seller_id,
      item?.seller?.user_id,
      item?.seller?.id,
      item?.product?.seller_id,
      item?.product?.seller?.user_id,
      item?.product?.seller?.id,
    ];

    return sellerIdCandidates.some((candidate) =>
      valuesMatch(candidate, sellerId),
    );
  });
}

function canUpdateOrderStatus(order = {}) {
  const currentStatus = order?.shipping_status || order?.status || "";

  if (role !== "admin" && role !== "seller") {
    return false;
  }

  if (role === "seller" && !isOrderOwnedByLoggedInSeller(order)) {
    return false;
  }

  if (isFinalOrderStatus(currentStatus)) {
    return false;
  }

  return Boolean(getNextOrderStatus(currentStatus));
}

function getFinalOrderStatusMessage(currentStatus) {
  const normalizedStatus = getOrderStatusState(currentStatus);

  if (normalizedStatus === "delivered") {
    return "This order has already been delivered.";
  }

  if (normalizedStatus === "cancelled") {
    return "This order has been cancelled.";
  }

  return "This order can no longer be updated from the dashboard.";
}

function getFooterOrderState(order = {}, $modal = null) {
  const modalStatus =
    ($modal &&
      ($modal.attr("data-order-status") || $modal.data("shippingStatus"))) ||
    "pending";
  const modalOrderId =
    ($modal && ($modal.attr("data-order-id") || $modal.data("orderId"))) ||
    null;
  const modalItems = ($modal && $modal.data("orderItems")) || [];
  const modalTracking =
    ($modal && $modal.data("trackingNumber")) || order?.tracking_number || "";

  return {
    ...(($modal && $modal.data("orderData")) || {}),
    ...order,
    checkout_id: order?.checkout_id || modalOrderId,
    shipping_status: order?.shipping_status || order?.status || modalStatus,
    tracking_number: modalTracking,
    items: Array.isArray(order?.items) ? order.items : modalItems,
  };
}

function mapOrderStatusForApi(status) {
  const normalizedStatus = getOrderStatusState(status);

  return normalizedStatus === "processing" ? "packed" : normalizedStatus;
}

function renderOrderActionButtons($modal, order = null) {
  const $actions = $modal.find("#orderActionButtons");
  if (!$actions.length) return;

  const orderState = getFooterOrderState(order || {}, $modal);
  const orderId = orderState.checkout_id;
  const shippingStatus = orderState.shipping_status || "pending";
  const isOrderLoaded = Boolean(orderId && $modal.data("orderLoaded"));

  if (orderId) {
    $modal.data("orderId", orderId);
    $modal.attr("data-order-id", orderId);
  }

  $modal.data("shippingStatus", shippingStatus);
  $modal.attr("data-order-status", shippingStatus);
  $modal.data("trackingNumber", orderState.tracking_number || "");
  $modal.data("orderItems", orderState.items || []);
  $modal.data("orderData", orderState);

  if (role !== "admin" && role !== "seller") {
    $actions.empty();
    return;
  }

  if (!isOrderLoaded || !orderId) {
    $actions.html(`
      <button
        type="button"
        class="btn order-modal-btn order-modal-btn--primary"
        data-action="update-status"
        disabled
        title="Order details are still loading.">
        <i class="fas fa-pen"></i>
        <span>Update Status</span>
      </button>
    `);
    return;
  }

  if (!isOrderOwnedByLoggedInSeller(orderState)) {
    $actions.html(`
      <div class="order-modal-status-message">
        <i class="fas fa-lock"></i>
        <span>You can only update orders that belong to your own products.</span>
      </div>
    `);
    return;
  }

  if (!canUpdateOrderStatus(orderState)) {
    const normalizedStatus = getOrderStatusState(shippingStatus);

    $actions.html(`
      <div class="order-modal-status-message order-modal-status-message--${normalizedStatus}">
        <i class="fas ${normalizedStatus === "cancelled" ? "fa-ban" : "fa-check-circle"}"></i>
        <span>${escapeHtml(getFinalOrderStatusMessage(shippingStatus))}</span>
      </div>
    `);
    return;
  }

  const nextStatus = getNextOrderStatus(shippingStatus);

  $actions.html(`
    <button
      type="button"
      class="btn order-modal-btn order-modal-btn--primary"
      data-action="update-status"
      data-next-status="${escapeHtml(nextStatus || "")}"
      title="Move this order to ${escapeHtml(getOrderStatusDisplay(nextStatus || shippingStatus))}.">
      <i class="fas fa-pen"></i>
      <span>Update Status</span>
    </button>
  `);
}

function updateDashboardModalStatusUi($modal, checkout, fallbackStatus) {
  const orderState = getFooterOrderState(
    {
      ...checkout,
      shipping_status:
        checkout?.shipping_status || checkout?.status || fallbackStatus,
    },
    $modal,
  );
  const nextStatus = orderState.shipping_status || fallbackStatus || "pending";
  const trackingNumber = orderState.tracking_number || "";

  $modal.data("orderLoaded", true);
  $modal.data("shippingStatus", nextStatus);
  $modal.data("trackingNumber", trackingNumber);
  $modal.data("orderItems", orderState.items || []);
  $modal.data("orderData", orderState);
  $modal.attr("data-order-id", orderState.checkout_id || "");
  $modal.attr("data-order-status", nextStatus);
  $modal.find("#summaryStatus").html(`
    <span class="order-status-badge ${getOrderStatusBadge(nextStatus)}">
      ${escapeHtml(getOrderStatusDisplay(nextStatus))}
    </span>
  `);
  $modal
    .find("#tracking")
    .toggleClass("is-empty", !trackingNumber)
    .text(trackingNumber || "Not yet assigned");

  renderOrderActionButtons($modal, {
    ...orderState,
    checkout_id: orderState.checkout_id || $modal.data("orderId"),
    shipping_status: nextStatus,
  });
}

function refreshDashboardAfterOrderUpdate() {
  loadRecentOrders();
  loadCounts();
  loadOrderStatus();
}

function updateOrderStatus(orderId, newStatus) {
  const $modal = getDashboardRoot().find("#orderDetailsModal");
  const orderState = getFooterOrderState({}, $modal);
  const nextStatus = getNextOrderStatus(
    orderState.shipping_status || $modal.attr("data-order-status"),
  );
  const requestedStatus = getOrderStatusState(newStatus);

  if (
    !orderId ||
    !newStatus ||
    !nextStatus ||
    requestedStatus !== getOrderStatusState(nextStatus)
  ) {
    return;
  }

  if (!canUpdateOrderStatus(orderState)) {
    renderOrderActionButtons($modal, orderState);
    return;
  }

  $modal.find(".order-modal-btn").prop("disabled", true);

  $.ajax({
    url: `${ip}/api/checkout/orders/${orderId}/status`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    contentType: "application/json",
    data: JSON.stringify({
      shipping_status: mapOrderStatusForApi(newStatus),
    }),
    success: function (response) {
      const checkout = response?.checkout || {};
      const trackingNumber = checkout?.tracking_number || "";
      const updatedOrder = {
        ...orderState,
        ...checkout,
        checkout_id: checkout?.checkout_id || orderId,
        items: checkout?.items || orderState.items || [],
      };

      updateDashboardModalStatusUi($modal, updatedOrder, newStatus);
      refreshDashboardAfterOrderUpdate();
      loadOrderDetailsModal(orderId);

      Swal.fire({
        icon: "success",
        title: "Status updated",
        text: trackingNumber
          ? `Order status is now ${getOrderStatusDisplay(newStatus)}. Tracking Number: ${trackingNumber}`
          : `Order status is now ${getOrderStatusDisplay(newStatus)}.`,
        confirmButtonText: "OK",
      });
    },
    error: function (xhr) {
      renderOrderActionButtons($modal, orderState);

      Swal.fire(
        "Error",
        extractApiErrorMessage(xhr, "Failed to update order status."),
        "error",
      );
    },
  });
}

function promptDashboardStatusUpdate($modal) {
  const orderState = getFooterOrderState({}, $modal);
  const currentStatus = orderState.shipping_status || "pending";
  const orderId = orderState.checkout_id;
  const nextStatus = getNextOrderStatus(currentStatus);

  if (role === "seller" && !isOrderOwnedByLoggedInSeller(orderState)) {
    Swal.fire(
      "Update not allowed",
      "You can only update orders that belong to your own products.",
      "info",
    );
    return;
  }

  if (!orderId || !nextStatus || !canUpdateOrderStatus(orderState)) {
    Swal.fire(
      "No Further Updates",
      getFinalOrderStatusMessage(currentStatus),
      "info",
    );
    return;
  }

  Swal.fire({
    title: "Update order status?",
    text: `This will mark the order as ${getOrderStatusDisplay(nextStatus)}.`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, update",
  }).then((result) => {
    if (!result.isConfirmed) {
      renderOrderActionButtons($modal, orderState);
      return;
    }

    updateOrderStatus(orderId, nextStatus);
  });
}

function sellerCanShop() {
  return SELLER_CAN_SHOP;
}

function canShowCart() {
  return role === "user" || (role === "seller" && sellerCanShop());
}

function canShowNotifications() {
  return role === "admin" || role === "seller";
}

// =======================================
// DASHBOARD ROOT (ADMIN/SELLER)
// =======================================
function getDashboardRoot() {
  if (role === "seller") {
    return $("#sellerDashboardContent");
  }

  return $("#adminDashboardContent");
}

function setSidebarLabels() {
  $(".sidebar-role-label").each(function () {
    const $label = $(this);
    const sellerLabel = $label.data("sellerLabel");
    const adminLabel = $label.data("adminLabel");

    if (role === "seller" && sellerLabel) {
      $label.text(sellerLabel);
      return;
    }

    if (adminLabel) {
      $label.text(adminLabel);
    }
  });
}

function highlightActiveSidebarLink() {
  const currentPage =
    window.location.pathname.split("/").pop() || "dashboard.html";

  $(".sidebar .nav-bar a").each(function () {
    const $link = $(this);
    const isActive = String($link.attr("href") || "") === currentPage;

    $link.toggleClass("active", isActive);
    $link.parent().toggleClass("active", isActive);
  });
}

function syncNavbarVisibility() {
  const showCart = canShowCart();
  const showNotifications = canShowNotifications();
  const showDashboardLink = role === "admin" || role === "seller";
  const showProductLink = role === "admin" || role === "seller";
  const isDashboardRole = role === "admin" || role === "seller";
  const $cartNav = $("#cartNav");
  const $cartNavMobile = $("#cartNavMobile");
  const $notificationNav = $("#notificationNav");

  $cartNav.toggle(showCart);
  $cartNavMobile.toggle(showCart);
  if (!showCart) {
    $("#cart-count, #cart-count-mobile").hide().text("0");
  }

  $notificationNav.toggle(showNotifications);

  $("#dashboard").toggle(showDashboardLink);
  $("#productUi").toggle(showProductLink);
  $("#navbarOrdersLabel").text(
    role === "seller"
      ? "My Orders"
      : role === "admin"
        ? "Orders"
        : "Your Orders",
  );
  $("#sidebarProfile").toggle(isDashboardRole);
  $("#sidebarAddress").toggle(role === "seller");
  $("#sidebarAccounts").toggle(role === "admin");

  setSidebarLabels();
  highlightActiveSidebarLink();
}

function setCartBadgeCount(count) {
  const normalizedCount = normalizeNumber(count);
  $("#cart-count, #cart-count-mobile").text(normalizedCount);

  if (canShowCart()) {
    $("#cart-count, #cart-count-mobile").show();
  }
}

function refreshCartBadgeFallback() {
  if (!token || !canShowCart()) {
    $("#cart-count, #cart-count-mobile").hide();
    return;
  }

  $.ajax({
    url: `${ip}/api/cart`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (response) {
      setCartBadgeCount(response?.count || 0);
    },
    error: function (xhr) {
      console.error("Error loading dashboard cart count:", xhr.responseText);
      setCartBadgeCount(0);
    },
  });
}

function countRecordsByStatus(records, targetStatus) {
  const normalizedTarget = normalizeStatus(targetStatus);

  return (Array.isArray(records) ? records : []).filter((record) => {
    const status = normalizeStatus(record?.status || record?.approval_status);
    return status === normalizedTarget;
  }).length;
}

function countRejectedProducts() {
  return (
    Array.isArray(dashboardState.products) ? dashboardState.products : []
  ).filter(
    (product) => normalizeStatus(product?.approval_status) === "rejected",
  ).length;
}

function renderLowStockAlert(lowStockCount) {
  const $alerts = getDashboardRoot().find(".dashboard-alerts");
  if (!$alerts.length) {
    return;
  }

  const count = normalizeNumber(lowStockCount);
  $alerts.empty();

  if (count <= 0) {
    return;
  }

  $alerts.append(`
    <div class="alert alert-warning low-stock-dashboard-alert dashboard-inline-alert">
      <i class="fas fa-exclamation-triangle"></i>
      ${pluralize(count, "product")} ${count === 1 ? "has" : "have"} low stock (${LOW_STOCK_ALERT_THRESHOLD} or fewer left).
    </div>
  `);
}

function buildNotificationItems() {
  const counts = dashboardState.counts || {};
  const pendingCategories = countRecordsByStatus(
    dashboardState.categories,
    "pending",
  );
  const pendingBrands = countRecordsByStatus(dashboardState.brands, "pending");
  const rejectedProducts = countRejectedProducts();
  const items = [];

  if (role === "admin") {
    if (normalizeNumber(counts.pending_approval) > 0) {
      items.push({
        tone: "warning",
        icon: "fas fa-clipboard-check",
        title: "Pending product approvals",
        count: counts.pending_approval,
        message: `${pluralize(counts.pending_approval, "product")} waiting for review.`,
        href: "product.html?approval_status=pending",
        ctaLabel: "View",
      });
    }

    if (normalizeNumber(counts.pending_orders) > 0) {
      items.push({
        tone: "info",
        icon: "fas fa-hourglass-half",
        title: "Pending orders",
        count: counts.pending_orders,
        message: `${pluralize(counts.pending_orders, "order")} need follow-up.`,
        href: "orderDetails.html?status=pending",
        ctaLabel: "View",
      });
    }

    if (normalizeNumber(counts.low_stock_products) > 0) {
      items.push({
        tone: "warning",
        icon: "fas fa-exclamation-triangle",
        title: "Low-stock products",
        count: counts.low_stock_products,
        message: `${pluralize(counts.low_stock_products, "product")} have ${LOW_STOCK_ALERT_THRESHOLD} or fewer left.`,
        href: "product.html?filter=low-stock",
        ctaLabel: "View",
      });
    }

    if (normalizeNumber(counts.cancelled_orders) > 0) {
      items.push({
        tone: "danger",
        icon: "fas fa-ban",
        title: "Cancelled orders",
        count: counts.cancelled_orders,
        message: `${pluralize(counts.cancelled_orders, "order")} were cancelled.`,
        href: "orderDetails.html?status=cancelled",
        ctaLabel: "View",
      });
    }

    if (pendingCategories > 0) {
      items.push({
        tone: "info",
        icon: "fas fa-tags",
        title: "Pending category approvals",
        count: pendingCategories,
        message: `${pluralize(pendingCategories, "category")} still need approval.`,
        href: "category.html?status=pending",
        ctaLabel: "View",
      });
    }

    if (pendingBrands > 0) {
      items.push({
        tone: "info",
        icon: "fas fa-copyright",
        title: "Pending brand approvals",
        count: pendingBrands,
        message: `${pluralize(pendingBrands, "brand")} still need approval.`,
        href: "brand.html?status=pending",
        ctaLabel: "View",
      });
    }
  }

  if (role === "seller") {
    if (normalizeNumber(counts.pending_orders) > 0) {
      items.push({
        tone: "info",
        icon: "fas fa-shopping-bag",
        title: "New orders",
        count: counts.pending_orders,
        message: `${pluralize(counts.pending_orders, "order")} need your attention.`,
        href: "orderDetails.html?status=pending",
        ctaLabel: "View",
      });
    }

    if (normalizeNumber(counts.low_stock_products) > 0) {
      items.push({
        tone: "warning",
        icon: "fas fa-exclamation-triangle",
        title: "Low-stock products",
        count: counts.low_stock_products,
        message: `${pluralize(counts.low_stock_products, "product")} have ${LOW_STOCK_ALERT_THRESHOLD} or fewer left.`,
        href: "product.html?filter=low-stock",
        ctaLabel: "View",
      });
    }

    if (normalizeNumber(counts.pending_approval) > 0) {
      items.push({
        tone: "warning",
        icon: "fas fa-clock",
        title: "Pending product approvals",
        count: counts.pending_approval,
        message: `${pluralize(counts.pending_approval, "product")} are still under review.`,
        href: "product.html?approval_status=pending",
        ctaLabel: "View",
      });
    }

    if (rejectedProducts > 0) {
      items.push({
        tone: "danger",
        icon: "fas fa-times-circle",
        title: "Product approval updates",
        count: rejectedProducts,
        message: `${pluralize(rejectedProducts, "product")} were rejected and may need changes.`,
        href: "product.html?approval_status=rejected",
        ctaLabel: "View",
      });
    }

    if (pendingCategories > 0) {
      items.push({
        tone: "info",
        icon: "fas fa-tags",
        title: "Pending category approvals",
        count: pendingCategories,
        message: `${pluralize(pendingCategories, "category")} are waiting for approval.`,
        href: "category.html?status=pending",
        ctaLabel: "View",
      });
    }

    if (pendingBrands > 0) {
      items.push({
        tone: "info",
        icon: "fas fa-copyright",
        title: "Pending brand approvals",
        count: pendingBrands,
        message: `${pluralize(pendingBrands, "brand")} are waiting for approval.`,
        href: "brand.html?status=pending",
        ctaLabel: "View",
      });
    }

    if (normalizeNumber(counts.cancelled_orders) > 0) {
      items.push({
        tone: "danger",
        icon: "fas fa-ban",
        title: "Cancelled orders",
        count: counts.cancelled_orders,
        message: `${pluralize(counts.cancelled_orders, "order")} were cancelled.`,
        href: "orderDetails.html?status=cancelled",
        ctaLabel: "View",
      });
    }
  }

  return items;
}

function renderNotificationItem(item) {
  return `
    <a href="${item.href || "#"}" class="notification-item notification-item--${item.tone}">
      <span class="notification-item-icon">
        <i class="${item.icon}"></i>
      </span>
      <div class="notification-item-copy">
        <div class="notification-item-title">
          <span class="notification-item-heading">
            <h6>${item.title}</h6>
            <span class="notification-item-count">${normalizeNumber(item.count)}</span>
          </span>
          <small class="notification-item-link-label">${item.ctaLabel || "View"}</small>
        </div>
        <p>${item.message}</p>
      </div>
    </a>
  `;
}

function renderDashboardNotifications() {
  // Dashboard summary alerts must not control the app notification bell.
  // The bell is owned by notification-bell.js and /api/notifications only.
}

function loadSupplementaryDashboardData() {
  if (role !== "admin" && role !== "seller") {
    return;
  }

  const $dashboard = getDashboardRoot();
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  if (role === "admin") {
    $.ajax({
      url: `${ip}/api/countedSellers`,
      method: "GET",
      headers,
      success: function (response) {
        dashboardState.totalSellers = normalizeNumber(
          response?.totalSellers || response?.total_sellers,
        );
        $dashboard.find("#countedSellers").text(dashboardState.totalSellers);
      },
      error: function (xhr) {
        console.warn("Could not load countedSellers:", xhr.responseText);
        dashboardState.totalSellers = 0;
        $dashboard.find("#countedSellers").text(0);
      },
    });
  }

  $.ajax({
    url: `${ip}/api/products`,
    method: "GET",
    headers,
    success: function (response) {
      const products = Array.isArray(response?.data) ? response.data : [];
      dashboardState.products = products;
      dashboardState.totalProducts = products.length;

      if (role === "admin") {
        const pendingApprovalCount = products.filter(
          (product) =>
            normalizeStatus(product?.approval_status || "pending") ===
            "pending",
        ).length;

        dashboardState.counts = {
          ...(dashboardState.counts || {}),
          pending_approval: pendingApprovalCount,
        };

        if (!dashboardState.counts?.total_products) {
          $dashboard
            .find("#countedProducts")
            .text(dashboardState.totalProducts);
        }
        $dashboard.find("#countedPendingApproval").text(pendingApprovalCount);
      }

      renderDashboardNotifications();
    },
    error: function (xhr) {
      console.warn("Could not load products for dashboard:", xhr.responseText);
      dashboardState.products = [];
      dashboardState.totalProducts = 0;

      if (role === "admin" && !dashboardState.counts?.total_products) {
        $dashboard.find("#countedProducts").text(0);
      }

      renderDashboardNotifications();
    },
  });

  $.ajax({
    url: `${ip}/api/category`,
    method: "GET",
    headers,
    success: function (response) {
      dashboardState.categories = Array.isArray(response?.data)
        ? response.data
        : [];
      renderDashboardNotifications();
    },
    error: function (xhr) {
      console.warn(
        "Could not load categories for dashboard:",
        xhr.responseText,
      );
      dashboardState.categories = [];
      renderDashboardNotifications();
    },
  });

  $.ajax({
    url: `${ip}/api/brands`,
    method: "GET",
    headers,
    success: function (response) {
      dashboardState.brands = Array.isArray(response?.data)
        ? response.data
        : [];
      renderDashboardNotifications();
    },
    error: function (xhr) {
      console.warn("Could not load brands for dashboard:", xhr.responseText);
      dashboardState.brands = [];
      renderDashboardNotifications();
    },
  });
}

// =======================================
// LOAD USER SESSION & NAVBAR
// =======================================
function load_user() {
  usr = $.cookie("username");
  token = $.cookie("token");
  role = $.cookie("role");
  profileImage = $.cookie("profileImage");

  const $displayUsername = $("#displayUsername");
  const $login = $("#login");
  const $register = $("#register");
  const $logout = $("#logout");
  const $adminDashboard = $("#adminDashboard");
  const $adminDashboardContent = $("#adminDashboardContent");
  const $sellerDashboardContent = $("#sellerDashboardContent");
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");
  const $cartNav = $("#cartNav");
  const $cartNavMobile = $("#cartNavMobile");
  const $notificationNav = $("#notificationNav");

  if (!usr || !token) {
    $displayUsername.html("My Account");
    $login.show();
    $register.show();
    $logout.hide();
    $adminDashboard.hide();
    $("#cart-count, #cart-count-mobile").hide();
    $cartNav.hide();
    $cartNavMobile.hide();
    $notificationNav.hide();
    $("#productUi, #dashboard").hide();
    $navbarProfileImage.hide();
    $defaultProfileIcon.show();
    $("#sidebarProfile, #sidebarAddress").hide();
    $("#sidebarAccounts").hide();
    return;
  }

  $displayUsername.html(`<b>${usr}</b>`);
  $login.hide();
  $register.hide();
  $logout.show();

  if (role === "admin") {
    $adminDashboardContent.removeClass("d-none");
    $sellerDashboardContent.addClass("d-none");
  } else if (role === "seller") {
    $sellerDashboardContent.removeClass("d-none");
    $adminDashboardContent.addClass("d-none");
  } else {
    $adminDashboardContent.addClass("d-none");
    $sellerDashboardContent.addClass("d-none");
  }

  syncNavbarVisibility();
}

// =======================================
// SIDEBAR TOGGLE
// =======================================
function setupSidebarToggle() {
  function resetSidebarForMobile() {
    if (window.matchMedia("(max-width: 991.98px)").matches) {
      $(".sidebar").removeClass("collapsed");
      $(".wrapper").removeClass("sidebar-collapsed");

      $(".text-link").show();
      $(".menu-btn").show();
      $(".close-btn").hide();
    }
  }

  $(".menu-btn")
    .off("click")
    .on("click", function () {
      // Do not collapse sidebar on mobile
      if (window.matchMedia("(max-width: 991.98px)").matches) return;

      $(".sidebar").addClass("collapsed");
      $(".wrapper").addClass("sidebar-collapsed");

      $(".close-btn").show();
      $(".menu-btn").hide();
    });

  $(".close-btn")
    .off("click")
    .on("click", function () {
      // Do not run desktop sidebar behavior on mobile
      if (window.matchMedia("(max-width: 991.98px)").matches) return;

      $(".sidebar").removeClass("collapsed");
      $(".wrapper").removeClass("sidebar-collapsed");

      $(".close-btn").hide();
      $(".menu-btn").show();
    });

  resetSidebarForMobile();
  $(window)
    .off("resize.sidebarToggle")
    .on("resize.sidebarToggle", resetSidebarForMobile);
}

// =======================================
// COUNT DASHBOARD STATS (ROLE BASED)
// =======================================
function loadCounts() {
  if (role !== "admin" && role !== "seller") {
    return;
  }

  const $dashboard = getDashboardRoot();

  $.ajax({
    url: `${ip}/api/counts`,
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    success: function (res) {
      dashboardState.counts = {
        users: normalizeNumber(res.users),
        total_products: normalizeNumber(
          res.total_products || res.totalProducts,
        ),
        my_products: normalizeNumber(res.my_products),
        approved_products: normalizeNumber(res.approved_products),
        pending_approval: normalizeNumber(res.pending_approval),
        total_orders: normalizeNumber(res.total_orders || res.totalOrders),
        pending_orders: normalizeNumber(
          res.pending_orders || res.pendingOrders,
        ),
        completed_orders: normalizeNumber(
          res.completed_orders || res.completedOrders,
        ),
        cancelled_orders: normalizeNumber(
          res.cancelled_orders || res.cancelledOrders,
        ),
        low_stock_products: normalizeNumber(res.low_stock_products),
      };

      renderLowStockAlert(dashboardState.counts.low_stock_products);

      if (role === "seller") {
        $dashboard
          .find("#countedMyProducts")
          .text(dashboardState.counts.my_products);
        $dashboard
          .find("#countedPendingApproval")
          .text(dashboardState.counts.pending_approval);
        $dashboard
          .find("#countedApprovedProducts")
          .text(dashboardState.counts.approved_products);
        $dashboard
          .find("#countedMyOrders")
          .text(dashboardState.counts.total_orders);
        $dashboard
          .find("#countedSellerPendingOrders")
          .text(dashboardState.counts.pending_orders);
        $dashboard
          .find("#countedSellerCompletedOrders")
          .text(dashboardState.counts.completed_orders);
        $dashboard
          .find("#countedSellerCancelledOrders")
          .text(dashboardState.counts.cancelled_orders);
        $dashboard
          .find("#countedSellerLowStock")
          .text(dashboardState.counts.low_stock_products);

        renderDashboardNotifications();
        loadSupplementaryDashboardData();
        return;
      }

      $dashboard.find("#countedUsers").text(dashboardState.counts.users);
      $dashboard
        .find("#countedProducts")
        .text(dashboardState.counts.total_products);
      $dashboard
        .find("#countedOrders")
        .text(dashboardState.counts.total_orders);
      $dashboard
        .find("#countedPendingOrders")
        .text(dashboardState.counts.pending_orders);
      $dashboard
        .find("#countedCompletedOrders")
        .text(dashboardState.counts.completed_orders);
      $dashboard
        .find("#countedCancelled")
        .text(dashboardState.counts.cancelled_orders);
      $dashboard
        .find("#countedAdminLowStock")
        .text(dashboardState.counts.low_stock_products);

      $dashboard.find("#countedCategory").text(res.categories || 0);
      $dashboard.find("#countedBrand").text(res.brands || 0);

      renderDashboardNotifications();
      loadSupplementaryDashboardData();
      console.log("Dashboard counts loaded successfully:", res);
    },
    error: (xhr) => {
      console.error("Error fetching dashboard counts:", xhr.responseText);
    },
  });
}

// =======================================
// Orders by Month Chart Function
// =======================================
function loadMonthlyOrders() {
  if (!orderChart) return;

  fetch(`${ip}/api/checkout/dashboard/orders/monthly`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      orderChart.data.labels = data?.labels || [];
      orderChart.data.datasets[0].data = data?.data || [];
      orderChart.update();
    })
    .catch((err) => console.error("Monthly Orders Error:", err));
}

// =======================================
// Orders by Status Chart Function
// =======================================
function loadOrderStatus() {
  if (!statusChart) return;

  fetch(`${ip}/api/checkout/dashboard/orders/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      statusChart.data.labels = data?.labels || [];
      statusChart.data.datasets[0].data = data?.data || [];
      statusChart.update();
    })
    .catch((err) => console.error("Order Status Error:", err));
}

// =======================================
// Iinitial function call
// =======================================
function initCharts() {
  if (role !== "admin" && role !== "seller") return;

  const $dashboard = getDashboardRoot();
  const orderCanvas = $dashboard.find(
    role === "seller" ? "#sellerOrderChart" : "#orderChart",
  )[0];
  const statusCanvas = $dashboard.find(
    role === "seller" ? "#sellerStatusChart" : "#orderStatusChart",
  )[0];

  if (!orderCanvas || !statusCanvas) return;

  if (orderChart) orderChart.destroy();
  if (statusChart) statusChart.destroy();

  orderChart = new Chart(orderCanvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: ["Oct 2025", "Nov 2025"],
      datasets: [
        {
          data: [0, 0],
          backgroundColor: ["#2563eb", "#14b8a6"],
          borderWidth: 2,
          cutout: "70%",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        beforeDraw: function (chart) {
          var width = chart.width,
            height = chart.height,
            ctx = chart.ctx;
          ctx.restore();
          var fontSize = (height / 114).toFixed(2);
          ctx.font = fontSize + "em sans-serif";
          ctx.textBaseline = "middle";
          var text = chart.data.datasets[0].data.reduce((a, b) => a + b, 0),
            textX = Math.round((width - ctx.measureText(text).width) / 2),
            textY = height / 2;
          ctx.fillText(text, textX, textY);
          ctx.save();
        },
      },
    },
  });

  statusChart = new Chart(statusCanvas.getContext("2d"), {
    type: "pie",
    data: {
      labels: ["Completed", "Shipped", "To Ship", "Cancelled"],
      datasets: [
        {
          data: [0, 0, 0, 0],
          backgroundColor: ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"],
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, padding: 20 },
        },
      },
    },
  });
}

// =======================================
// Load Recent Orders from API
// =======================================
function loadRecentOrders() {
  if (role !== "admin" && role !== "seller") {
    return;
  }

  const $dashboard = getDashboardRoot();
  const tableSelector =
    role === "seller" ? "#sellerOrdersTable" : "#ordersTable";
  const $ordersTable = $dashboard.find(tableSelector);
  if (!$ordersTable.length) return;
  const tbody = $ordersTable.find("tbody");

  $.ajax({
    url: `${ip}/api/checkout/all`,
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    dataType: "json",
    success: function (res) {
      if ($.fn.DataTable.isDataTable($ordersTable)) {
        $ordersTable.DataTable().clear().destroy();
      }

      tbody.empty();

      res.forEach((order) => {
        if (role === "seller") {
          const sellerItems = order.items || [];
          const firstItem = sellerItems[0];
          const productName = firstItem?.product?.product_name || "N/A";
          const description = firstItem?.product?.product_description || "N/A";
          const statusText = order.status || "N/A";
          const itemSummary = sellerItems.length
            ? `${pluralize(sellerItems.length, "item")} in this order`
            : "Item details unavailable";
          const amount = sellerItems.reduce(
            (sum, item) => sum + Number(item.subtotal || 0),
            0,
          );
          const statusClass = getOrderStatusClass(statusText);
          const statusLabel = getOrderStatusDisplay(statusText);
          const paymentLabel = formatPaymentLabel(order.payment_method);

          const sellerRow = `
            <tr>
              <td class="text-center">
                <span class="dashboard-order-id">#${escapeHtml(order.checkout_id)}</span>
              </td>
              <td>
                <div class="dashboard-table-main">${escapeHtml(productName)}</div>
                <div class="dashboard-table-subtext">${escapeHtml(itemSummary)}</div>
              </td>
              <td>
                <div class="dashboard-table-description" title="${escapeHtml(description)}">${escapeHtml(description)}</div>
              </td>
              <td class="dashboard-amount-cell">${formatCurrency(amount)}</td>
              <td>
                <span class="dashboard-status-pill ${statusClass}">${escapeHtml(statusLabel)}</span>
              </td>
              <td>
                <span class="dashboard-payment-pill">${escapeHtml(paymentLabel)}</span>
              </td>
              <td class="text-center">
                <button type="button" class="btn btn-sm dashboard-table-action view-order" data-id="${order.checkout_id}">
                  <i class="fas fa-eye"></i>
                  <span>View</span>
                </button>
              </td>
            </tr>
          `;

          tbody.append(sellerRow);
          return;
        }

        let sellers = "N/A";
        let sellerCountText = "Seller unavailable";

        if (order.items && order.items.length > 0) {
          const sellerSet = new Set(
            order.items
              .map((item) => item.product?.seller?.username)
              .filter(Boolean),
          );

          const sellerNames = [...sellerSet];
          sellers = sellerNames.join(", ");
          sellerCountText = pluralize(sellerNames.length, "seller");
        }

        const username = order.user?.username ?? "N/A";
        const statusLabel = getOrderStatusDisplay(order.status);
        const statusClass = getOrderStatusClass(order.status);
        const paymentLabel = formatPaymentLabel(order.payment_method);

        const row = `
          <tr>
            <td class="text-center">
              <span class="dashboard-order-id">#${escapeHtml(order.checkout_id)}</span>
            </td>
            <td>
              <div class="dashboard-table-main">${escapeHtml(username)}</div>
              <div class="dashboard-table-subtext">Customer</div>
            </td>
            <td>
              <div class="dashboard-table-main dashboard-table-clamp" title="${escapeHtml(sellers)}">${escapeHtml(sellers)}</div>
              <div class="dashboard-table-subtext">${escapeHtml(sellerCountText)}</div>
            </td>
            <td class="dashboard-amount-cell">${formatCurrency(order.total_amount)}</td>
            <td>
              <span class="dashboard-status-pill ${statusClass}">${escapeHtml(statusLabel)}</span>
            </td>
            <td>
              <span class="dashboard-payment-pill">${escapeHtml(paymentLabel)}</span>
            </td>
            <td class="text-center">
              <button type="button" class="btn btn-sm dashboard-table-action view-order" data-id="${order.checkout_id}">
                <i class="fas fa-eye"></i>
                <span>View</span>
              </button>
            </td>
          </tr>
        `;

        tbody.append(row);
      });

      ordersTable = $ordersTable.DataTable({
        pageLength: 5,
        lengthChange: false,
        responsive: true,
        autoWidth: false,
        columnDefs: [
          { orderable: false, targets: -1, className: "text-center" },
        ],
        language: {
          searchPlaceholder:
            role === "seller"
              ? "Search product, status, or payment"
              : "Search customer, seller, or status",
          zeroRecords: "No matching orders found.",
          infoEmpty: "No orders available",
        },
        initComplete: function () {
          const $wrapper = $ordersTable.closest(".dataTables_wrapper");
          const searchPlaceholder =
            role === "seller"
              ? "Search product, status, or payment"
              : "Search customer, seller, or status";

          $wrapper
            .find(".dataTables_filter input")
            .attr("placeholder", searchPlaceholder)
            .attr("aria-label", searchPlaceholder);
        },
      });
    },
    error: function (xhr) {
      console.error("Error loading recent orders:", xhr.responseText);
    },
  });
}

// =======================================
// Function Load Order Details Modal
// =======================================
function loadOrderDetailsModal(orderId) {
  if (role !== "admin" && role !== "seller") {
    return;
  }

  const $dashboard = getDashboardRoot();
  const $modal = $dashboard.find("#orderDetailsModal");
  if (!$modal.length) {
    console.error("orderDetailsModal not found for current dashboard.");
    return;
  }

  $modal.data("orderId", orderId);
  $modal.data("orderLoaded", false);
  $modal.data("shippingStatus", "pending");
  $modal.data("trackingNumber", "");
  $modal.data("orderItems", []);
  $modal.data("orderData", {
    checkout_id: orderId,
    shipping_status: "pending",
    items: [],
  });
  $modal.attr("data-order-id", orderId);
  $modal.attr("data-order-status", "pending");
  $modal.modal("show");
  $modal
    .find("#summaryStatus")
    .html(
      `<span class="order-status-badge status-processing">Loading...</span>`,
    );
  $modal.find("#summaryDate").text("Loading...");
  $modal.find("#summaryItems").text("0");
  $modal.find("#tracking").removeClass("is-empty").text("Loading...");
  $modal.find("#orderDetailsBody").html(`
    <tr>
      <td colspan="7" class="text-center order-details-empty">
        Loading order items...
      </td>
    </tr>
  `);
  renderOrderActionButtons($modal);

  $.ajax({
    url: `${ip}/api/checkout/all`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (allOrders) {
      const fullOrder = allOrders.find((o) => o.checkout_id == orderId);

      if (!fullOrder) {
        console.error("Order not found in list");
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Order not found.",
        });
        return;
      }

      const items = fullOrder.items || [];
      const order = {
        ...fullOrder,
        items,
      };
      const shippingStatus = order.shipping_status || order.status || "pending";

      $modal.data("orderId", order.checkout_id);
      const date = new Date(order.created_at);
      const formattedDate = Number.isNaN(date.getTime())
        ? "N/A"
        : date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
      $modal.find("#summaryDate").text(formattedDate);
      $modal.find("#summaryItems").text(pluralize(items.length, "item"));
      updateDashboardModalStatusUi($modal, order, shippingStatus);

      let rows = "";
      items.forEach((item) => {
        const subtotal =
          normalizeNumber(item.price) * normalizeNumber(item.quantity);

        const imagePath = item.product?.image || item.image || "";
        const imageSrc = imagePath
          ? `${ip}/FrontEnd/assets/img/product/${imagePath}`
          : "assets/img/back.jpg";
        const productName =
          item.product?.product_name || item.product_name || "N/A";
        const sellerName =
          item.product?.seller?.username || order.shop_name || "N/A";
        const username = order.user?.username || "N/A";
        const quantity = normalizeNumber(item.quantity);
        const productDescription =
          item.product?.product_description || item.description || "";

        rows += `
          <tr>
            <td>
              <img
                   src="${imageSrc}"
                   onerror="this.src='assets/img/back.jpg'"
                   alt="${escapeHtml(productName)}"
                   class="order-details-product-image">
            </td>
            <td>
              <div class="order-details-party-name">${escapeHtml(username)}</div>
              <div class="order-details-meta">Buyer</div>
            </td>
            <td>
              <div class="order-details-product-name">${escapeHtml(productName)}</div>
              <div class="order-details-meta">
                ${escapeHtml(productDescription || "Product item")}
              </div>
            </td>
            <td>
              <div class="order-details-party-name">${escapeHtml(sellerName)}</div>
              <div class="order-details-meta">Seller</div>
            </td>
            <td>
              <span class="order-details-qty">${quantity}</span>
            </td>
            <td>
              <span class="order-details-price">${formatCurrency(item.price)}</span>
            </td>
            <td>
              <span class="order-details-subtotal">${formatCurrency(subtotal)}</span>
            </td>
          </tr>
        `;
      });

      if (!rows) {
        rows = `
          <tr>
            <td colspan="7" class="text-center order-details-empty">
              No items found for this order.
            </td>
          </tr>
        `;
      }

      $modal.find("#orderDetailsBody").html(rows);
    },
    error: function (xhr) {
      console.error("Error loading order details:", xhr.responseText);
      renderOrderActionButtons($modal, getFooterOrderState({}, $modal));
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Unable to load order details. Please try again.",
      });
    },
  });
}

// =======================================
// View Orders Button Click Handler
// =======================================
$(document).on("click", ".view-order", function () {
  const orderId = $(this).data("id");
  loadOrderDetailsModal(orderId);
});

$(document).on("click", ".order-modal-btn", function () {
  const $button = $(this);

  if ($button.is(":disabled")) {
    return;
  }

  const $modal = $button.closest(".modal");
  if (!$modal.length) {
    return;
  }

  const action = String($button.data("action") || "");

  if (action === "update-status") {
    promptDashboardStatusUpdate($modal);
  }
});

// =======================================
// UTILITIES
// =======================================
$(document).ajaxStart(() => $("#wait").show());
$(document).ajaxComplete(() => $("#wait").hide());

$(document).ready(function () {
  load_user();
  initCharts();
  loadMonthlyOrders();
  loadOrderStatus();
  loadCounts();
  setupSidebarToggle();
  loadRecentOrders();
  setupSidebarToggle();

  if (typeof window.updateNavbarCount === "function") {
    window.updateNavbarCount();
  } else {
    refreshCartBadgeFallback();
  }

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
  } else {
    console.error("No username found in cookie.");
  }

  $("#logout").click((e) => {
  e.preventDefault();

  function clearCookiesAndRedirect() {
    Object.keys($.cookie()).forEach((cookie) => {
      $.removeCookie(cookie, { path: "/" });
      $.removeCookie(cookie);
    });

    window.location.replace("login.html");
  }

  function logoutFromServer() {
    $.ajax({
      url: `${ip}/api/logout`,
      type: "POST",
      headers: { Authorization: `Bearer ${token}` },
      data: { token },
      complete: () => {
        clearCookiesAndRedirect();
      },
    });
  }

  if (typeof removeFcmTokenFromServer === "function") {
    removeFcmTokenFromServer(function () {
      logoutFromServer();
    });
  } else {
    logoutFromServer();
  }
});
});

