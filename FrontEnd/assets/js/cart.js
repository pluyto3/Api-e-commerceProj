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
      const $container = $("#cart-items-container");
      $container.empty();

      let totalAmount = 0;

      cartItems.forEach((item) => {
        const id = item.addTocart_id;
        const name = item.product?.product_name ?? "Unnamed Product";
        const price = item.product?.product_price ?? 0;
        const quantity = item.quantity ?? 1;
        const subtotal = item.subtotal ?? price * quantity;
        totalAmount += subtotal;

        // Note: Included the checkbox to maintain your "selected checkout" logic
        const cardHtml = `
          <div class="cart-item-card">
            <div class="checkbox me-3 d-flex align-items-center justify-content-center">
               <input type="checkbox" class="select-item form-check-input m-0" style="transform: scale(1.2);" data-id="${id}" data-price="${subtotal}">
            </div>

            <div class="me-4">
               <img src="${ip}/FrontEnd/assets/img/product/${item.product.image}" alt="${name}" class="cart-item-img">
            </div>

            <div class="flex-grow-1">
               <h5 class="fw-bold mb-1" style="color: #2c3e50;">${name}</h5>
               <p class="mb-0 text-dark">Price: <span class="fw-bold">₱${price.toLocaleString()}</span></p>
            </div>

            <div class="mx-4">
                <div class="quantity-pill-container">
                    <button class="changeQuantity" data-id="${id}" data-action="minus">-</button>
                    <span class="quantity">${quantity}</span>
                    <button class="changeQuantity" data-id="${id}" data-action="plus">+</button>
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

      // Update the Order Summary texts
      $("#subtotal-display").text(`₱${totalAmount.toLocaleString()}`);
      $("#total-amount").text(`₱${totalAmount.toLocaleString()}`);
      $("#item-count-footer").text(
        `You have ${cartItems.length} items in your cart.`,
      );

      // Checkboxes unchecked by default
      $(".select-item").prop("checked", false);
    },
    error: function (xhr) {
      console.error("Error fetching cart items:", xhr.responseText);
    },
  });
}

// Update the event listener for quantity buttons
$(document).on("click", ".changeQty", function () {
  const id = $(this).data("id");
  const action = $(this).data("action");
});

/* ============================================================
   MAIN SCRIPT (Document Ready)
============================================================ */
$(document).ready(function () {
  let cartDataTable = null;

  /* ------------------------------
     Load User Session
  ------------------------------ */
  load_user();
  loadCartItems();

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
        .find('input.select-item[type="checkbox"]:checked')
        .each(function () {
          selectedIds.push($(this).data("id")); // Get the 'data-id'
        });
    } else {
      // Fallback if DataTables hasn't initialized (shouldn't happen)
      $('input.select-item[type="checkbox"]:checked').each(function () {
        selectedIds.push($(this).data("id"));
      });
    }

    if (selectedIds.length === 0) {
      Swal.fire(
        "No Items Selected",
        "Please select at least one item to check out.",
        "warning",
      );
      return; // Stop if nothing is selected
    } // Store the selected IDs in sessionStorage

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
    const $row = $btn.closest("tr");
    const $quantity = $row.find(".quantity");
    const $price = $row.find(".selling-price");
    const $subtotal = $row.find(".total_price");

    const cartId = $btn.data("id");
    let quantity = parseInt($quantity.text());
    const price = parseFloat($price.text().replace(/[^0-9.]/g, ""));

    if ($btn.text() === "+") quantity++;
    else if ($btn.text() === "-" && quantity > 1) quantity--;
    else return;

    // Update UI immediately
    $quantity.text(quantity);

    const newTotal = price * quantity;
    const formattedTotal = `₱${newTotal.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    $subtotal.text(formattedTotal);

    // Send update to backend
    $.ajax({
      url: `${ip}/api/cart/${cartId}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: JSON.stringify({ cart_id: cartId, quantity }),
      success: function (response) {
        console.log("🧮 Cart Updated:", response);
        if (response.status === 200) updateTotalAmount();
      },
      error: function (xhr) {
        console.error("❌ Error updating cart item:", xhr.responseText);
      },
    });
  });

  /* ------------------------------
     Update Total Amount
  ------------------------------ */
  function updateTotalAmount() {
    let total = 0;
    $("#cart-table tbody tr").each(function () {
      const subtotalText = $(this).find(".total_price").text().trim();
      const subtotal = parseFloat(subtotalText.replace(/[^0-9.]/g, ""));
      total += subtotal;
    });
    $("#total-amount").text(`Total: ₱${total.toLocaleString()}`);
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
  $("#logout").click(function () {
    $.ajax({
      beforeSend: function (xhr) {
        xhr.setRequestHeader("Authorization", "Bearer " + token);
      },
      type: "POST",
      url: ip + "/api/logout",
      data: { token: token },
      success: function () {
        Swal.fire({
          icon: "success",
          title: "Logout Successful",
        }).then(() => {
          var cookies = $.cookie();
          for (var cookie in cookies) {
            $.removeCookie(cookie);
          }
          window.location.replace("index.html");
        });
      },
      error: function (res) {
        let msg =
          res.responseJSON && res.responseJSON.msg
            ? res.responseJSON.msg
            : "Logout failed. Please try again.";
        alert(msg);
      },
    });
  });
});
