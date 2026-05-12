/* ================================
   GLOBAL VARIABLES
================================ */
const ip = "http://localhost:8000";
let token = null;
let usr = null;
let role = null;
let profileImage = null;
let currentUserId = null;
let latestCartItems = [];

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
  const $adminDashboard = $("#adminDashboard");
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");

  $(".guest-only, .auth-only, .user-only, .seller-only, .admin-only").hide();
  $(".dropdown-divider").hide();

  // No session → show login/register
  if (!usr || !token) {
    $displayUsername.html("My Account");
    $login.show();
    $register.show();
    $logout.hide();
    $cartCount.hide();
    $adminDashboard.hide();
    $navbarProfileImage.hide();
    $defaultProfileIcon.show();
    if (typeof applyNavbarRoleVisibility === "function") {
      applyNavbarRoleVisibility();
    }
    return;
  }

  // Session exists → update UI
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

  // Role-based access
  if (role === "admin" || role === "seller") {
    $adminDashboard.show();
  } else {
    $adminDashboard.hide();
  }

  if (typeof applyNavbarRoleVisibility === "function") {
    applyNavbarRoleVisibility();
  }
}

/* ------------------------------
   Load Cart Items
------------------------------ */
function loadCartItems() {
  $.ajax({
    url: `${ip}/api/cart`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (response) {
      const cartItems = response.cart || response.data || [];
      latestCartItems = cartItems;
      const $container = $("#cart-items-container");
      $container.empty();

      let totalAmount = 0;
      let unavailableCount = 0;

      cartItems.forEach((item) => {
        const id = item.addTocart_id;
        const name = item.product?.product_name ?? "Unnamed Product";
        const price = item.product?.product_price ?? 0;
        const quantity = item.quantity ?? 1;
        let stock = parseInt(item.product?.stock_quantity ?? 0, 10);
        if (isNaN(stock)) {
          stock = 0;
        }
        const isOutOfStock = stock <= 0;
        const isOverStock = !isOutOfStock && quantity > stock;
        const isOwnProduct = isOwnSellerCartItem(item);
        const cannotCheckout = isOutOfStock || isOverStock || isOwnProduct;
        if (cannotCheckout) {
          unavailableCount++;
        }
        const stockStatusHtml = isOutOfStock
          ? `
              <span class="out-of-stock-badge">Out of stock</span>
              <p class="cart-stock-warning mb-0">This item is unavailable and cannot be checked out.</p>
            `
          : isOverStock
            ? `
                <span class="stock-warning-badge">Stock changed</span>
                <p class="cart-stock-warning mb-0">Only ${stock} available. Reduce quantity to check out.</p>
              `
            : isOwnProduct
              ? `
                <span class="stock-warning-badge">Own product</span>
                <p class="cart-stock-warning mb-0">You cannot check out your own product.</p>
              `
              : `<small class="text-muted">In stock: ${stock}</small>`;

        const subtotal = item.subtotal ?? price * quantity;
        totalAmount += subtotal;

        // Note: Included the checkbox to maintain your "selected checkout" logic
        const cardHtml = `
          <div class="cart-item-card ${cannotCheckout ? "stock-issue" : ""}" data-price="${price}" data-stock="${stock}" data-own-product="${isOwnProduct}">
            <div class="cart-select-cell">
               <input type="checkbox" class="select-item form-check-input m-0" style="transform: scale(1.2);" data-id="${id}" data-price="${subtotal}" data-stock-issue="${cannotCheckout}" ${cannotCheckout ? "disabled" : ""}>
            </div>

            <div class="cart-image-cell">
               <img src="${ip}/FrontEnd/assets/img/product/${item.product.image}" alt="${name}" class="cart-item-img">
            </div>

            <div class="flex-grow-1">
               <h5 class="fw-bold mb-1" style="color: #2c3e50;">${name}</h5>
               <div class="cart-stock-status">${stockStatusHtml}</div>
               <p class="mb-0 text-dark">Price: <span class="fw-bold">₱${price.toLocaleString()}</span></p>
            </div>

            <div class="mx-4">
                <div class="quantity-pill-container">
                    <button class="changeQuantity minus-btn" data-id="${id}" data-action="minus" ${quantity <= 1 || isOutOfStock ? "disabled" : ""}>-</button>
                    <span class="quantity">${quantity}</span>
                    <button class="changeQuantity plus-btn" data-id="${id}" data-action="plus" ${quantity >= stock || isOutOfStock ? "disabled" : ""}>+</button>
                </div>
            </div>

            <div class="text-end" style="min-width: 150px;">
                <p class="small text-muted mb-0">Item Total:</p>
                <h5 class="fw-bold total_price mb-2">₱${subtotal.toLocaleString()}</h5>
                <button class="delete-btn-custom deleteBtn" data-id="${id}">
                    <i class="far fa-trash-alt"></i>
                </button>
            </div>
          </div>
        `;
        $container.append(cardHtml);
      });

      $("#item-count-footer").text(
        `You have ${cartItems.length} items in your cart.`,
      );

      $("#cart-stock-alert").remove();
      if (unavailableCount > 0) {
        $(".order-summary-card .card-body").prepend(`
          <div class="cart-stock-alert" id="cart-stock-alert">
            ${unavailableCount} item(s) cannot be checked out because stock is unavailable, below your cart quantity, or owned by your seller account.
          </div>
        `);
      }

      // Checkboxes unchecked by default and update selected total
      $(".select-item").prop("checked", false);
      updateSelectedTotal();
    },
    error: function (xhr) {
      console.error("Error fetching cart items:", xhr.responseText);
    },
  });
}

function isOwnSellerCartItem(item = {}) {
  if (role !== "seller") return false;

  const product = item.product || {};
  const sellerId =
    item.seller_id ||
    item.seller?.user_id ||
    item.seller?.id ||
    product.seller_id ||
    product.seller?.user_id ||
    product.seller?.id;
  const sellerUsername =
    item.seller_username ||
    item.seller?.username ||
    product.seller_username ||
    product.seller?.username;

  return Boolean(
    (currentUserId && sellerId && String(currentUserId) === String(sellerId)) ||
    (usr &&
      sellerUsername &&
      String(usr).toLowerCase() === String(sellerUsername).toLowerCase()),
  );
}

/* ============================================================
   MAIN SCRIPT (Document Ready)
============================================================ */
$(document).ready(function () {
  let cartDataTable = null;

  /* ------------------------------
     Load User Session
  ------------------------------ */
  load_user();

  /* ------------------------------
     Select Item Checkbox
  ------------------------------ */
  $(document).on("change", ".select-item", function () {
    updateSelectedTotal();
  });

  $(document)
    .ajaxStart(() => $("#wait").show())
    .ajaxComplete(() => $("#wait").hide());

  // --- Sidebar Toggle ---
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
        currentUserId = response?.user_id || response?.id || currentUserId;
        loadCartItems();
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
        loadCartItems();
      },
    });
  } else {
    console.error("No username found in cookie.");
    loadCartItems();
  }

  /* ------------------------------
     Check Out Button
  ------------------------------ */
  $(document).on("click", "#checkout-btn", function (e) {
    e.preventDefault();

    const selectedIds = [];

    if (cartDataTable) {
      cartDataTable
        .rows()
        .nodes()
        .to$() // Convert to jQuery object
        .find('input.select-item[type="checkbox"]:checked:not(:disabled)')
        .each(function () {
          selectedIds.push($(this).data("id")); // Get the 'data-id'
        });
    } else {
      // Fallback if DataTables hasn't initialized (shouldn't happen)
      $('input.select-item[type="checkbox"]:checked:not(:disabled)').each(
        function () {
          selectedIds.push($(this).data("id"));
        },
      );
    }

    if (selectedIds.length === 0) {
      Swal.fire(
        "No Items Selected",
        "Please select at least one available item to check out.",
        "warning",
      );
      return; // Stop if nothing is selected
    } // Store the selected IDs in sessionStorage

    const selectedOwnProduct = latestCartItems.some(
      (item) =>
        selectedIds.some((id) => String(id) === String(item.addTocart_id)) &&
        isOwnSellerCartItem(item),
    );

    if (selectedOwnProduct) {
      Swal.fire(
        "Not Allowed",
        "You cannot check out products from your own shop.",
        "warning",
      );
      return;
    }

    sessionStorage.setItem("selectedCartItems", JSON.stringify(selectedIds)); // Now, redirect to the checkout page // UPDATE THIS to your checkout page's file name

    window.location.href = "checkout.html";
  });

  /* ------------------------------
     Delete Cart Item
  ------------------------------ */
  $(document).on("click", ".deleteBtn", function (e) {
    e.preventDefault();
    const cartId = $(this).data("id");

    Swal.fire({
      title: "Are you sure?",
      text: "This item will be removed from your cart.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (!result.isConfirmed) return;

      $.ajax({
        url: `${ip}/api/cart/${cartId}`,
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        success: function (res) {
          Swal.fire("Deleted!", res.msg, "success").then(() =>
            location.reload(),
          );
        },
        error: function (xhr) {
          Swal.fire("Error!", xhr.responseText, "error");
        },
      });
    });
  });

  /* ------------------------------
     Change Quantity (+ / -)
  ------------------------------ */
  $(document).on("click", ".changeQuantity", function () {
    const $btn = $(this);
    const $card = $btn.closest(".cart-item-card");
    const $quantity = $card.find(".quantity");
    const $subtotal = $card.find(".total_price");

    const cartId = $btn.data("id");
    const action = $btn.data("action");
    let quantity = parseInt($quantity.text(), 10);
    const price = parseFloat($card.data("price"));

    let maxStock = parseInt($card.attr("data-stock"), 10);
    if (isNaN(maxStock)) {
      maxStock = 0;
    }

    if (maxStock <= 0) {
      Swal.fire(
        "Out of Stock",
        "This item is currently unavailable.",
        "warning",
      );
      return;
    }

    // Prevent spam clicking
    if ($card.data("loading")) return;
    $card.data("loading", true);

    let newQuantity = quantity;

    if (action === "plus") {
      if (quantity >= maxStock) {
        Swal.fire(
          "Stock Limit",
          `Only ${maxStock} items available.`,
          "warning",
        );
        $card.data("loading", false);
        return;
      }
      newQuantity = quantity + 1;
    } else if (action === "minus") {
      if (quantity <= 1) {
        $card.data("loading", false);
        return;
      }
      newQuantity--;
    } else {
      $card.data("loading", false);
      return;
    }

    // SEND FIRST, UPDATE UI AFTER SUCCESS
    $.ajax({
      url: `${ip}/api/cart/${cartId}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: JSON.stringify({ cart_id: cartId, quantity: newQuantity }),

      success: function (response) {
        // Catch cases where the API returns 200 OK but contains a stock error flag/message
        const isErrorPayload =
          response.status === 400 ||
          response.status === 422 ||
          response.status === "error" ||
          response.status === "failed" ||
          response.success === false ||
          response.error;
        if (isErrorPayload) {
          Swal.fire(
            "Stock Limit",
            response.message ||
              response.msg ||
              response.error ||
              "Cannot increase quantity further. Limit reached.",
            "warning",
          );
          if (action === "plus") {
            $card.find(".plus-btn").prop("disabled", true);
            $card.attr("data-stock", quantity); // Lock the frontend maxStock to the current successful quantity
          }
          return;
        }

        // If the backend implicitly capped the quantity to the available limit, catch it here
        let confirmedQuantity = newQuantity;
        if (response && response.data && response.data.quantity !== undefined) {
          confirmedQuantity = parseInt(response.data.quantity, 10);
        } else if (
          response &&
          response.cart &&
          response.cart.quantity !== undefined
        ) {
          confirmedQuantity = parseInt(response.cart.quantity, 10);
        } else if (response && response.quantity !== undefined) {
          confirmedQuantity = parseInt(response.quantity, 10);
        }

        if (action === "plus" && confirmedQuantity < newQuantity) {
          Swal.fire(
            "Stock Limit",
            response.message || `Only ${confirmedQuantity} items available.`,
            "warning",
          );
          $card.find(".plus-btn").prop("disabled", true);
          $card.attr("data-stock", confirmedQuantity);
          newQuantity = confirmedQuantity; // Fallback the UI update to the allowed amount
        }

        if (response.status === 200 || response.success || !response.status) {
          // NOW update UI safely
          $quantity.text(newQuantity);

          const newTotal = price * newQuantity;
          $subtotal.text(
            `₱${newTotal.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
          );

          $card.find(".minus-btn").prop("disabled", newQuantity <= 1);

          let updatedMaxStock = parseInt($card.attr("data-stock"), 10);
          if (isNaN(updatedMaxStock)) {
            updatedMaxStock = 0;
          }
          $card
            .find(".plus-btn")
            .prop("disabled", newQuantity >= updatedMaxStock);

          const isOwnProduct = $card.data("own-product") === true;
          const canCheckoutItem =
            !isOwnProduct &&
            updatedMaxStock > 0 &&
            newQuantity <= updatedMaxStock;

          $card
            .toggleClass("stock-issue", !canCheckoutItem)
            .find(".select-item")
            .prop("disabled", !canCheckoutItem)
            .data("stock-issue", !canCheckoutItem)
            .attr("data-stock-issue", !canCheckoutItem)
            .data("price", newTotal)
            .attr("data-price", newTotal);

          $card.find(".cart-stock-status").html(
            canCheckoutItem
              ? `<small class="text-muted">In stock: ${updatedMaxStock}</small>`
              : isOwnProduct
                ? `
                  <span class="stock-warning-badge">Own product</span>
                  <p class="cart-stock-warning mb-0">You cannot check out your own product.</p>
                `
                : `
                  <span class="stock-warning-badge">Stock changed</span>
                  <p class="cart-stock-warning mb-0">Only ${updatedMaxStock} available. Reduce quantity to check out.</p>
                `,
          );

          updateSelectedTotal();
        }
      },

      error: function (xhr) {
        console.error("Error updating cart:", xhr.responseText);

        let errorMsg = "Unable to update quantity. Please try again.";
        // Extract the exact error message from the backend if it sends one
        if (
          xhr.responseJSON &&
          (xhr.responseJSON.message ||
            xhr.responseJSON.msg ||
            xhr.responseJSON.error)
        ) {
          if (xhr.responseJSON.errors && xhr.responseJSON.errors.quantity) {
            errorMsg = xhr.responseJSON.errors.quantity[0];
          } else {
            errorMsg =
              xhr.responseJSON.message ||
              xhr.responseJSON.msg ||
              xhr.responseJSON.error;
          }
        }

        Swal.fire("Stock Limit", errorMsg, "warning");

        // Forcefully disable the plus button since the backend rejected the increment
        if (action === "plus") {
          $card.find(".plus-btn").prop("disabled", true);
          $card.attr("data-stock", quantity);
        }
      },

      complete: function () {
        //  Re-enable clicks
        $card.data("loading", false);
      },
    });
  });

  /* ------------------------------
     Update Total Amount
  ------------------------------ */
  function updateSelectedTotal() {
    let selectedTotal = 0;
    const $selectedItems = $("input.select-item:checked:not(:disabled)");
    const hasAvailableItems = $("input.select-item:not(:disabled)").length > 0;

    $("#checkout-btn").prop("disabled", !hasAvailableItems);

    const unavailableCount = $(".cart-item-card.stock-issue").length;
    if (unavailableCount === 0) {
      $("#cart-stock-alert").remove();
    } else {
      $("#cart-stock-alert").text(
        `${unavailableCount} item(s) cannot be checked out because stock is unavailable or below your cart quantity.`,
      );
    }

    $selectedItems.each(function () {
      selectedTotal += parseFloat($(this).data("price"));
    });

    if ($selectedItems.length > 0) {
      $("#subtotal-display").text(`₱${selectedTotal.toLocaleString()}`);
      $("#total-amount").text(`₱${selectedTotal.toLocaleString()}`);
      $("#subtotal-row").show();
      $("#total-row").show();
      $("#summary-hr").show();
    } else {
      $("#subtotal-display").text("₱0");
      $("#total-amount").text("₱0");
      $("#subtotal-row").hide();
      $("#total-row").hide();
      $("#summary-hr").hide();
    }
  }

  /* ------------------------------
     Update Cart Count (Navbar)
  ------------------------------ */
  function updateCartCount(count) {
    $("#cart-count").text(count);
  }

  // Fetch cart count on page load
  $.ajax({
    url: `${ip}/api/cart`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (response) {
      console.log("Cart Count Response:", response);
      updateCartCount(response.count);
    },
  });

  // --- Logout Functionality ---
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
              window.location.replace("index.html");
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
