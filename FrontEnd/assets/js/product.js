/* ================================
   GLOBAL VARIABLES
================================ */
const ip = "http://localhost:8000";
let token = $.cookie("token") || null;
let usr = $.cookie("username") || null;
let role = $.cookie("role") || null;
let profileImage = $.cookie("profileImage") || null;

/* ================================
   Load User Session and Update UI
================================ */
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

  // Role-based dashboard access
  role === "admin" || role === "seller"
    ? $adminDashboard.show()
    : $adminDashboard.hide();
}

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

/* ================================ 
   LOADERS FOR CATEGORY & BRAND
================================ */
function loadCategories($select = $("#category_id"), callback) {
  $.ajax({
    url: `${ip}/api/category`,
    method: "GET",
    dataType: "json",
    headers: { Authorization: `Bearer ${token}` },
    success: (data) => {
      const categories = Array.isArray(data.data) ? data.data : data || [];
      $select
        .empty()
        .append(
          '<option value="" disabled selected>Select a category</option>'
        );
      categories.forEach(({ category_id, name }) => {
        $select.append(`<option value="${category_id}">${name}</option>`);
      });
      if (callback) callback();
    },
    error: (xhr) => {
      console.error("Error loading categories:", xhr.responseText);
      $select.html("<option disabled>Error loading categories</option>");
      if (callback) callback();
    },
  });
}

function loadBrands($select = $("#brand_id"), callback) {
  $.ajax({
    url: `${ip}/api/brands`,
    method: "GET",
    dataType: "json",
    headers: { Authorization: `Bearer ${token}` },
    success: (data) => {
      const brands = Array.isArray(data.data) ? data.data : data || [];
      $select
        .empty()
        .append('<option value="" disabled selected>Select a brand</option>');
      brands.forEach(({ brand_id, name }) => {
        $select.append(`<option value="${brand_id}">${name}</option>`);
      });
      if (callback) callback();
    },
    error: (xhr) => {
      console.error("Error loading brands:", xhr.responseText);
      $select.html("<option disabled>Error loading brands</option>");
      if (callback) callback();
    },
  });
}

/* ================================
   SIDEBAR TOGGLE
================================ */
function initSidebarToggle() {
  $(".menu-btn").click(() => {
    $(".sidebar").addClass("collapsed");
    $(".wrapper").addClass("sidebar-collapsed");
    $(".text-link").hide();
    $(".close-btn").show();
    $(".menu-btn").hide();
  });

  $(".close-btn").click(() => {
    $(".sidebar").removeClass("collapsed");
    $(".wrapper").removeClass("sidebar-collapsed");
    $(".text-link").show();
    $(".close-btn").hide();
    $(".menu-btn").show();
  });
}

/* ================================
   LOADING ANIMATION
================================ */
function initLoadingAnimation() {
  $(document)
    .ajaxStart(() => $("#wait").show())
    .ajaxComplete(() => $("#wait").hide());
}

/* ================================
   ADD PRODUCT
================================ */
function initAddProduct() {
  $(".add_product").on("click", () => {
    loadCategories();
    loadBrands();
  });

  $("#productForm").on("submit", function (e) {
    e.preventDefault();

    const categoryId = $("#category_id").val();
    const brandId = $("#brand_id").val();

    if (!categoryId || !brandId) {
      return Swal.fire(
        "Validation Error",
        "Please select both a category and a brand.",
        "error"
      );
    }

    const fd = new FormData(this);
    fd.set("category_id", categoryId);
    fd.set("brand_id", brandId);

    $("#createProduct").text("Adding...");

    $.ajax({
      url: `${ip}/api/products`,
      method: "POST",
      data: fd,
      processData: false,
      contentType: false,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      success: (res, _, xhr) => {
        if (xhr.status === 201) {
          Swal.fire({
            icon: "success",
            title: "Product Added",
            text: "Your product has been added.",
            showConfirmButton: false,
            timer: 1500,
          }).then(() => {
            $("#createProduct").text("Add");
            $("#productForm")[0].reset();
          });
        }
      },
      error: (xhr) => {
        if (xhr.status === 422) {
          const errors = xhr.responseJSON.errors;
          const msg = Object.values(errors)
            .map((e) => e[0])
            .join("\n");
          Swal.fire("Validation Error", msg, "error");
        } else {
          Swal.fire("Error", "Failed to add product", "error");
        }
      },
    });
  });
}

/* ================================
   CLOSE BUTTON TO RELOAD PAGE
================================ */
function initCloseButton() {
  $(".closeBtn").on("click", () => {
    location.reload();
  });
}

/* ================================
   DISPLAY PRODUCTS TABLE
================================ */
function loadProducts() {
  $.ajax({
    url: `${ip}/api/products`,
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    success: (res) => {
      const products = res.data ?? res;
      const $tbody = $("#product-table tbody");

      $tbody.empty();
      products.forEach((p) => {
        $tbody.append(`
          <tr>
            <td>${p.product_id}</td>
            <td>${p.category_name}</td>s
            <td>${p.brand_name}</td>
            <td>${p.product_name}</td>
            <td>${p.product_price}</td>
            <td>${p.product_description}</td>
            <td>${p.stock_quantity}</td>
            <td><img src="http://localhost/e-commerce/BackEnd/public/FrontEnd/assets/img/product/${p.image}" width="50" height="50"></td>
            <td>
              <a href="#" data-id="${p.product_id}" class="text-success mx-1 editBtn" data-toggle="modal" data-target="#editProductModal">
                <i class="fas fa-edit fa-2x"></i>
              </a>
              <a href="#" data-id="${p.product_id}" class="text-danger mx-1 deleteBtn">
                <i class="fas fa-trash fa-2x"></i>
              </a>
            </td>
          </tr>
        `);
      });

      $("#product-table").DataTable({
        responsive: {
          details: {
            type: "column", // Expands as a plus (+) icon
            target: "tr", // Expands the entire row when clicked
          },
        },
        scrollX: true, // enables horizontal scroll for wide tables
        autoWidth: true, // better responsive behavior
        columnDefs: [{ targets: "_all", className: "text-center" }],
      });
    },
    error: (xhr) => console.error("Error fetching products:", xhr),
  });
}

/* ================================
   EDIT PRODUCT
================================ */
function initEditProduct() {
  $(document).on("click", ".editBtn", function (e) {
    e.preventDefault();

    const productId = $(this).data("id");
    $("#product_id").val(productId);

    // Load select lists first
    loadCategories($("#edit_category_id"), () =>
      loadBrands($("#edit_brand_id"), () => {
        // Then fetch product data
        $.ajax({
          url: `${ip}/api/products/${productId}`,
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          success: (res) => {
            const p = res.data || res;
            $("#edit_product_id").val(p.product_id);
            $("#edit_category_id").val(p.category_id);
            $("#edit_brand_id").val(p.brand_id);
            $("#edit_product_name").val(p.product_name);
            $("#edit_product_price").val(p.product_price);
            $("#edit_product_description").val(p.product_description);
            $("#edit_stock_quantity").val(p.stock_quantity);
            if (p.image) {
              $("#image-preview")
                .attr(
                  "src",
                  `http://localhost/e-commerce/BackEnd/public/FrontEnd/assets/img/product/${p.image}`
                )
                .show();
            }
          },
          error: (xhr) =>
            Swal.fire("Error", "Failed to fetch product data.", "error"),
        });
      })
    );
  });
}

/* ================================
   UPDATE PRODUCT
================================ */
function initUpdateProduct() {
  $("#editProductForm").on("submit", function (e) {
    e.preventDefault();

    const fd = new FormData(this);
    fd.append("_method", "PUT");
    const productId = $("#product_id").val();

    $("#editProduct").text("Updating...");

    $.ajax({
      url: `${ip}/api/products/${productId}`,
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      data: fd,
      processData: false,
      contentType: false,
      success: (res) => {
        Swal.fire({
          icon: "success",
          title: "Product Updated",
          text: res.msg || "Your product has been updated.",
          timer: 1500,
          showConfirmButton: false,
        }).then(() => location.reload());
      },
      error: (xhr) =>
        Swal.fire("Error Updating Product", xhr.responseText, "error"),
    });
  });
}

/* ================================
   DELETE PRODUCT
================================ */
function initDeleteProduct() {
  $(document).on("click", ".deleteBtn", function (e) {
    e.preventDefault();

    const productId = $(this).data("id");

    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (!result.isConfirmed) return;

      $.ajax({
        url: `${ip}/api/products/${productId}`,
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        success: (res) => {
          Swal.fire("Deleted!", res.msg, "success").then(() =>
            location.reload()
          );
        },
        error: (xhr) => Swal.fire("Error!", xhr.responseText, "error"),
      });
    });
  });
}

/* ================================
   INITIALIZE ON DOCUMENT READY
================================ */

$(document).ready(() => {
  // -------------------------------
  // Global AJAX Loading Animation
  // -------------------------------
  $(document)
    .ajaxStart(() => $("#wait").show())
    .ajaxComplete(() => $("#wait").hide());

  load_user();
  initSidebarToggle();
  initLoadingAnimation();
  initAddProduct();
  loadProducts();
  initEditProduct();
  initUpdateProduct();
  initDeleteProduct();
  initCloseButton();

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
