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
// DASHBOARD ROOT (ADMIN/SELLER)
// =======================================
function getDashboardRoot() {
  if (role === "seller") {
    return $("#sellerDashboardContent");
  }
  return $("#adminDashboardContent");
}

// =======================================
// LOAD USER SESSION & NAVBAR
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
  const $adminDashboardContent = $("#adminDashboardContent");
  const $sellerDashboardContent = $("#sellerDashboardContent");
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");
  const $cartNav = $("#cartNav");

  if (!usr || !token) {
    // No session
    $displayUsername.html("My Account");
    $login.show();
    $register.show();
    $logout.hide();
    $cartCount.hide();
    $cartNav.hide();
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

  // Show cart ONLY for user and seller
  if (role === "user" || role === "seller") {
    $cartNav.show();
  } else {
    $cartNav.hide(); // admin or no role
  }

  // Role-based dashboard visibility
  if (role === "admin") {
    $adminDashboardContent.removeClass("d-none");
    $sellerDashboardContent.addClass("d-none");
  } else if (role === "seller") {
    $sellerDashboardContent.removeClass("d-none");
    $adminDashboardContent.addClass("d-none");
  } else {
    $adminDashboardContent.addClass("d-none");
    $sellerDashboardContent.addClass("d-none");
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
  if (role !== "admin" && role !== "seller") {
    return;
  }

  const $dashboard = getDashboardRoot();

  $.ajax({
    url: `${ip}/api/counts`,
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    success: function (res) {
      if (role === "seller") {
        $dashboard.find("#countedMyProducts").text(res.my_products || 0);
        $dashboard
          .find("#countedPendingApproval")
          .text(res.pending_approval || 0);
        $dashboard
          .find("#countedApprovedProducts")
          .text(res.approved_products || 0);
        $dashboard
          .find("#countedMyOrders")
          .text(res.total_orders || res.totalOrders || 0);
        return;
      }

      // Admin values available in /api/counts
      $dashboard.find("#countedUsers").text(res.users || 0);
      $dashboard
        .find("#countedOrders")
        .text(res.total_orders || res.totalOrders || 0);
      $dashboard
        .find("#countedPendingOrders")
        .text(res.pending_orders || res.pendingOrders || 0);
      $dashboard
        .find("#countedCompletedOrders")
        .text(res.completed_orders || res.completedOrders || 0);

      // keep older IDs for backward-compatibility if they exist
      $dashboard.find("#countedCategory").text(res.categories || 0);
      $dashboard.find("#countedBrand").text(res.brands || 0);

      // If API didn't return sellers/products/pendingApproval/cancelled, fetch them separately
      // 1) Sellers count
      $.ajax({
        url: `${ip}/api/countedSellers`,
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        success: function (sres) {
          $dashboard
            .find("#countedSellers")
            .text(sres.totalSellers || sres.total_sellers || 0);
        },
        error: function (xhr) {
          console.warn("Could not load countedSellers:", xhr.responseText);
          $dashboard.find("#countedSellers").text(0);
        },
      });

      // 2) Products list — use to compute total products and pending approvals
      $.ajax({
        url: `${ip}/api/products`,
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        success: function (pres) {
          const products = pres.data || [];
          $dashboard.find("#countedProducts").text(products.length || 0);
          const pendingCount = products.filter(
            (p) => (p.approval_status || "pending") === "pending",
          ).length;
          $dashboard.find("#countedPendingApproval").text(pendingCount || 0);
        },
        error: function (xhr) {
          console.warn("Could not load products for counts:", xhr.responseText);
          $dashboard.find("#countedProducts").text(0);
          $dashboard.find("#countedPendingApproval").text(0);
        },
      });

      // 3) Compute cancelled orders from all orders
      $.ajax({
        url: `${ip}/api/checkout/all`,
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        success: function (orders) {
          const cancelled = (orders || []).filter(
            (o) => o.status === "cancelled",
          ).length;
          $dashboard.find("#countedCancelled").text(cancelled || 0);
        },
        error: function (xhr) {
          console.warn(
            "Could not load orders for cancelled count:",
            xhr.responseText,
          );
          $dashboard.find("#countedCancelled").text(0);
        },
      });

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
  if (!orderChart) return;

  fetch(`${ip}/api/checkout/dashboard/orders/monthly`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      orderChart.data.labels = data?.labels || [];
      orderChart.data.datasets[0].data = data?.data || [];
      orderChart.update();
    })
    .catch((err) => console.error("Monthly Orders Error:", err));
}

// =======================================
// Orders by Status Chart Function
// =======================================
function loadOrderStatus() {
  if (!statusChart) return;

  fetch(`${ip}/api/checkout/dashboard/orders/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      statusChart.data.labels = data?.labels || [];
      statusChart.data.datasets[0].data = data?.data || [];
      statusChart.update();
    })
    .catch((err) => console.error("Order Status Error:", err));
}

// =======================================
// Iinitial function call
// =======================================
function initCharts() {
  if (role !== "admin" && role !== "seller") {
    return;
  }

  const $dashboard = getDashboardRoot();
  const orderCanvasSelector =
    role === "seller" ? "#sellerOrderChart" : "#orderChart";
  const statusCanvasSelector =
    role === "seller" ? "#sellerStatusChart" : "#orderStatusChart";
  const orderCanvas = $dashboard.find(orderCanvasSelector)[0];
  const statusCanvas = $dashboard.find(statusCanvasSelector)[0];

  if (!orderCanvas || !statusCanvas) return;

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
  if (role !== "admin" && role !== "seller") {
    return;
  }

  const $dashboard = getDashboardRoot();
  const tableSelector =
    role === "seller" ? "#sellerOrdersTable" : "#ordersTable";
  const $ordersTable = $dashboard.find(tableSelector);
  if (!$ordersTable.length) return;
  const tbody = $ordersTable.find("tbody");

  $.ajax({
    url: `${ip}/api/checkout/all`,
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    dataType: "json",
    success: function (res) {
      if ($.fn.DataTable.isDataTable($ordersTable)) {
        $ordersTable.DataTable().clear().destroy();
      }

      tbody.empty(); // important to avoid duplicates

      res.forEach((order, index) => {
        if (role === "seller") {
          const sellerItems = order.items || [];
          const firstItem = sellerItems[0];
          const productName = firstItem?.product?.product_name || "N/A";
          const description = firstItem?.product?.product_description || "N/A";
          const statusText = order.status || "N/A";
          const amount = sellerItems.reduce(
            (sum, item) => sum + Number(item.subtotal || 0),
            0,
          );

          const sellerRow = `
            <tr>
              <td>${order.checkout_id}</td>
              <td>${productName}</td>
              <td>${description}</td>
              <td>$${amount.toFixed(2)}</td>
              <td>${statusText}</td>
              <td>${order.payment_method || "N/A"}</td>
              <td>
                <button type="button" class="btn btn-sm btn-primary view-order" data-id="${order.checkout_id}"> 
                  View
                </button>
              </td>
            </tr>
          `;

          tbody.append(sellerRow);
          return;
        }

        // Collect seller names from order items
        let sellers = "N/A";

        if (order.items && order.items.length > 0) {
          const sellerSet = new Set(
            order.items
              .map((item) => item.product?.seller?.username)
              .filter(Boolean),
          );

          sellers = [...sellerSet].join(", ");
        }

        const row = `
      <tr>
        <td>${index + 1}</td>
        <td>${order.user?.username ?? "N/A"}</td>
        <td>${sellers}</td>
        <td>$${parseFloat(order.total_amount).toFixed(2)}</td>
        <td>${order.status}</td>
        <td>${order.payment_method}</td>
        <td>
          <button type="button" class="btn btn-sm btn-primary view-order" data-id="${order.checkout_id}">
            View
          </button>
        </td>
      </tr>
    `;

        tbody.append(row);
      });

      // Reinitialize DataTable
      $ordersTable.DataTable({
        pageLength: 10,
        lengthChange: false,
        responsive: true,
        columnDefs: [
          { orderable: false, targets: -1, className: "text-center" },
        ],
      });
    },
    error: function (xhr) {
      console.error("Error loading recent orders:", xhr.responseText);
    },
  });
}

// =======================================
// Function Load Order Details Modal
// =======================================
function loadOrderDetailsModal(orderId) {
  if (role !== "admin" && role !== "seller") {
    return;
  }

  const $dashboard = getDashboardRoot();
  const $modal = $dashboard.find("#orderDetailsModal");
  if (!$modal.length) {
    console.error("orderDetailsModal not found for current dashboard.");
    return;
  }

  // Open modal immediately on click.
  $modal.modal("show");
  $modal.find("#summaryStatus").text("Loading...");
  $modal.find("#summaryDate").text("Loading...");
  $modal.find("#summaryItems").text("0");
  $modal.find("#tracking").text("Loading...");
  $modal.find("#orderDetailsBody").html("");

  // First, fetch all orders to get the full order data with user info
  $.ajax({
    url: `${ip}/api/checkout/all`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (allOrders) {
      // Find the specific order in the list
      const fullOrder = allOrders.find((o) => o.checkout_id == orderId);

      if (!fullOrder) {
        console.error("Order not found in list");
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Order not found.",
        });
        return;
      }

      const order = fullOrder;
      const items = fullOrder.items || [];

      console.log("Full Order:", order);
      console.log("User info:", order.user);

      // Populate Summary Section
      $modal.find("#summaryStatus").text(order.status || "N/A");
      const date = new Date(order.created_at);
      const formattedDate = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      $modal.find("#summaryDate").text(formattedDate || "N/A");
      $modal.find("#summaryItems").text(items.length);

      // Populate Tracking Number
      if (order.tracking_number) {
        $modal.find("#tracking").text(order.tracking_number);
      } else {
        $modal.find("#tracking").text("Not yet assigned");
      }

      // Populate Items Table
      let rows = "";
      items.forEach((item) => {
        console.log("Item structure:", item); // Debug log

        const subtotal = (
          parseFloat(item.price) * parseInt(item.quantity)
        ).toFixed(2);

        // Get image from product or item
        const imagePath =
          item.product?.image || item.image || "FrontEnd/assets/img/back.jpg";

        // Get product name from product or item
        const productName =
          item.product?.product_name || item.product_name || "N/A";

        // Get seller from the product.seller or fallback to shop name
        const sellerName =
          item.product?.seller?.username || order.shop_name || "N/A";

        // Get username from the order.user
        const username = order.user?.username || "N/A";

        rows += `
          <tr>
            <td>
              <img src="${ip}/FrontEnd/assets/img/product/${imagePath}"
                   onerror="this.src='assets/img/back.jpg'"
                   style="width:70px; height:70px; object-fit:cover; border:1px solid #ddd;">
            </td>
            <td>${username}</td>
            <td>${productName}</td>
            <td>${sellerName}</td>
            <td>${item.quantity || 0}</td>
            <td>$${parseFloat(item.price).toFixed(2)}</td>
            <td>$${subtotal}</td>
          </tr>
        `;
      });

      $modal.find("#orderDetailsBody").html(rows);
    },
    error: function (xhr) {
      console.error("Error loading order details:", xhr.responseText);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Unable to load order details. Please try again.",
      });
    },
  });
}

// =======================================
// View Orders Button Click Handler
// =======================================
$(document).on("click", ".view-order", function () {
  const orderId = $(this).data("id");
  loadOrderDetailsModal(orderId);
});

// =======================================
// UTILITIES
// =======================================
$(document).ajaxStart(() => $("#wait").show());
$(document).ajaxComplete(() => $("#wait").hide());

$(document).ready(function () {
  load_user();
  initCharts();
  loadMonthlyOrders();
  loadOrderStatus();
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
  if (role === "user" || role === "seller") {
    $.ajax({
      url: `${ip}/api/cart`,
      method: "GET",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
      },
      success: function (response) {
        updateCartCount(response.count);
      },
    });
  }
});
