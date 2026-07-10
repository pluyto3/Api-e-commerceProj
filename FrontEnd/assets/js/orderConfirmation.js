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

// =======================================
// User Session Handling (Copied from checkout.js for consistency)
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
  const $defaultProfileIcon = $("#defaultProfileIcon"); // Assuming this exists in your navbar

  // No session → show login/register
  if (!usr || !token) {
    $displayUsername.html("My Account");
    $login.show();
    $register.show();
    $logout.hide();
    $cartCount.hide();
    $adminDashboard.hide();
    $navbarProfileImage.hide();
    // $defaultProfileIcon.show(); // Uncomment if you have a default icon
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

  // Load Navbar Profile Image
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
        if (response?.image) {
          $navbarProfileImage
            .attr("src", `${ip}/FrontEnd/assets/img/user/${response.image}`)
            .show();
          // $defaultProfileIcon.hide(); // Uncomment if you have a default icon
        } else {
          $navbarProfileImage.hide();
          // $defaultProfileIcon.show(); // Uncomment if you have a default icon
        }
      },
      error: function (xhr) {
        console.error("Error loading profile:", xhr.responseText);
        $navbarProfileImage.hide();
        // $defaultProfileIcon.show(); // Uncomment if you have a default icon
      },
    });
  }
}

$(document).ready(function () {
  load_user(); // Load user info for the navbar

  const confirmedOrderJSON = sessionStorage.getItem("lastConfirmedOrder");

  if (!confirmedOrderJSON) {
    // If no order found, redirect to cart or a generic error page
    Swal.fire({
      icon: "error",
      title: "Order Not Found",
      text: "No recent order details found. Please check your orders page.",
      showConfirmButton: true,
    }).then(() => {
      window.location.href = "cart.html"; // Or "index.html" or "account.html" (for orders list)
    });
    return;
  }

  const order = JSON.parse(confirmedOrderJSON);

  // Populate the HTML elements
  $("#confirmationCustomerName").text(order.customerName);
  $("#confirmationOrderId").text(`#${order.orderId}`);
  $("#confirmationOrderTotal").text(`₱${order.totalAmount.toLocaleString()}`);
  // $("#confirmationShippingFee").text(`₱${order.shippingFee.toLocaleString()}`);
  $("#confirmationPaymentMethod").html(
    `${order.paymentMethod} <i class="fas fa-money-bill-wave ml-1"></i>`,
  ); // Assuming COD is the only one with icon
  $("#confirmationPaymentStatus").text(order.paymentStatus || "pending");
  $("#confirmationShippingStatus").text(order.shippingStatus || "pending");

  $("#confirmationRecipientName").text(order.shipping.name);
  $("#confirmationRecipientPhone").text(order.shipping.phone);
  $("#confirmationRecipientAddress").text(
    `${order.shipping.purok}, ${order.shipping.barangay}, ${order.shipping.city}, ${order.shipping.province}, ${order.shipping.zipcode}`,
  );

  // Populate ordered items
  const $orderItemsContainer = $("#confirmationOrderItems");
  $orderItemsContainer.empty(); // Clear existing placeholders

  order.orderedItems.forEach((item) => {
    const itemHtml = `
      <div class="d-flex justify-content-between">
        <span class="text-muted">Item:</span>
        <span>${item.name} x ${item.quantity}</span>
      </div>
      <div class="d-flex justify-content-between">
        <span class="text-muted">Item Price:</span>
        <span>₱${item.price.toLocaleString()} each</span>
      </div>
    `;
    $orderItemsContainer.append(itemHtml);
  });

  // Estimated delivery (can be dynamic or a fixed placeholder)
  const today = new Date();
  const deliveryDate = new Date(today);
  deliveryDate.setDate(today.getDate() + 3); // Example: 3 days from now
  const options = { month: "short", day: "numeric", year: "numeric" };
  $("#confirmationEstimatedDelivery").text(
    deliveryDate.toLocaleDateString("en-US", options),
  );

  // Clear the order from sessionStorage after displaying
  sessionStorage.removeItem("lastConfirmedOrder");

  // Fetch cart count on page load
  $.ajax({
    url: `${ip}/api/cart`,
    method: "GET",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
    },
    success: function (response) {
      console.log("Cart items fetched successfully:", response);
      updateCartCount(response.count);
    },
    error: function (xhr) {
      console.error("Error fetching cart items:", xhr.responseText);
      updateCartCount(0); // Set to 0 on error
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

// Fetch cart count (Copied from checkout.js for consistency)
function updateCartCount(count) {
  $("#cart-count").text(count);
}
