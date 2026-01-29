/* ================================
   GLOBAL VARIABLES
================================ */
const ip = "http://localhost:8000";
let token = null;
let usr = null;
let role = null;
let profileImage = null;

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
    $navbarProfileImage.hide();
    $defaultProfileIcon.show();
    return;
  }

  // Session exists → show username & logout
  $displayUsername.html(`<b>${usr}</b>`);
  $login.hide();
  $register.hide();
  $logout.show();
  $cartCount.show();

  // Show admin dashboard for admin/seller only
  role === "admin" || role === "seller"
    ? $adminDashboard.show()
    : $adminDashboard.hide();
}

/* ==========================================
   DOCUMENT READY
========================================== */
$(document).ready(() => {
  load_user();

  /* -----------------------------
     LOAD NAVBAR PROFILE IMAGE
  ----------------------------- */
  if (usr) {
    $.ajax({
      url: `${ip}/api/getAccount_username/${usr}`,
      type: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
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
     LOAD PRODUCTS (for Carousel)
  ----------------------------- */
  $.ajax({
    url: `${ip}/api/products`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
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
                <button type="button" class="btn btn-warning cart-btn">
                  <i class="fas fa-cart-plus"></i>
                </button>
              </div>
              <div class="product-details">
                <h5 class="product-name">${p.product_name}</h5>
                <p class="product-price">
                  <span class="text-success">Price: $${
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
     CART COUNT FETCHER
  ----------------------------- */
  const updateCartCount = (count) => $("#cart-count").text(count);

  $.ajax({
    url: `${ip}/api/cart`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: (res) => updateCartCount(res.count || 0),
    error: (xhr) => console.error("Error fetching cart:", xhr.responseText),
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
