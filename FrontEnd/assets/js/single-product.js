/* ================================
   GLOBAL VARIABLES
================================ */
if (!window.APP_CONFIG?.API_BASE_URL) {
  throw new Error(
    "APP_CONFIG is missing. Load config.js before single-product.js.",
  );
}

const ip = window.APP_CONFIG.API_BASE_URL;

let token = null;
let usr = null;
let role = null;
let profileImage = null;
let currentProductStock = 0;
let currentProductAvailable = false;
let currentUserId = null;
let currentProductSellerId = null;
let currentProductSellerUsername = "";

// =======================================
// Utility Functions
// =======================================
function getApiHeaders(extraHeaders = {}) {
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

// =======================================
// Product Data Handling Functions
// =======================================
function getProductCategoryName(product) {
  if (product?.category && typeof product.category === "object") {
    return (
      product.category.name || product.category.category_name || "Uncategorized"
    );
  }

  return product?.category || product?.category_name || "Uncategorized";
}

function getProductBrandName(product) {
  if (product?.brand && typeof product.brand === "object") {
    return product.brand.name || product.brand.brand_name || "Unbranded";
  }

  return product?.brand || product?.brand_name || "Unbranded";
}

function getProductSellerName(product) {
  return product?.seller?.username || product?.seller_username || "Seller";
}

function resolveProductImage(image) {
  if (!image) {
    return "assets/img/back.jpg";
  }

  const src = String(image).trim();

  if (/^(https?:)?\/\//i.test(src)) {
    return src;
  }

  if (src.startsWith("/")) {
    return `${ip}${src}`;
  }

  if (src.includes("assets/")) {
    return `${ip}/${src.replace(/^\/+/, "")}`;
  }

  const filename = src.split(/[\\/]/).pop();

  return `${ip}/FrontEnd/assets/img/product/${encodeURIComponent(filename)}`;
}

function syncQuantityControls() {
  const $input = $("#product-quantity-input");
  const $decrease = $("#quantity-decrease");
  const $increase = $("#quantity-increase");

  if (!currentProductAvailable || currentProductStock <= 0) {
    $input.val(0).prop("disabled", true);
    $decrease.prop("disabled", true);
    $increase.prop("disabled", true);
    return;
  }

  let quantity = parseInt($input.val(), 10);

  if (!Number.isFinite(quantity)) {
    quantity = 1;
  }

  quantity = Math.max(1, Math.min(quantity, currentProductStock));

  $input.val(quantity).attr("max", currentProductStock).prop("disabled", false);

  $decrease.prop("disabled", quantity <= 1);
  $increase.prop("disabled", quantity >= currentProductStock);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =======================================
// User Session Handling
// =======================================
function load_user() {
  usr = $.cookie("username");
  token = $.cookie("token");
  role = $.cookie("role");
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
    return;
  }

  // Session exists → update UI
  $displayUsername.html(`<b>${usr}</b>`);
  $login.hide();
  $register.hide();
  $logout.show();

  // Keep the badge hidden until the cart count is loaded
  $cartCount.text("").hide();

  // Role-based access
  if (role === "admin" || role === "seller") {
    $adminDashboard.show();
  } else {
    $adminDashboard.hide();
  }
}

/* ============================================================
   PRODUCT DETAILS PAGE
============================================================ */
$(document).ready(function () {
  load_user();

  // -------------------------------
  // Quantity Controls
  // -------------------------------
  $("#quantity-decrease").on("click", function () {
    const currentQuantity =
      parseInt($("#product-quantity-input").val(), 10) || 1;

    $("#product-quantity-input").val(currentQuantity - 1);

    syncQuantityControls();
  });

  $("#quantity-increase").on("click", function () {
    const currentQuantity =
      parseInt($("#product-quantity-input").val(), 10) || 1;

    $("#product-quantity-input").val(currentQuantity + 1);

    syncQuantityControls();
  });

  $("#product-quantity-input").on("input change", function () {
    syncQuantityControls();
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
  if (usr && token) {
    $.ajax({
      url: `${ip}/api/getAccount_username/${usr}`,
      type: "GET",
      headers: getApiHeaders(),
      dataType: "json",
      success: function (response) {
        currentUserId = response?.user_id || response?.id || currentUserId;
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

  // --- Get Product ID from URL ---
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get("id");

  if (!productId) {
    console.error("❌ No product ID found in URL.");
    return;
  }

  console.log(" Product ID:", productId);

  // --- Fetch Product Details ---
  $.ajax({
    url: `${ip}/api/products/${productId}?scope=public`,
    method: "GET",
    headers: getApiHeaders(),
    success: function (response) {
      console.log(" Product Response:", response);

      // Handle if the API returns an array or wraps it in 'product' or 'data'
      let product = response.product || response.data || response;
      if (Array.isArray(product)) {
        product = product[0];
      }

      if (!product) {
        console.error("Product data not found in response.");
        return;
      }

      // Extract product details
      const category = getProductCategoryName(product);
      const brand = getProductBrandName(product);
      const sellerName = getProductSellerName(product);

      const productName =
        product.product_name || product.name || "Unknown Product";

      const soldCount = Math.max(0, Number(product.sold) || 0);

      const imgUrl = resolveProductImage(product.image);

      const price = Number.parseFloat(
        product.product_price || product.price || 0,
      );

      currentProductSellerId =
        product.seller?.user_id ||
        product.seller?.id ||
        product.seller_id ||
        "";

      currentProductSellerUsername =
        product.seller?.username || product.seller_username || "";

      /* Product image */
      $("#main-img")
        .attr("src", imgUrl)
        .attr("alt", productName)
        .off("error.productImage")
        .on("error.productImage", function () {
          $(this).attr("src", "assets/img/back.jpg");
        });

      /* Breadcrumb */
      $("#breadcrumb-category").text(category);
      $("#breadcrumb-product").text(productName);

      /* Main information */
      $("#category-name").text(category);
      $("#product-name").text(productName);
      $("#brand-name").text(brand);
      $("#seller-name").text(sellerName);

      $("#sold-count").text(soldCount.toLocaleString("en-PH"));

      $("#product-price").text(
        `₱${price.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      );

      /* Product description */
      $("#product-details-text").text(
        product.product_description ||
          product.description ||
          "No product description available.",
      );

      const stock = product.stock_quantity ?? product.stock ?? 0;
      const productStatus = (product.status || "active").toLowerCase();
      const approvalStatus = (
        product.approval_status || "approved"
      ).toLowerCase();
      currentProductStock = parseInt(stock, 10) || 0;
      currentProductAvailable =
        approvalStatus === "approved" &&
        productStatus === "active" &&
        currentProductStock > 0;

      const $availability = $(".product-availability");

      if (currentProductAvailable) {
        $("#stock-status").text("In Stock");

        $("#product-stock").text(
          `${currentProductStock} ${
            currentProductStock === 1 ? "piece" : "pieces"
          } available`,
        );

        $availability.removeClass("product-availability--unavailable");
      } else {
        $("#stock-status").text("Out of Stock");
        $("#product-stock").text("This product is currently unavailable.");

        $availability.addClass("product-availability--unavailable");
      }

      $("#product-quantity-input").val(currentProductAvailable ? 1 : 0);

      $(".product-add-to-cart-btn, .product-buy-now-btn").prop(
        "disabled",
        !currentProductAvailable,
      );

      syncQuantityControls();

      // Load products from the same shop
      loadSameShopProducts(product);
    },
    error: function (xhr) {
      console.error(" Error fetching product:", xhr.responseText);
    },
  });

  // --- Load Same Shop Products ---
  function loadSameShopProducts(currentProduct) {
    const currentProductId = currentProduct.product_id || currentProduct.id;

    const $container = $("#sameShop-products");

    $container.html(`
    <div class="related-products-loading">
      <i class="fas fa-spinner fa-spin"></i>
      Loading more products from this seller...
    </div>
  `);

    $.ajax({
      url: `${ip}/api/products/${currentProductId}/related?limit=6`,
      method: "GET",
      headers: getApiHeaders(),

      success: function (response) {
        const relatedProducts = Array.isArray(response?.data)
          ? response.data
          : [];

        $container.empty();

        if (!relatedProducts.length) {
          $container.html(`
          <div class="related-products-empty">
            <i class="fas fa-store"></i>
            <strong>No other products available</strong>
            <span>This seller currently has no other available products.</span>
          </div>
        `);

          return;
        }

        relatedProducts.forEach(function (product) {
          const productId = product.product_id || product.id;

          const productName = escapeHtml(
            product.product_name || product.name || "Unknown Product",
          );

          const category = escapeHtml(getProductCategoryName(product));

          const brand = escapeHtml(getProductBrandName(product));

          const imageUrl = resolveProductImage(product.image);

          const price = Number(product.product_price || product.price || 0);

          const sold = Math.max(0, Number(product.sold) || 0);

          $container.append(`
          <article class="related-product-card">
            <a
              href="single-product.html?id=${encodeURIComponent(productId)}"
              class="related-product-image-link"
            >
              <div class="related-product-image-wrap">
                <img
                  src="${escapeHtml(imageUrl)}"
                  alt="${productName}"
                  class="related-product-image"
                  onerror="this.onerror=null;this.src='assets/img/back.jpg';"
                />
              </div>
            </a>

            <div class="related-product-body">
              <span class="related-product-category">
                ${category}
              </span>

              <a
                href="single-product.html?id=${encodeURIComponent(productId)}"
                class="related-product-title"
              >
                ${productName}
              </a>

              <div class="related-product-meta">
                <span>${brand}</span>
                <span>${sold.toLocaleString("en-PH")} sold</span>
              </div>

              <div class="related-product-footer">
                <strong class="related-product-price">
                  ₱${price.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>

                <a
                  href="single-product.html?id=${encodeURIComponent(productId)}"
                  class="related-product-view"
                  aria-label="View ${productName}"
                >
                  <i class="fas fa-arrow-right"></i>
                </a>
              </div>
            </div>
          </article>
        `);
        });
      },

      error: function (xhr) {
        console.error("Error fetching related products:", xhr.responseText);

        $container.html(`
        <div class="related-products-empty">
          <i class="fas fa-exclamation-circle"></i>
          <strong>Unable to load products</strong>
          <span>Please try again later.</span>
        </div>
      `);
      },
    });
  }

  /* ============================================================
     CART FUNCTIONS
  ============================================================ */
  function updateCartCount(count) {
    const cartCount = Number(count) || 0;
    const userRole = String(role || "").toLowerCase();
    const $cartBadges = $("#cart-count, #cart-count-mobile");

    if (token && userRole !== "admin" && cartCount > 0) {
      $cartBadges.text(cartCount).show();
    } else {
      $cartBadges.text("").hide();
    }
  }

  function isOwnSellerProduct() {
    if (String(role || "").toLowerCase() !== "seller") return false;

    const sellerIdMatches =
      currentUserId &&
      currentProductSellerId &&
      String(currentUserId) === String(currentProductSellerId);
    const sellerUsernameMatches =
      usr &&
      currentProductSellerUsername &&
      String(usr).toLowerCase() ===
        String(currentProductSellerUsername).toLowerCase();

    return Boolean(sellerIdMatches || sellerUsernameMatches);
  }

  function warnOwnSellerProduct() {
    Swal.fire(
      "Not Allowed",
      "You cannot buy or add your own product to the cart.",
      "warning",
    );
  }

  // --- Add to Cart ---
  $(".product-add-to-cart-btn").on("click", function () {
    const quantity =
      $("#product-quantity-input").val() || $("input[type=number]").val();

    const $button = $(this);

    if ($button.prop("disabled")) {
      return;
    }

    if (!currentProductAvailable || Number(quantity) > currentProductStock) {
      Swal.fire(
        "Out of Stock",
        "This product is currently unavailable.",
        "warning",
      );
      return;
    }

    if (!token) {
      Swal.fire({
        title: "Login Required",
        text: "Please login to add this item to your cart.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Login",
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = "login.html";
        }
      });
      return;
    }

    if (isOwnSellerProduct()) {
      warnOwnSellerProduct();
      return;
    }

    const originalButtonHtml = $button.html();

    $button
      .prop("disabled", true)
      .html('<i class="fas fa-spinner fa-spin"></i> Adding...');

    $.ajax({
      url: `${ip}/api/cart`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      complete: function () {
        if (currentProductAvailable) {
          $button.prop("disabled", false).html(originalButtonHtml);
        }
      },
      data: JSON.stringify({ product_id: productId, quantity }),
      success: function (response) {
        console.log("Added to cart:", response);

        const newCount = Number(response.count ?? 0);
        updateCartCount(newCount);

        Swal.fire({
          icon: "success",
          title: "Added to Cart",
          text: "This product has been added to your cart.",
          showCancelButton: true,
          confirmButtonText: "View Cart",
          cancelButtonText: "Continue Shopping",
          confirmButtonColor: "#fb774b",
          reverseButtons: true,
        }).then((result) => {
          if (result.isConfirmed) {
            window.location.href = "cart.html";
          }
        });
      },
      error: function (xhr) {
        console.error(" Error adding to cart:", xhr.responseText);

        const message =
          xhr.responseJSON?.msg ||
          xhr.responseJSON?.message ||
          "Unable to add this product to your cart.";

        Swal.fire({
          icon: "error",
          title: "Unable to Add Product",
          text: message,
        });
      },
    });
  });

  // --- Buy Now ---
  $(".product-buy-now-btn").on("click", function () {
    const quantity = Number($("#product-quantity-input").val()) || 1;
    const $button = $(this);

    if ($button.prop("disabled")) {
      return;
    }

    if (!currentProductAvailable || quantity > currentProductStock) {
      Swal.fire(
        "Out of Stock",
        "This product is currently unavailable.",
        "warning",
      );
      return;
    }

    if (!token) {
      Swal.fire({
        title: "Login Required",
        text: "Please login to purchase this item.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Login",
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = "login.html";
        }
      });

      return;
    }

    if (isOwnSellerProduct()) {
      warnOwnSellerProduct();
      return;
    }

    const originalButtonHtml = $button.html();

    $button
      .prop("disabled", true)
      .html('<i class="fas fa-spinner fa-spin"></i> Processing...');

    function restoreBuyNowButton() {
      if (currentProductAvailable) {
        $button.prop("disabled", false).html(originalButtonHtml);
      }
    }

    function redirectToBuyNowCart() {
      window.location.href = `cart.html?select_product_id=${encodeURIComponent(productId)}`;
    }

    function showBuyNowError(xhr) {
      console.error("Error during Buy Now:", xhr.responseText);

      const message =
        xhr.responseJSON?.msg ||
        xhr.responseJSON?.message ||
        "Unable to process Buy Now. Please try again.";

      Swal.fire({
        icon: "error",
        title: "Unable to Buy Product",
        text: message,
      });

      restoreBuyNowButton();
    }

    // Check whether this product already exists in the cart.
    $.ajax({
      url: `${ip}/api/cart`,
      method: "GET",
      headers: getApiHeaders(),

      success: function (response) {
        const cartItems = response.cart || response.data || [];

        const existingCartItem = cartItems.find((item) => {
          const cartProductId = item.product?.product_id ?? item.product_id;

          return String(cartProductId) === String(productId);
        });

        /*
         * If the product already exists in the cart,
         * SET its quantity to the exact Buy Now quantity.
         */
        if (existingCartItem) {
          const cartId = existingCartItem.addTocart_id;

          const existingQuantity = Number(existingCartItem.quantity) || 1;

          // No update is needed if the quantities already match.
          if (existingQuantity === quantity) {
            redirectToBuyNowCart();
            return;
          }

          $.ajax({
            url: `${ip}/api/cart/${cartId}`,
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            data: JSON.stringify({
              quantity: quantity,
            }),

            success: function () {
              redirectToBuyNowCart();
            },

            error: showBuyNowError,
          });

          return;
        }

        /*
         * Product is not yet in the cart,
         * so create a new cart entry.
         */
        $.ajax({
          url: `${ip}/api/cart`,
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          data: JSON.stringify({
            product_id: productId,
            quantity: quantity,
          }),

          success: function () {
            redirectToBuyNowCart();
          },

          error: showBuyNowError,
        });
      },

      error: showBuyNowError,
    });
  });

  // --- Fetch Cart Count on Page Load ---
  if (token) {
    $.ajax({
      url: `${ip}/api/cart`,
      method: "GET",
      headers: getApiHeaders(),
      success: function (response) {
        console.log("Cart Count:", response);

        const cartItems = response.cart || response.data || [];
        const cartCount = Number(response.count ?? cartItems.length ?? 0);

        updateCartCount(cartCount);
      },

      error: function (xhr) {
        console.error("Error loading cart count:", xhr.responseText);
        updateCartCount(0);
      },
    });
  } else {
    updateCartCount(0);
  }

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
});
