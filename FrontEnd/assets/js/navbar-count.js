(function ($) {
  const apiBase = "http://165.245.179.185:8080";
  const SELLER_CAN_SHOP = true;

  function getRole() {
    return String($.cookie("role") || "").toLowerCase();
  }

  function splitNames(value) {
    return String(value || "")
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name && name !== "n/a");
  }

  function sellerNameMatches(value, username) {
    if (!username) return false;
    return splitNames(value).includes(String(username).toLowerCase());
  }

  function sellerIdMatches(value, userId) {
    return Boolean(userId && value && String(value) === String(userId));
  }

  function itemBelongsToSeller(item, order, username, userId) {
    const sellerIds = [
      item?.seller_id,
      item?.product?.seller_id,
      item?.product?.seller?.user_id,
      item?.product?.seller?.id,
      item?.seller?.user_id,
      item?.seller?.id,
      order?.seller_id,
      order?.seller?.user_id,
      order?.seller?.id,
    ];

    if (sellerIds.some((sellerId) => sellerIdMatches(sellerId, userId))) {
      return true;
    }

    const sellerNames = [
      item?.product?.seller?.username,
      item?.seller?.username,
      item?.seller_username,
      item?.seller_name,
      order?.seller?.username,
      order?.seller_username,
      order?.seller_name,
      order?.shop_name,
    ];

    return sellerNames.some((sellerName) =>
      sellerNameMatches(sellerName, username),
    );
  }

  function orderBelongsToSeller(order, username, userId) {
    const items = Array.isArray(order?.items) ? order.items : [];
    if (items.length > 0) {
      return items.some((item) =>
        itemBelongsToSeller(item, order, username, userId),
      );
    }

    return itemBelongsToSeller({}, order, username, userId);
  }

  function countSellerOrders(orders, username, userId) {
    const seenOrderIds = new Set();

    (Array.isArray(orders) ? orders : []).forEach((order, index) => {
      if (!orderBelongsToSeller(order, username, userId)) return;

      const orderId =
        order?.checkout_id || order?.order_id || order?.id || index;
      seenOrderIds.add(String(orderId));
    });

    return seenOrderIds.size;
  }

  function setBadgeCount(count) {
    $("#cart-count, #cart-count-mobile")
      .text(count || 0)
      .show();
  }

  function sellerCanShop() {
    return SELLER_CAN_SHOP;
  }

  function showOrderBadge() {
    $("#cartNav").show();
    $("#cartNavMobile").show();
    $("#cartNav a, #cartNavMobile a")
      .attr("href", "orderDetails.html")
      .attr("title", "Seller orders");
  }

  function showCartBadge() {
    $("#cartNav").show();
    $("#cartNavMobile").show();
    $("#cartNav a, #cartNavMobile a")
      .attr("href", "cart.html")
      .attr("title", "Cart");
  }

  function hideBadge() {
    $("#cart-count, #cart-count-mobile").hide();
    $("#cartNav").hide();
    $("#cartNavMobile").hide();
  }

  function loadCartCount(token) {
    showCartBadge();

    $.ajax({
      url: `${apiBase}/api/cart`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      success: function (response) {
        setBadgeCount(response?.count || 0);
      },
      error: function (xhr) {
        console.error("Error loading navbar cart count:", xhr.responseText);
        setBadgeCount(0);
      },
    });
  }

  function loadSellerOrderCount(token) {
    showOrderBadge();

    $.ajax({
      url: `${apiBase}/api/checkout/all`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      success: function (response) {
        const orders = Array.isArray(response)
          ? response
          : response?.data || [];
        const sellerOrderCount = countSellerOrders(
          orders,
          $.cookie("username"),
          $.cookie("user_id"),
        );
        // /api/checkout/all is already seller-scoped for seller tokens; the
        // fallback keeps the badge useful if an item is missing seller metadata.
        setBadgeCount(sellerOrderCount || orders.length);
      },
      error: function (xhr) {
        console.error("Error loading seller order count:", xhr.responseText);
        setBadgeCount(0);
      },
    });
  }

  function updateNavbarCount() {
    const token = $.cookie("token");
    const role = getRole();

    if (!token) {
      hideBadge();
      return;
    }

    if (role === "seller" && sellerCanShop()) {
      loadCartCount(token);
      return;
    }

    if (role === "user" || role === "buyer") {
      loadCartCount(token);
      return;
    }

    hideBadge();
  }

  window.updateNavbarCount = updateNavbarCount;

  $(document).ready(updateNavbarCount);
})(jQuery);
