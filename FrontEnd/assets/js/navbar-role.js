(function ($) {
  const SELLER_CAN_BUY = true;
  const apiBase = "http://localhost:8000";
  const LOW_STOCK_ALERT_THRESHOLD = 3;
  let notificationRequestKey = null;

  function normalizeRole(role) {
    return String(role || "")
      .trim()
      .toLowerCase();
  }

  function isBuyerRole(role) {
    return role === "user" || role === "buyer";
  }

  function setCartVisibility(showCart) {
    $("#cartNav, #cartNavMobile").toggle(showCart);
    $("#cart-count, #cart-count-mobile").toggle(showCart);
  }

  function setNotificationVisibility(showNotifications) {
    $("#notificationNav").toggle(showNotifications);

    if (!showNotifications) {
      $("#notification-count").hide().text("0");
      $("#notificationList").html(
        '<div class="notification-empty-state">No new notifications.</div>',
      );
    }
  }

  function normalizeNumber(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeStatus(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
  }

  function buildNotificationMarkup(items) {
    if (!items.length) {
      return '<div class="notification-empty-state">No new notifications.</div>';
    }

    const itemMarkup = items
      .map(
        (item) => `
          <a class="notification-item notification-item--${item.tone}" href="${item.href}">
            <span class="notification-item-icon"><i class="${item.icon}"></i></span>
            <span class="notification-item-copy">
              <span class="notification-item-title">
                <span class="notification-item-heading">
                  <h6>${item.title}</h6>
                </span>
                <span class="notification-item-count">${item.count}</span>
              </span>
              <p>${item.message}</p>
              <span class="notification-item-link-label">${item.ctaLabel}</span>
            </span>
          </a>
        `,
      )
      .join("");

    return `
      <div class="notification-items-scroll">
        ${itemMarkup}
      </div>
      <a class="notification-view-all" href="orderDetails.html">View all notifications</a>
    `;
  }

  function renderNavbarNotifications(items) {
    const total = items.reduce(
      (sum, item) => sum + normalizeNumber(item.count),
      0,
    );

    if (total > 0) {
      $("#notification-count").show().text(total);
    } else {
      $("#notification-count").hide().text("0");
    }

    $("#notificationList").html(buildNotificationMarkup(items));
  }

  function getResponseData(response) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  }

  function countRecordsByStatus(records, targetStatus) {
    const normalizedTarget = normalizeStatus(targetStatus);

    return getResponseData(records).filter((record) => {
      const status = normalizeStatus(record?.status || record?.approval_status);
      return status === normalizedTarget;
    }).length;
  }

  function countRejectedProducts(products) {
    return getResponseData(products).filter(
      (product) => normalizeStatus(product?.approval_status) === "rejected",
    ).length;
  }

  function countPendingProducts(products, fallbackCount) {
    const productRecords = getResponseData(products);

    if (!productRecords.length) {
      return normalizeNumber(fallbackCount);
    }

    return productRecords.filter(
      (product) =>
        normalizeStatus(product?.approval_status || "pending") === "pending",
    ).length;
  }

  function getOrderStatus(order) {
    const status = normalizeStatus(order?.shipping_status || order?.status);

    if (status === "processing" || status === "to_ship") return "packed";
    if (status === "completed") return "delivered";
    if (status === "pending_payment") return "pending";

    return status || "pending";
  }

  function countOrdersByStatus(orders, targetStatus) {
    return getResponseData(orders).filter(
      (order) => getOrderStatus(order) === targetStatus,
    ).length;
  }

  function countOrdersWithPaymentUpdates(orders) {
    return getResponseData(orders).filter((order) => {
      const paymentStatus = normalizeStatus(order?.payment_status);
      return paymentStatus && paymentStatus !== "pending";
    }).length;
  }

  function countOrdersWithTracking(orders) {
    return getResponseData(orders).filter((order) =>
      String(order?.tracking_number || "").trim(),
    ).length;
  }

  function countCartStockAlerts(cartResponse) {
    const cartItems = cartResponse?.cart || getResponseData(cartResponse);

    return cartItems.filter((item) => {
      const quantity = normalizeNumber(item?.quantity || 1);
      const stock = normalizeNumber(item?.product?.stock_quantity);
      const productStatus = normalizeStatus(item?.product?.status || "active");
      const approvalStatus = normalizeStatus(
        item?.product?.approval_status || "approved",
      );

      return (
        stock <= 0 ||
        quantity > stock ||
        productStatus !== "active" ||
        approvalStatus !== "approved"
      );
    }).length;
  }

  function isDashboardPage() {
    const pageName = window.location.pathname.split("/").pop().toLowerCase();
    return pageName === "dashboard.html" || pageName === "admindashboard.html";
  }

  function buildRoleNotifications(role, sources) {
    const counts = sources.counts || {};
    const products = sources.products || [];
    const categories = sources.categories || [];
    const brands = sources.brands || [];
    const items = [];
    const pendingProducts =
      role === "admin"
        ? countPendingProducts(products, counts.pending_approval)
        : normalizeNumber(counts.pending_approval);
    const lowStockProducts = normalizeNumber(counts.low_stock_products);
    const pendingOrders = normalizeNumber(counts.pending_orders);
    const cancelledOrders = normalizeNumber(counts.cancelled_orders);
    const pendingCategories = countRecordsByStatus(categories, "pending");
    const pendingBrands = countRecordsByStatus(brands, "pending");
    const rejectedProducts = countRejectedProducts(products);

    if (role === "admin") {
      if (pendingProducts > 0) {
        items.push({
          tone: "warning",
          icon: "fas fa-clipboard-check",
          title: "Pending product approvals",
          count: pendingProducts,
          message: `${pluralize(pendingProducts, "product")} waiting for review.`,
          href: "product.html?approval_status=pending",
          ctaLabel: "View",
        });
      }

      if (pendingOrders > 0) {
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

      if (lowStockProducts > 0) {
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

      if (cancelledOrders > 0) {
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
      if (pendingOrders > 0) {
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

      if (lowStockProducts > 0) {
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

      if (pendingProducts > 0) {
        items.push({
          tone: "warning",
          icon: "fas fa-clock",
          title: "Pending product approvals",
          count: pendingProducts,
          message: `${pluralize(pendingProducts, "product")} are still under review.`,
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

      if (cancelledOrders > 0) {
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

  function buildBuyerNotifications(orders, cartResponse) {
    const items = [];
    const orderRecords = getResponseData(orders);
    const placedOrders = orderRecords.length;
    const paymentUpdates = countOrdersWithPaymentUpdates(orderRecords);
    const shippedOrders = countOrdersByStatus(orderRecords, "shipped");
    const deliveredOrders = countOrdersByStatus(orderRecords, "delivered");
    const cancelledOrders = countOrdersByStatus(orderRecords, "cancelled");
    const trackingUpdates = countOrdersWithTracking(orderRecords);
    const cartStockAlerts = countCartStockAlerts(cartResponse);
    const href = "orderDetails.html";

    if (placedOrders > 0) {
      items.push({
        tone: "info",
        icon: "fas fa-receipt",
        title: "Orders placed",
        count: placedOrders,
        message: `${placedOrders} ${placedOrders === 1 ? "order has" : "orders have"} been placed from your account.`,
        href,
        ctaLabel: "View Orders",
      });
    }

    if (paymentUpdates > 0) {
      items.push({
        tone: "info",
        icon: "fas fa-credit-card",
        title: "Payment updates",
        count: paymentUpdates,
        message: `${paymentUpdates} ${paymentUpdates === 1 ? "order has" : "orders have"} updated payment status.`,
        href: "orderDetails.html?filter=payment",
        ctaLabel: "View Payments",
      });
    }

    if (shippedOrders > 0) {
      items.push({
        tone: "info",
        icon: "fas fa-shipping-fast",
        title: "Orders shipped",
        count: shippedOrders,
        message: `${shippedOrders} ${shippedOrders === 1 ? "order is" : "orders are"} on the way.`,
        href: "orderDetails.html?status=shipped",
        ctaLabel: "View Orders",
      });
    }

    if (deliveredOrders > 0) {
      items.push({
        tone: "success",
        icon: "fas fa-check-circle",
        title: "Orders delivered",
        count: deliveredOrders,
        message: `${deliveredOrders} ${deliveredOrders === 1 ? "order has" : "orders have"} been delivered.`,
        href: "orderDetails.html?status=delivered",
        ctaLabel: "View Orders",
      });
    }

    if (cancelledOrders > 0) {
      items.push({
        tone: "danger",
        icon: "fas fa-ban",
        title: "Orders cancelled",
        count: cancelledOrders,
        message: `${cancelledOrders} ${cancelledOrders === 1 ? "order was" : "orders were"} cancelled.`,
        href: "orderDetails.html?status=cancelled",
        ctaLabel: "View Orders",
      });
    }

    if (trackingUpdates > 0) {
      items.push({
        tone: "info",
        icon: "fas fa-map-marker-alt",
        title: "Tracking added",
        count: trackingUpdates,
        message: `Tracking numbers are available for ${pluralize(trackingUpdates, "order")}.`,
        href: "orderDetails.html?filter=tracking",
        ctaLabel: "View Tracking",
      });
    }

    if (cartStockAlerts > 0) {
      items.push({
        tone: "warning",
        icon: "fas fa-shopping-cart",
        title: "Cart stock alerts",
        count: cartStockAlerts,
        message: `${cartStockAlerts} ${cartStockAlerts === 1 ? "item" : "items"} in your cart ${cartStockAlerts === 1 ? "is" : "are"} out of stock or have limited stock.`,
        href: "cart.html",
        ctaLabel: "View Cart",
      });
    }

    return items;
  }

  function getJson(url, headers) {
    return $.ajax({ url, method: "GET", headers }).then(
      function (response) {
        return response;
      },
      function () {
        return null;
      },
    );
  }

  function loadNavbarNotifications(role, token) {
    if ($("#notificationNav").length === 0) {
      return;
    }

    if (isDashboardPage()) {
      return;
    }

    if (!token) {
      renderNavbarNotifications([]);
      return;
    }

    if (role !== "admin" && role !== "seller" && !isBuyerRole(role)) {
      renderNavbarNotifications([]);
      return;
    }

    const requestKey = `${role}:${token}`;
    if (notificationRequestKey === requestKey) {
      return;
    }

    notificationRequestKey = requestKey;

    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };

    if (isBuyerRole(role)) {
      $.when(
        getJson(`${apiBase}/api/checkout/orders`, headers),
        getJson(`${apiBase}/api/cart`, headers),
      ).done(function (orders, cartResponse) {
        renderNavbarNotifications(
          buildBuyerNotifications(orders, cartResponse),
        );
      });
      return;
    }

    const requests = [
      getJson(`${apiBase}/api/counts`, headers),
      getJson(`${apiBase}/api/products`, headers),
      getJson(`${apiBase}/api/category`, headers),
      getJson(`${apiBase}/api/brands`, headers),
    ];

    $.when(...requests)
      .done(function (counts, products, categories, brands) {
        const roleNotifications = buildRoleNotifications(role, {
          counts: counts || {},
          products,
          categories,
          brands,
        });

        renderNavbarNotifications(roleNotifications);
      })
      .fail(function () {
        notificationRequestKey = null;
        renderNavbarNotifications([]);
      });
  }

  window.applyNavbarRoleVisibility = function () {
    const username = $.cookie("username");
    const token = $.cookie("token");
    const role = normalizeRole($.cookie("role"));
    const isLoggedIn = Boolean(username && token);
    const isUser = isLoggedIn && isBuyerRole(role);
    const isSeller = isLoggedIn && role === "seller";
    const isAdmin = isLoggedIn && role === "admin";
    const showCart = isUser || (isSeller && SELLER_CAN_BUY);
    const showNotifications = isLoggedIn;

    const $dropdown = $(".dropdown-menu[aria-labelledby='navbardrop']");
    $dropdown
      .find(
        ".guest-only, .auth-only, .user-only, .seller-only, .admin-only, .buyer-seller-only, .seller-buyer-optional",
      )
      .hide();
    $dropdown.find(".dropdown-divider").hide();
    $("#productUi").hide();

    if (!isLoggedIn) {
      $dropdown.find(".guest-only").show();
      setCartVisibility(false);
      setNotificationVisibility(false);
      $("#displayUsername").html("Sign In");
      $("#username").html("Sign In");
      $("#navbarProfileImage").hide();
      $("#defaultProfileIcon").hide();
      return;
    }

    $dropdown.find(".auth-only").show();
    $("#displayUsername, #username").html(`<b>${username}</b>`);
    setNotificationVisibility(showNotifications);

    if (isUser) {
      $dropdown.find(".user-only").not(".seller-only, .admin-only").show();
      $dropdown.find(".buyer-seller-only").show();
      $dropdown.find(".user-divider").show();
    }

    if (isSeller) {
      $dropdown.find(".seller-only").not(".admin-only").show();
      $dropdown.find(".buyer-seller-only").show();
      if (SELLER_CAN_BUY) {
        $dropdown.find(".seller-buyer-optional").show();
      }
      $("#productUi").show();
      $dropdown.find(".seller-divider").show();
    }

    if (isAdmin) {
      $dropdown.find(".admin-only").show();
      $dropdown.find(".admin-divider").show();
    }

    setCartVisibility(showCart);
    loadNavbarNotifications(role, token);
  };

  function wrapUserLoader(name) {
    const original = window[name];
    if (typeof original !== "function" || original.__navbarRoleWrapped) {
      return;
    }

    window[name] = function () {
      const result = original.apply(this, arguments);
      window.applyNavbarRoleVisibility();
      return result;
    };
    window[name].__navbarRoleWrapped = true;
  }

  wrapUserLoader("load_user");
  wrapUserLoader("loadUser");

  $(document).ready(window.applyNavbarRoleVisibility);
  $(window).on("load", window.applyNavbarRoleVisibility);
})(jQuery);
