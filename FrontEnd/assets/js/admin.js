// =======================================
// GLOBAL VARIABLES
// =======================================
const ip = "http://localhost:8000";
let token = $.cookie("token");
let usr = $.cookie("username");
let role = $.cookie("role");
let profileImage = $.cookie("profileImage");
let orderChart = null;
let statusChart = null;
let ordersTable = null;

// =======================================
// LOAD USER SESSION & NAVBAR
// =======================================
function load_user() {
  const $displayUsername = $("#displayUsername");
  const $login = $("#login");
  const $register = $("#register");
  const $logout = $("#logout");
  const $cartCount = $("#cart-count");
  const $adminDashboard = $("#adminDashboard");
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");

  if (!usr || !token) {
    // No session
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

  // Session exists
  $displayUsername.html(`<b>${usr}</b>`);
  $login.hide();
  $register.hide();
  $logout.show();
  $cartCount.show();

  // Role-based dashboard visibility
  if (["admin", "seller"].includes(role)) {
    $adminDashboard.show();
  } else {
    $adminDashboard.hide();
  }
}

// =======================================
// SIDEBAR TOGGLE
// =======================================
function setupSidebarToggle() {
  $(".menu-btn").on("click", () => {
    $(".sidebar").addClass("collapsed");
    $(".wrapper").addClass("sidebar-collapsed");
    $(".text-link").hide();
    $(".close-btn").show();
    $(".menu-btn").hide();
  });

  $(".close-btn").on("click", () => {
    $(".sidebar").removeClass("collapsed");
    $(".wrapper").removeClass("sidebar-collapsed");
    $(".text-link").show();
    $(".close-btn").hide();
    $(".menu-btn").show();
  });
}

// =======================================
// COUNT DASHBOARD STATS (ROLE BASED)
// =======================================
function loadCounts() {
  $.ajax({
    url: `${ip}/api/counts`,
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    success: function (res) {
      // Admin
      $("#countedCategory").text(res.categories || 0);
      $("#countedBrand").text(res.brands || 0);
      $("#countedUsers").text(res.users || 0);

      // Seller/Admin orders (Checkout-based)
      $("#countedCheckout").text(res.total_orders || 0);
      $("#pendingOrders").text(res.pending_orders || 0);
      $("#completedOrders").text(res.completed_orders || 0);

      console.log("Dashboard counts loaded successfully:", res);
    },
    error: (xhr) => {
      console.error("Error fetching dashboard counts:", xhr.responseText);
    },
  });
}

// =======================================
// Orders by Month Chart Function
// =======================================
function loadMonthlyOrders() {
  fetch(`${ip}/api/checkout/dashboard/orders/monthly`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data || !data.labels || !data.data) return;

      orderChart.data.labels = data.labels;
      orderChart.data.datasets[0].data = data.data;
      orderChart.update();
    })
    .catch((err) => console.error("Monthly Orders Error:", err));
}

// =======================================
// Orders by Status Chart Function
// =======================================
function loadOrderStatus() {
  fetch(`${ip}/api/checkout/dashboard/orders/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data || !data.labels || !data.data) return;

      statusChart.data.labels = data.labels;
      statusChart.data.datasets[0].data = data.data;
      statusChart.update();
    })
    .catch((err) => console.error("Order Status Error:", err));
}

// =======================================
// Iinitial function call
// =======================================
function initCharts() {
  const orderCanvas = document.getElementById("orderChart");
  const statusCanvas = document.getElementById("orderStatusChart");

  // Destroy charts if they exist
  if (orderChart) {
    orderChart.destroy();
    orderChart = null;
  }
  if (statusChart) {
    statusChart.destroy();
    statusChart = null;
  }

  orderChart = new Chart(orderCanvas.getContext("2d"), {
    type: "pie",
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: [
            "#4f46e5",
            "#06b6d4",
            "#22c55e",
            "#f59e0b",
            "#ef4444",
            "#8b5cf6",
          ],
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } },
  });

  statusChart = new Chart(statusCanvas.getContext("2d"), {
    type: "pie",
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: [
            "#f97316",
            "#84cc16",
            "#3b82f6",
            "#ec4899",
            "#6366f1",
          ],
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } },
  });
}

// =======================================
// Load Recent Orders from API
// =======================================
function loadRecentOrders() {
  $.ajax({
    url: `${ip}/api/checkout/all`,
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    dataType: "json",
    success: function (res) {
      const tbody = $("#ordersTable tbody");
      res.forEach((order, index) => {
        const row = `
        <tr>
          <td>${index + 1}</td>
            <td>${order.user_name || "N/A"}</td>
            <td>${order.seller_name || "N/A"}</td>
            <td>$${parseFloat(order.amount).toFixed(2)}</td>
            <td>${order.status}</td>
            <td>${order.payment_method || "N/A"}</td>
            <td>
              <button class="btn btn-sm btn-primary view-order" data-id="${order.id}">View</button>
            </td>
        </tr>
        `;
        tbody.append(row);
      });

      // Initialize DataTable
      ordersTable = $("#ordersTable").DataTable({
        pageLength: 10,
        lengthChange: false,
        responsive: true,
        columnDefs: [
          { orderable: false, targets: -1 }, // Disable ordering on the last column (Actions),
        ],
      });
    },
    error: function (xhr) {
      console.error("Error loading recent orders:", xhr.responseText);
    },
  });
}

// =======================================
// Loads the Charts
// =======================================
document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  loadMonthlyOrders();
  loadOrderStatus();
});

// =======================================
// View Orders Button Click Handler
// =======================================
$(document).on("click", ".view-order", function () {
  const orderId = $(this).data("id");
  // You can open a modal or redirect to the order details page
  console.log("View order ID:", orderId);
});

// =======================================
// UTILITIES
// =======================================
$(document).ajaxStart(() => $("#wait").show());
$(document).ajaxComplete(() => $("#wait").hide());

$(document).ready(function () {
  load_user();
  loadCounts();
  setupSidebarToggle();
  loadRecentOrders();

  // --- Load Navbar Profile Image ---
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
        // console.log("User data:", response);
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

  // --- Logout Functionality ---
  $("#logout").click(function () {
    $.ajax({
      beforeSend: function (xhr) {
        xhr.setRequestHeader("Authorization", "Bearer " + token);
      },
      type: "POST",
      url: ip + "/api/logout",
      data: { token: token },
      success: function (res) {
        Swal.fire({
          icon: "success",
          title: "Logout Successful",
        }).then((result) => {
          var cookies = $.cookie();
          for (var cookie in cookies) {
            $.removeCookie(cookie);
          }
          window.location.replace("login.html");
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
});
