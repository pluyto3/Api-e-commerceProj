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
  $cartCount.show();

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
    url: `${ip}/api/products/${productId}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (response) {
      console.log(" Product Response:", response);

      const product = response.data || response;

      $("#main-img").attr(
        "src",
        `${ip}/FrontEnd/assets/img/product/${product.image}`
      );
      $("#category-name").text(product.category ?? "Category Name");
      $("#product-name").text(product.product_name);
      $("#product-price").text(`Price: $${product.product_price ?? ""}`);
      $("#product-details-text").html(
        product.product_description ?? "No details available"
      );
      $("input[type=number]").val(1);
    },
    error: function (xhr) {
      console.error("❌ Error fetching product:", xhr.responseText);
    },
  });

  /* ============================================================
     CART FUNCTIONS
  ============================================================ */
  function updateCartCount(count) {
    $("#cart-count").text(count);
  }

  // --- Add to Cart ---
  $(".product-add-to-cart-btn").on("click", function () {
    const quantity = $("input[type=number]").val();

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
          updateCartCount(response.count);
          window.location.href = "index.html";
        });
      },
      error: function (xhr) {
        console.error("❌ Error adding to cart:", xhr.responseText);
      },
    });
  });

  // --- Fetch Cart Count on Page Load ---
  $.ajax({
    url: `${ip}/api/cart`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (response) {
      console.log(" Cart Count:", response);
      updateCartCount(response.count);
    },
  });
});
