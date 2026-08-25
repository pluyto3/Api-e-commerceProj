/* ================================
   GLOBAL VARIABLES
================================ */
// const ip = "https://api.hanzgo.me";
if (!window.APP_CONFIG?.API_BASE_URL) {
  throw new Error("APP_CONFIG is missing. Load config.js before checkout.js.");
}

const ip = window.APP_CONFIG.API_BASE_URL;

let token = null;
let usr = null;
let role = null;
let profileImage = null;
let currentUserId = null;

function getApiHeaders(extraHeaders = {}) {
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

function getProductsFromResponse(response) {
  return Array.isArray(response) ? response : response.data || [];
}

function getCartItemsFromResponse(response) {
  return response.cart || response.data || [];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getStockQuantity(product) {
  const stock = Number(product?.stock_quantity);
  return Number.isFinite(stock) ? stock : 0;
}

function isHomepageProductVisible(product) {
  const approvalStatus = product?.approval_status || "approved";
  const productStatus = product?.status || "active";
  return (
    approvalStatus === "approved" &&
    productStatus === "active" &&
    getStockQuantity(product) > 0
  );
}

function getCartProductIds(cartItems) {
  return new Set(
    cartItems
      .map((item) => item.product_id ?? item.product?.product_id)
      .filter((productId) => productId !== undefined && productId !== null)
      .map((productId) => String(productId)),
  );
}

function updateCartCount(count) {
  const cartCount = Number(count) || 0;
  const $cartCount = $("#cart-count");

  // Hide badge for admin/seller or when cart is empty
  if (role === "admin" || role === "seller" || cartCount <= 0) {
    $cartCount.text("").hide();
    return;
  }

  // Show badge only when count is greater than zero
  $cartCount.text(cartCount).show();
}

function renderHomepageCartButton(product) {
  const productId = product.product_id;
  const sellerId =
    product.seller?.user_id || product.seller?.id || product.seller_id || "";
  const sellerUsername =
    product.seller?.username || product.seller_username || "";

  return `
    <button type="button"
            class="btn homepage-cart-btn add-to-cart"
            data-product-id="${productId}"
            data-seller-id="${escapeHtml(sellerId)}"
            data-seller-username="${escapeHtml(sellerUsername)}">
      <i class="fas fa-cart-plus"></i>
      <span>Add to Cart</span>
    </button>
  `;
}

function isOwnSellerProductButton($button) {
  if (String(role || "").toLowerCase() !== "seller") return false;

  const sellerId = $button.data("seller-id");
  const sellerUsername = $button.data("seller-username");

  return Boolean(
    (currentUserId && sellerId && String(currentUserId) === String(sellerId)) ||
    (usr &&
      sellerUsername &&
      String(usr).toLowerCase() === String(sellerUsername).toLowerCase()),
  );
}

function resetOwlCarousel($carousel) {
  if ($carousel.hasClass("owl-loaded")) {
    $carousel.trigger("destroy.owl.carousel");
    $carousel.removeClass("owl-loaded owl-hidden");
    $carousel.find(".owl-stage-outer").children().unwrap();
  }

  $carousel.empty();
}

function renderProductCarousel(products) {
  const $carousel = $("#product-carousel");
  resetOwlCarousel($carousel);

  if (!products.length) {
    $carousel.html("<p>No products are available right now.</p>");
    return;
  }

  products.forEach((p) => {
    const productId = p.product_id;
    const productName = escapeHtml(p.product_name || "Product");
    const productImage = escapeHtml(p.image || "");

    $carousel.append(`
      <div class="product-card">
        <a href="single-product.html?id=${productId}" class="text-decoration-none">
          <div class="product-img">
            <img src="${ip}/FrontEnd/assets/img/product/${productImage}"
                 alt="${productName}" height="100px" />
          </div>
        </a>

        <div class="card-contents d-flex align-items-center justify-content-center">
          ${renderHomepageCartButton(p)}
        </div>

        <a href="single-product.html?id=${productId}"
           class="text-success mx-1 productDetails">
          <div class="product-details">
            <h5 class="product-name">${productName}</h5>
            <p class="product-price">
              <span class="text-success">Price: &#8369;${escapeHtml(p.product_price ?? "")}</span>
            </p>
          </div>
        </a>
      </div>
    `);
  });

  const canLoopProducts = products.length > 5;

  $carousel.owlCarousel({
    loop: canLoopProducts,
    rewind: false,
    margin: 10,
    nav: products.length > 1,
    dots: products.length > 1,
    autoplay: canLoopProducts,
    autoplayHoverPause: true,
    smartSpeed: 500,
    responsive: {
      0: {
        items: 1,
      },
      480: {
        items: 2,
      },
      768: {
        items: 3,
      },
      1024: {
        items: 5,
      },
    },
  });
}

function renderFeaturedProducts(products) {
  const $featuredContainer = $("#featured-container").empty();
  const featuredProducts = products.slice(0, 4);

  if (!featuredProducts.length) {
    $featuredContainer.html(
      '<p class="text-center w-100">No featured products are available right now.</p>',
    );
    return;
  }

  featuredProducts.forEach((p) => {
    const productId = p.product_id;
    const productName = escapeHtml(p.product_name || "Product");
    const productImage = escapeHtml(p.image || "");

    $featuredContainer.append(`
      <div class="product text-center col-lg-3 col-md-4 col-sm-12 mb-4">
        <div class="position-relative">
          <div class="badge badge-danger position-absolute" style="top: 10px; left: 10px; z-index: 10;">
            Featured
          </div>
          <a href="single-product.html?id=${productId}">
            <img src="${ip}/FrontEnd/assets/img/product/${productImage}"
                 class="img-fluid mb-3"
                 alt="${productName}"
                 style="height: 400px; object-fit: cover; width: 100%;">
          </a>
        </div>

        <h5 class="p-name">${productName}</h5>
        <h4 class="p-price">&#8369;${escapeHtml(p.product_price ?? "")}</h4>
        ${renderHomepageCartButton(p)}
      </div>
    `);
  });
}

function renderDailyProducts(products) {
  const $dailyProductsContainer = $("#dailyProducts-container").empty();
  const dailyProducts = products.slice(0, 30);

  if (!dailyProducts.length) {
    $dailyProductsContainer.html(
      '<p class="text-center w-100">No daily products are available right now.</p>',
    );
    return;
  }

  dailyProducts.forEach((p) => {
    const productId = p.product_id;
    const productName = escapeHtml(p.product_name || "Product");
    const productImage = escapeHtml(p.image || "");

    $dailyProductsContainer.append(`
      <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-3">
        <div class="card dailyProductCard">
          <div class="card-body p-2 d-flex flex-column">
            <a href="single-product.html?id=${productId}" class="text-decoration-none text-dark">
              <img src="${ip}/FrontEnd/assets/img/product/${productImage}"
                   class="card-img-top rounded-0"
                   style="aspect-ratio: 1; object-fit: cover;"
                   alt="${productName}">
            </a>
            <p class="card-title mb-1" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 0.85rem; line-height: 1.2;">${productName}</p>
            <div class="mt-auto">
              <div class="d-flex justify-content-between align-items-center pt-2">
                <span style="color: #ee4d2d; font-size: 1.1rem; font-weight: 500;">&#8369;${escapeHtml(p.product_price ?? "")}</span>
                <small class="text-muted" style="font-size: 0.7rem;">Sold ${escapeHtml(p.sold ?? 0)}</small>
              </div>
              ${renderHomepageCartButton(p)}
            </div>
          </div>
        </div>
      </div>
    `);
  });
}

function fetchHomepageCartProductIds() {
  if (!token) {
    updateCartCount(0);
    return Promise.resolve(new Set());
  }

  return new Promise((resolve) => {
    $.ajax({
      url: `${ip}/api/cart`,
      method: "GET",
      headers: getApiHeaders(),
      success: (response) => {
        const cartItems = getCartItemsFromResponse(response);
        updateCartCount(response.count || cartItems.length || 0);
        resolve(getCartProductIds(cartItems));
      },
      error: (xhr) => {
        console.error("Error fetching cart:", xhr.responseText);
        updateCartCount(0);
        resolve(new Set());
      },
    });
  });
}

function loadHomepageProducts() {
  $("#product-carousel").html("<p>Loading products...</p>");
  $("#featured-container").html(
    '<p class="text-center w-100">Loading featured products...</p>',
  );
  $("#dailyProducts-container").html(
    '<p class="text-center w-100">Loading daily products...</p>',
  );

  const productsRequest = new Promise((resolve, reject) => {
    $.ajax({
      url: `${ip}/api/products?scope=public`,
      method: "GET",
      headers: getApiHeaders(),
      success: (response) => resolve(getProductsFromResponse(response)),
      error: reject,
    });
  });

  Promise.all([productsRequest, fetchHomepageCartProductIds()])
    .then(([products]) => {
      const visibleProducts = products.filter(isHomepageProductVisible);

      renderProductCarousel(visibleProducts);
      renderFeaturedProducts(visibleProducts);
      renderDailyProducts(visibleProducts);
    })
    .catch((xhr) => {
      console.error("Error fetching products:", xhr.responseText || xhr);
      $("#product-carousel").html("<p>Unable to load products.</p>");
      $("#featured-container").html(
        '<p class="text-center w-100">Unable to load featured products.</p>',
      );
      $("#dailyProducts-container").html(
        '<p class="text-center w-100">Unable to load daily products.</p>',
      );
    });
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

  const $displayUsername = $("#displayUsername");
  const $login = $("#login");
  const $register = $("#register");
  const $logout = $("#logout");
  const $cartCount = $("#cart-count");
  const $adminDashboard = $("#adminDashboard");
  const $productUi = $("#productUi");
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");

  if (!usr || !token) {
    // No session → show login/register, hide logout & cart
    $displayUsername.html("My Account");
    $login.show();
    $register.show();
    $logout.hide();
    $cartCount.hide();
    $adminDashboard.hide();
    $productUi.hide();
    $navbarProfileImage.hide();
    $defaultProfileIcon.show();
    return;
  }

  // Session exists → show username & logout
  $displayUsername.html(`<b>${usr}</b>`);
  $login.hide();
  $register.hide();
  $logout.show();

  // Keep the badge hidden until the cart count is loaded
  $cartCount.text("").hide();

  // Show admin dashboard for admin/seller only
  role === "admin" || role === "seller"
    ? $adminDashboard.show()
    : $adminDashboard.hide();

  role === "admin" || role === "seller" ? $productUi.show() : $productUi.hide();
}

/* ==========================================
   DOCUMENT READY
========================================== */
$(document).ready(() => {
  load_user();

  /* -----------------------------
     LOAD NAVBAR PROFILE IMAGE
  ----------------------------- */
  if (usr && token) {
    $.ajax({
      url: `${ip}/api/getAccount_username/${usr}`,
      type: "GET",
      headers: getApiHeaders(),
      success: (response) => {
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
      error: (xhr) => {
        console.error("Error loading profile:", xhr.responseText);
        $("#navbarProfileImage").hide();
        $("#defaultProfileIcon").show();
      },
    });
  } else {
    console.warn("No username found in cookie.");
  }

  /* -----------------------------
     SLIDER INITIALIZATION
  ----------------------------- */
  $(".slider").bxSlider({ auto: true });

  /* -----------------------------
     GLOBAL AJAX LOADING INDICATOR
  ----------------------------- */
  $(document)
    .ajaxStart(() => $("#wait").show())
    .ajaxComplete(() => $("#wait").hide());

  /* -----------------------------
     LOAD BRANDS (for Carousel)
  ----------------------------- */
  $.ajax({
    url: `${ip}/api/brands?scope=public`,
    method: "GET",
    headers: getApiHeaders(),
    success: (response) => {
      const brands = Array.isArray(response) ? response : response.data || [];
      const $brandCarousel = $("#brand-carousel").empty();

      brands.forEach((b) => {
        $brandCarousel.append(`
          <div class="product-card">
            <div class="product-img">
              <img src="${ip}/FrontEnd/assets/img/brand/${b.image}" 
                   alt="${b.brand_name || "Brand"}" height="100px" />
            </div>
            
            <a href="products.html?brand=${b.brand_id}" 
               class="text-success mx-1 productDetails">
              <div class="card-contents">
              </div>
              <div class="product-details">
                <h5 class="product-name">${b.name || b.brand_name || "Brand Name"}</h5>
              </div>
            </a>
          </div>
        `);
      });

      const canLoopBrands = brands.length > 6;

      // Initialize Owl Carousel ONLY AFTER the items are appended to the DOM
      $brandCarousel.owlCarousel({
        loop: canLoopBrands,
        rewind: false,
        margin: 30,
        nav: brands.length > 1,
        dots: brands.length > 1,
        autoplay: canLoopBrands,
        autoplayHoverPause: true,
        smartSpeed: 500,
        responsive: {
          0: {
            items: 1,
          },
          480: {
            items: 2,
          },
          768: {
            items: 4,
          },
          1000: {
            items: 6,
          },
        },
      });
    },
    error: (xhr) => console.error("Error fetching brands:", xhr.responseText),
  });

  /* -----------------------------
     LOAD HOMEPAGE PRODUCTS + CART STATE
  ----------------------------- */
  loadHomepageProducts();

  $(".search-form").on("submit", function (event) {
    event.preventDefault();
    const q = ($("#searchInput").val() || "").trim();
    window.location.href = q
      ? `shop.html?q=${encodeURIComponent(q)}`
      : "shop.html";
  });

  /* -----------------------------
     ADD TO CART HANDLER
  ----------------------------- */
  $(document).on("click", ".add-to-cart", function (e) {
    e.preventDefault();
    e.stopPropagation(); // Prevents the <a> tag link from firing before AJAX

    const productId = $(this).data("product-id");

    if (!token) {
      Swal.fire("Warning", "Please login to add items to the cart.", "warning");
      return;
    }

    if (isOwnSellerProductButton($(this))) {
      Swal.fire(
        "Not Allowed",
        "You cannot add your own product to the cart.",
        "warning",
      );
      return;
    }

    $.ajax({
      url: `${ip}/api/cart`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: JSON.stringify({ product_id: productId, quantity: 1 }),
      success: function (response) {
        updateCartCount(response.count);
        Swal.fire("Added", "Product added to your cart.", "success");
      },
      error: function (xhr) {
        console.error("Error adding to cart:", xhr.responseText);
        const msg = xhr.responseJSON?.msg || "Failed to add product to cart.";
        Swal.fire("Error", msg, "error");
      },
    });
  });

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
