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

// =======================================
// Order Management Logic
// =======================================
function fetchBuyerOrders() {
  console.log("Attempting to fetch orders...");

  $.ajax({
    url: `${ip}/api/checkout/orders`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (res) {
      console.log("Buyer Orders:", res);
      globalOrders = res.data || res;
      renderOrders("All");
    },
    error: function (err) {
      console.error("Error loading orders:", err);
      $("#buyerOrders").html(
        `<div class="alert alert-danger">Failed to load orders.</div>`
      );
    },
  });
}

// =======================================
// Render Orders Based on Status
// =======================================
function renderOrders(filter = "All") {
  const container = document.getElementById("buyerOrders");
  container.innerHTML = "";

  // Status Mapping
  const filteredOrders = globalOrders.filter((o) => {
    switch (filter) {
      case "Unpaid":
        return o.status === "pending" || o.status === "pending_payment";

      case "To Ship":
        return o.status === "processing";

      case "Shipped":
        return o.status === "shipped";

      case "To Review":
        return o.status === "completed" || o.status === "delivered";

      default:
        return true; // "All"
    }
  });

  // No orders
  if (filteredOrders.length === 0) {
    container.innerHTML = `
      <div class="p-5 text-center text-muted">No orders found.</div>
    `;
    return;
  }

  // Status colors
  const statusColors = {
    pending_payment: "#ff8800",
    pending: "#ff8800",
    processing: "#ff8800",
    shipped: "#0066ff",
    completed: "#28a745",
    delivered: "#28a745",
    cancelled: "#dc3545",
  };

  let htmlContent = filteredOrders
    .map((order) => {
      const color = statusColors[order.status] || "#6c757d";

      // Items HTML
      const itemsHtml = order.items
        .map(
          (item) => `
          <div class="d-flex mb-3">
            <img src="${ip}/${item.image}"
                 onerror="this.src='assets/img/back.jpg'"
                 style="width:70px;height:70px;object-fit:cover;border:1px solid #ddd;margin-right:15px;" />

            <div style="flex-grow:1">
              <div class="font-weight-bold">${item.product_name}</div>
              <div class="text-muted">Qty: ${item.quantity}</div>
            </div>

            <div class="font-weight-bold">₱${item.price}</div>
          </div>
        `
        )
        .join("");

      return `
        <div class="card mb-3 shadow-sm" style="border-radius:6px;">
          <div class="card-body">

            <!-- Shop Name + Status -->
            <div class="d-flex justify-content-between mb-2">
              <div class="font-weight-bold">
                <i class="fas fa-store"></i> ${order.shop_name}
              </div>
              <div class="font-weight-bold text-uppercase" style="color:${color}">
                ${order.status}
              </div>
            </div>

            <!-- Date -->
            <div class="text-muted mb-3" style="font-size:13px;">
              Order Date: <b>${order.created_at}</b>
            </div>

            <hr/>

            <!-- Items -->
            ${itemsHtml}

            <hr/>

            <!-- Total & Actions -->
            <div class="d-flex justify-content-between align-items-center">
              <div class="font-weight-bold" style="font-size:18px;">
                Total: ₱${order.total_amount}
              </div>

              <div>
                <!-- View Order -->
                <button class="btn btn-outline-dark btn-sm mr-2"
                  data-toggle="modal"
                  data-target="#orderDetailsModal"
                  data-id="${order.checkout_id}">
                    View Order
                </button>

                <!-- Update Status -->
                <button class="btn btn-outline-dark btn-sm mr-2"
                  data-toggle="modal"
                  data-target="#updateStatusModal"
                  onclick="openStatusModal(${order.checkout_id}, '${
        order.status
      }')">
                    Update Status
                </button>

                <!-- Cancel Button -->
                ${
                  order.status === "pending" ||
                  order.status === "pending_payment"
                    ? `
                    <button class="btn btn-outline-danger btn-sm btn-cancel"
                      data-id="${order.checkout_id}">
                      Cancel
                    </button>`
                    : `<button class="btn btn-secondary btn-sm" disabled>Cancel</button>`
                }
              </div>
            </div>

          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = htmlContent;
}

// =======================================
// Update Status Modal Logic
// =======================================
function openStatusModal(orderId, currentStatus) {
  $("#statusOrderId").val(orderId);
  $("#newOrderStatus").val(currentStatus);
}

// =======================================
// Submit Status Update Logic
// =======================================
function submitOrderStatusUpdate() {
  const orderId = $("#statusOrderId").val();
  const newStatus = $("#newOrderStatus").val();

  $.ajax({
    url: `${ip}/api/checkout/orders/${orderId}/status`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    contentType: "application/json",
    data: JSON.stringify({ status: newStatus }),

    success: function () {
      Swal.fire("Updated!", "Order status updated.", "success");

      $("#updateStatusModal").modal("hide");

      fetchBuyerOrders();
    },

    error: function (xhr) {
      console.error(xhr);
      Swal.fire("Error", "Failed to update status.", "error");
    },
  });
}

// =======================================
// Order Details Modal Logic
// =======================================
function loadOrderDetails(orderId) {
  $.ajax({
    url: `${ip}/api/checkout/orders/${orderId}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (res) {
      console.log("Order Details:", res);

      const order = res.order;
      const items = res.items;

      // Summary Section
      $("#summaryStatus").text(order.status);
      $("#summaryDate").text(order.created_at);
      $("#summaryItems").text(items.length);

      // Tracking Number
      if (order.tracking_number) {
        $("#tracking").text(order.tracking_number);
      } else {
        $("#tracking").text("Not yet assigned");
      }

      // Items Section
      let rows = "";

      items.forEach((item) => {
        let imageUrl = `${ip}/FrontEnd/assets/img/product/${item.image}`;

        rows += `
        <tr>
            <td>
              <img src="${ip}/${item.image}"
                   onerror="this.src='assets/img/back.jpg'"
                   style="width:70px; height:70px; object-fit:cover; border:1px solid #ddd;">
            </td>
            <td>${item.product_name}</td>
            <td>${item.quantity}</td>
            <td>₱${item.price}</td>
            <td>₱${item.subtotal}</td>
          </tr>
        `;
      });

      $("#orderDetailsBody").html(rows);
    },
    error: function (xhr) {
      console.error(xhr);
      Swal.fire("Error", "Unable to load order details.", "error");
    },
  });
}

// =======================================
// Cancel Order Function
// =======================================
function cancelOrder(orderId) {
  $.ajax({
    url: `${ip}/api/checkout/orders/${orderId}/cancel`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (res) {
      Swal.fire("Order Cancelled!", "", "success");
      fetchBuyerOrders();
    },
    error: function (xhr) {
      console.error(xhr);
      Swal.fire("Error", "Unable to cancel order.", "error");
    },
  });
}

// =======================================
// Main Execution
// =======================================
$(document).ready(function () {
  load_user();
  fetchBuyerOrders();

  // Global AJAX handlers for loading indicator
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

  // -------------------------------
  // Fetch Cart Count
  // -------------------------------
  function updateCartCount(count) {
    $("#cart-count").text(count);
  }

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
  });

  // -------------------------------
  // Tab Filtering Logic
  // -------------------------------
  document.querySelectorAll(".order-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelector(".order-tab-btn.active")
        .classList.remove("active");
      btn.classList.add("active");
      renderOrders(btn.dataset.status);
    });
  });

  // -------------------------------
  // Cancel Button Logic
  // -------------------------------
  $(document).on("click", ".btn-cancel", function () {
    const orderId = $(this).data("id");

    Swal.fire({
      title: "Cancel Order?",
      text: "Are you sure you want to cancel this order?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, cancel it!",
    }).then((result) => {
      if (result.isConfirmed) {
        // Call API to update status to 'cancelled'
        cancelOrder(orderId);
      }
    });
  });

  // -------------------------------
  // View Order Details Modal Logic
  // -------------------------------
  $(document).on("click", "[data-target='#orderDetailsModal']", function () {
    const orderId = $(this).data("id");
    loadOrderDetails(orderId);
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
