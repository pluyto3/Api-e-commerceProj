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
// Document Ready
// =======================================
$(document).ready(function () {
  // Initialize user session
  load_user();

  // -------------------------------
  // Sidebar Toggle
  // -------------------------------
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

  // =======================================
  // CRUD: BRAND MANAGEMENT
  // =======================================

  // -------------------------------
  // Create Brand
  // -------------------------------
  $("#brandForm").on("submit", function (e) {
    e.preventDefault();

    const fd = new FormData(this);
    $("#createBrand").text("Adding...");

    $.ajax({
      url: `${ip}/api/brands`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      data: fd,
      processData: false,
      contentType: false,
      success: function () {
        Swal.fire({
          icon: "success",
          title: "Brand Added Successfully",
          showConfirmButton: false,
        }).then(() => {
          $("#createBrand").text("Add");
          $("#brandForm")[0].reset();
          location.reload();
        });
      },
      error: function (xhr) {
        Swal.fire({
          icon: "error",
          title: "Error Adding Brand",
          text: xhr.responseText,
        });
      },
    });
  });

  // -------------------------------
  // Display Brands (Table)
  // -------------------------------
  $.ajax({
    url: `${ip}/api/brands`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    success: function (res) {
      const brands = res.data ?? res;

      brands.forEach((brand) => {
        $("#brand-table tbody").append(`
          <tr>
            <td>${brand.brand_id}</td>
            <td>${brand.name}</td>
            <td>
              <img src="http://localhost/e-commerce/BackEnd/public/FrontEnd/assets/img/brand/${brand.image}" 
                   width="50" height="50">
            </td>
            <td>
              <a href="#" 
                 data-id="${brand.brand_id}" 
                 class="text-success mx-1 editBtn" 
                 data-toggle="modal" 
                 data-target="#editBrandModal">
                 <i class="fas fa-edit fa-2x"></i>
              </a>
              <a href="#" 
                 data-id="${brand.brand_id}" 
                 class="text-danger mx-1 deleteBtn">
                 <i class="fas fa-trash fa-2x"></i>
              </a>
            </td>
          </tr>
        `);
      });

      // Initialize DataTable
      $("#brand-table").DataTable({
        responsive: {
          details: {
            type: "column",
            target: "tr",
          },
        },
        scrollX: true,
        autoWidth: false,
        columnDefs: [{ targets: "_all", className: "text-center" }],
      });
    },
    error: function (xhr) {
      console.error("Error fetching brands:", xhr);
      Swal.fire(
        "Error",
        xhr.responseJSON?.msg || "Failed to load brands",
        "error"
      );
    },
  });

  // -------------------------------
  // Edit Brand (Fetch Details)
  // -------------------------------
  $(document).on("click", ".editBtn", function (e) {
    e.preventDefault();
    const brand_id = $(this).data("id");
    $("#brand_id").val(brand_id);

    $.ajax({
      url: `${ip}/api/brands/${brand_id}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      success: function (res) {
        $("#editName").val(res.name);

        const imageUrl = res.image
          ? `http://localhost/e-commerce/BackEnd/public/FrontEnd/assets/img/brand/${res.image}`
          : null;

        if (imageUrl) {
          $("#currentImagePreview").attr("src", imageUrl).show();
        } else {
          $("#currentImagePreview").hide();
        }
      },
      error: function () {
        Swal.fire("Error", "Failed to fetch brand details", "error");
      },
    });
  });

  // -------------------------------
  // Update Brand
  // -------------------------------
  $("#editBrandForm").on("submit", function (e) {
    e.preventDefault();

    const fd = new FormData(this);
    fd.append("_method", "PUT");
    $("#editBrand").text("Updating...");

    $.ajax({
      url: `${ip}/api/brands/${$("#brand_id").val()}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      data: fd,
      processData: false,
      contentType: false,
      success: function () {
        Swal.fire("Updated!", "Brand updated successfully!", "success").then(
          () => location.reload()
        );
      },
      error: function (xhr) {
        Swal.fire("Error", xhr.responseText, "error");
      },
    });
  });

  // -------------------------------
  // Delete Brand
  // -------------------------------
  $(document).on("click", ".deleteBtn", function (e) {
    e.preventDefault();
    const brand_id = $(this).data("id");

    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        $.ajax({
          url: `${ip}/api/brands/${brand_id}`,
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          success: function (res) {
            Swal.fire("Deleted!", res.msg, "success").then(() => {
              location.reload();
            });
          },
          error: function (xhr) {
            Swal.fire("Error", xhr.responseText, "error");
          },
        });
      }
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
