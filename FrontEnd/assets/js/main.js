/* ================================
   GLOBAL VARIABLES
================================ */
const ip = "http://localhost:8000";
let token = null;
let usr = null;
let role = null;
let profileImage = null;

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

  // Show cart only for regular users (not sellers/admins)
  if (!role || (role !== "admin" && role !== "seller")) {
    $cartCount.show();
  } else {
    $cartCount.hide();
  }

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
    url: `${ip}/api/brands`,
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

      // Initialize Owl Carousel ONLY AFTER the items are appended to the DOM
      $brandCarousel.owlCarousel({
        loop: true,
        margin: 30,
        nav: false,
        autoplay: true,
        responsive: {
          0: { items: 2 },
          600: { items: 4 },
          1000: { items: 6 },
        },
      });
    },
    error: (xhr) => console.error("Error fetching brands:", xhr.responseText),
  });

  /* -----------------------------
     LOAD PRODUCTS (for Carousel)
  ----------------------------- */
  $("#product-carousel").html("<p>Loading products...</p>");
  $.ajax({
    url: `${ip}/api/products`,
    method: "GET",
    headers: getApiHeaders(),
    success: (response) => {
      const products = Array.isArray(response) ? response : response.data;
      const $carousel = $("#product-carousel").empty();

      products.forEach((p) => {
        $carousel.append(`
          <div class="product-card">
            <div class="product-img">
              <img src="${ip}/FrontEnd/assets/img/product/${p.image}" 
                   alt="${p.product_name}" height="100px" />
            </div>

            <a href="single-product.html?id=${p.product_id}" 
               class="text-success mx-1 productDetails">
              <div class="card-contents">
                <button type="button" class="btn btn-warning cart-btn add-to-cart" data-product-id="${p.product_id}">
                  <i class="fas fa-cart-plus"></i>
                </button>
              </div>
              <div class="product-details">
                <h5 class="product-name">${p.product_name}</h5>
                <p class="product-price">
                  <span class="text-success">Price: ₱${
                    p.product_price ?? ""
                  }</span>
                </p>
              </div>
            </a>
          </div>
        `);
      });

      // Reinitialize Owl Carousel
      if ($carousel.hasClass("owl-loaded")) {
        $carousel.trigger("destroy.owl.carousel").removeClass("owl-loaded");
        $carousel.find(".owl-stage-outer").children().unwrap();
      }

      $carousel.owlCarousel({
        loop: true,
        margin: 10,
        nav: true,
        autoplay: true,
        responsive: {
          0: { items: 1 },
          480: { items: 2 },
          768: { items: 3 },
          1024: { items: 5 },
        },
      });
    },
    error: (xhr) => {
      console.error("Error fetching products:", xhr.responseText);
    },
  });

  /* -----------------------------
     LOAD FEATURED PRODUCTS
  ----------------------------- */
  $.ajax({
    url: `${ip}/api/products`, // Change this if you have a specific /api/featured-products endpoint
    method: "GET",
    headers: getApiHeaders(),
    success: (response) => {
      const products = Array.isArray(response) ? response : response.data;
      const $featuredContainer = $("#featured-container").empty();

      // Slice the array to only show the first 4 products as "Featured"
      const featuredProducts = products.slice(0, 4);

      featuredProducts.forEach((p) => {
        $featuredContainer.append(`
          <div class="product text-center col-lg-3 col-md-4 col-sm-12 mb-4">
            <div class="position-relative">
              <div class="badge badge-danger position-absolute" style="top: 10px; left: 10px; z-index: 10;">
                Featured
              </div>
              <img src="${ip}/FrontEnd/assets/img/product/${p.image}" class="img-fluid mb-3" alt="${p.product_name}" style="height: 400px; object-fit: cover; width: 100%;">
            </div>

            <h5 class="p-name">${p.product_name}</h5>
            <h4 class="p-price">₱${p.product_price ?? ""}</h4>

            <a href="single-product.html?id=${p.product_id}">
              <button class="buy-btn">Buy Now</button>
            </a>
          </div>
        `);
      });
    },
    error: (xhr) =>
      console.error("Error fetching featured products:", xhr.responseText),
  });

  /* -----------------------------
     LOAD DAILY PRODUCTS
  ----------------------------- */
  $.ajax({
    url: `${ip}/api/products`,
    method: "GET",
    headers: getApiHeaders(),
    success: (response) => {
      const products = Array.isArray(response) ? response : response.data;
      const $dailyProductsContainer = $("#dailyProducts-container").empty();

      // Display all products without slicing to mimic a full marketplace feed
      products.forEach((p) => {
        $dailyProductsContainer.append(`
          <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-3">
            <div class="card dailyProductCard">
              <div class="card-body p-2 d-flex flex-column">
                <a href="single-product.html?id=${p.product_id}" class="text-decoration-none text-dark">
                  <img src="${ip}/FrontEnd/assets/img/product/${p.image}" class="card-img-top rounded-0" style="aspect-ratio: 1; object-fit: cover;" alt="${p.product_name}">
                </a>
                <p class="card-title mb-1" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 0.85rem; line-height: 1.2;">${p.product_name}</p>
                <div class="mt-auto d-flex justify-content-between align-items-center pt-2">
                    <span style="color: #ee4d2d; font-size: 1.1rem; font-weight: 500;">₱${p.product_price ?? ""}</span>
                    <small class="text-muted" style="font-size: 0.7rem;">Sold ${p.sold}</small>
                </div>
              </div>
            </div>
          </div>
        `);
      });
    },
    error: (xhr) =>
      console.error("Error fetching daily products:", xhr.responseText),
  });

  /* -----------------------------
     CART COUNT FETCHER
  ----------------------------- */
  const updateCartCount = (count) => $("#cart-count").text(count);

  if (token) {
    $.ajax({
      url: `${ip}/api/cart`,
      method: "GET",
      headers: getApiHeaders(),
      success: (res) => updateCartCount(res.count || 0),
      error: (xhr) => console.error("Error fetching cart:", xhr.responseText),
    });
  } else {
    updateCartCount(0);
  }

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

        // Redirect seamlessly to the single product page
        window.location.href = `single-product.html?id=${productId}`;
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
