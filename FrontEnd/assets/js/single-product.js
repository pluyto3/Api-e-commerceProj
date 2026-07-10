/* ================================
   GLOBAL VARIABLES
================================ */
// const ip = "https://api.hanzgo.me"; // For local testing
if (!window.APP_CONFIG?.API_BASE_URL) {
  throw new Error("APP_CONFIG is missing. Load config.js before cart.js.");
}

const ip = window.APP_CONFIG.API_BASE_URL;
// const ip = "https://api.hanzgo.me"; // For production server
let token = null;
let usr = null;
let role = null;
let profileImage = null;
let currentProductStock = 0;
let currentProductAvailable = false;
let currentUserId = null;
let currentProductSellerId = null;
let currentProductSellerUsername = "";

function getApiHeaders(extraHeaders = {}) {
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
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

      // Format category properly if it's a nested object
      let category = "Category Name";
      if (product.category) {
        category =
          typeof product.category === "object"
            ? product.category.name ||
              product.category.category_name ||
              "Category"
            : product.category;
      } else if (product.category_name) {
        category = product.category_name;
      }

      const imgUrl = product.image
        ? `${ip}/FrontEnd/assets/img/product/${product.image}`
        : "assets/img/back.jpg";
      const price = parseFloat(product.product_price || product.price || 0);
      currentProductSellerId =
        product.seller?.user_id ||
        product.seller?.id ||
        product.seller_id ||
        "";
      currentProductSellerUsername =
        product.seller?.username || product.seller_username || "";

      $("#main-img").attr("src", imgUrl);
      $("#category-name").text(category);
      $("#product-name").text(
        product.product_name || product.name || "Unknown Product",
      );
      $("#product-price").text(
        `Price: ₱${price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      );
      $("#product-details-text").html(
        product.product_description ||
          product.description ||
          "No details available.",
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

      $("#product-stock").text(`${stock} pieces available`);
      $("#product-quantity-input")
        .val(currentProductAvailable ? 1 : 0)
        .attr("max", currentProductStock)
        .prop("disabled", !currentProductAvailable);

      $(".product-add-to-cart-btn, .product-buy-now-btn").prop(
        "disabled",
        !currentProductAvailable,
      );

      if (!currentProductAvailable) {
        $("#product-stock")
          .removeClass("text-muted")
          .addClass("text-danger font-weight-bold")
          .text("Out of stock");
      }

      // Load products from the same shop
      loadSameShopProducts(product);
    },
    error: function (xhr) {
      console.error(" Error fetching product:", xhr.responseText);
    },
  });

  // --- Load Same Shop Products ---
  function loadSameShopProducts(currentProduct) {
    const currentSellerUser =
      currentProduct.seller?.username || currentProduct.seller_username;
    const currentSellerId =
      currentProduct.seller?.user_id || currentProduct.seller_id;

    if (!currentSellerUser && !currentSellerId) {
      $("#sameShop-products").html(
        "<p class='text-muted ml-3'>Seller information not available.</p>",
      );
      return;
    }

    $.ajax({
      url: `${ip}/api/products?scope=public`,
      method: "GET",
      headers: getApiHeaders(),
      success: function (response) {
        const allProducts = response.data || response || [];
        const $container = $("#sameShop-products").empty();

        const sameShopProducts = allProducts.filter((p) => {
          const pSellerUser = p.seller?.username || p.seller_username;
          const pSellerId = p.seller?.user_id || p.seller_id;
          const isSameSeller =
            (currentSellerUser && pSellerUser === currentSellerUser) ||
            (currentSellerId && pSellerId === currentSellerId);
          const isNotCurrentProduct =
            String(p.product_id || p.id) !==
            String(currentProduct.product_id || currentProduct.id);
          const isApproved =
            (p.approval_status || "approved").toLowerCase() === "approved";
          const isActive = (p.status || "active").toLowerCase() === "active";
          const hasStock = Number(p.stock_quantity || 0) > 0;

          return (
            isSameSeller &&
            isNotCurrentProduct &&
            isApproved &&
            isActive &&
            hasStock
          );
        });

        if (sameShopProducts.length === 0) {
          $container.html(
            "<p class='text-muted ml-3'>No other products from this shop.</p>",
          );
          return;
        }

        // Display up to 6 products
        sameShopProducts.slice(0, 6).forEach((p) => {
          const imgUrl = p.image
            ? `${ip}/FrontEnd/assets/img/product/${p.image}`
            : "assets/img/back.jpg";
          const price = parseFloat(p.product_price || p.price || 0).toFixed(2);
          const productName = p.product_name || p.name || "Unknown Product";

          $container.append(`
            <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-3">
              <div class="card dailyProductCard h-100">
                <div class="card-body p-2 d-flex flex-column">
                  <a href="single-product.html?id=${p.product_id || p.id}" class="text-decoration-none text-dark">
                    <img src="${imgUrl}" class="card-img-top rounded-0" style="aspect-ratio: 1; object-fit: cover;" alt="${productName}">
                  </a>
                  <p class="card-title mb-1 mt-2" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 0.85rem; line-height: 1.2;">${productName}</p>
                  <div class="mt-auto d-flex justify-content-between align-items-center pt-2">
                      <span style="color: #ee4d2d; font-size: 1.1rem; font-weight: 500;">₱${price}</span>
                  </div>
                </div>
              </div>
            </div>
          `);
        });
      },
      error: function (xhr) {
        console.error("Error fetching same shop products:", xhr.responseText);
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

    $.ajax({
      url: `${ip}/api/cart`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: JSON.stringify({ product_id: productId, quantity }),
      success: function (response) {
        console.log(" Added to cart:", response);

        Swal.fire({
          icon: "success",
          title: "Product Added",
          text: "Your product has been added to the cart.",
          showConfirmButton: false,
          timer: 1500,
        }).then(() => {
          const newCount = Number(response.count ?? 0);
          updateCartCount(newCount);
          window.location.href = "index.html";
        });
      },
      error: function (xhr) {
        console.error(" Error adding to cart:", xhr.responseText);
      },
    });
  });

  // --- Buy Now ---
  $(".product-buy-now-btn").on("click", function () {
    const quantity = $("#product-quantity-input").val() || 1;

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

    $.ajax({
      url: `${ip}/api/cart`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: JSON.stringify({ product_id: productId, quantity }),
      success: function (response) {
        window.location.href = `cart.html?select_product_id=${productId}`;
      },
      error: function (xhr) {
        console.error(" Error during Buy Now:", xhr.responseText);
        const msg = xhr.responseJSON?.msg || "Failed to add product to cart.";
        Swal.fire("Error", msg, "error");
      },
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
