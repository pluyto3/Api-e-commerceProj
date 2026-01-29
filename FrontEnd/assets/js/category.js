// Global variables
let ip = "http://localhost:8000";
let token = null;
let usr = null;
let role = null;

// Function to load user session and update UI accordingly
function load_user() {
  usr = $.cookie("username");
  token = $.cookie("token");
  role = $.cookie("role");
  profileImage = $.cookie("profileImage");

  // console.log("Profile image cookie:", $.cookie("profileImage"));

  // Select elements
  const $displayUsername = $("#displayUsername");
  const $login = $("#login");
  const $register = $("#register");
  const $logout = $("#logout");
  const $cartCount = $("#cart-count");
  const $adminDashboard = $("#adminDashboard");
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");

  if (!usr || !token) {
    // No session → show login/register, hide logout and cart
    $displayUsername.html("My Account");
    $login.show();
    $register.show();
    $logout.hide();
    $cartCount.hide();
    $adminDashboard.hide();

    // Show default icon, hide uploaded image
    $navbarProfileImage.hide();
    $defaultProfileIcon.show();
    return;
  }

  // Session exists → show username, show logout, hide login/register
  $displayUsername.html("<b>" + usr + "</b>");
  $login.hide();
  $register.hide();
  $logout.show();
  $cartCount.show();

  // Show/hide admin dashboard by role
  if (role === "admin" || role === "seller") {
    $adminDashboard.show();
  } else {
    $adminDashboard.hide();
  }
}

$(document).ready(function () {
  load_user(); //  initialize session

  // Sidebar Toggle
  $(".menu-btn").click(function () {
    $(".sidebar").addClass("collapsed");
    $(".wrapper").addClass("sidebar-collapsed");
    $(".text-link").hide();
    $(".close-btn").show();
    $(".menu-btn").hide();
  });

  $(".close-btn").click(function () {
    $(".sidebar").removeClass("collapsed");
    $(".wrapper").removeClass("sidebar-collapsed");
    $(".text-link").show();
    $(".close-btn").hide();
    $(".menu-btn").show();
  });

  // Loading animation
  $(document).ajaxStart(() => $("#wait").show());
  $(document).ajaxComplete(() => $("#wait").hide());

  // Load profile image in navbar
  if (usr) {
    $.ajax({
      url: ip + "/api/getAccount_username/" + usr,
      type: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
      },
      dataType: "json",
      success: function (response) {
        console.log("User data:", response);

        if (response && response.image) {
          $("#navbarProfileImage").attr(
            "src",
            "http://localhost:8000/FrontEnd/assets/img/user/" + response.image
          );
          $("#navbarProfileImage").show();
          $("#defaultProfileIcon").hide();
        } else {
          $("#navbarProfileImage").hide();
          $("#defaultProfileIcon").show();
        }
      },
      error: function (xhr, status, error) {
        console.error("Error loading profile:", xhr.responseText);
        $("#navbarProfileImage").hide();
        $("#defaultProfileIcon").show();
      },
    });
  } else {
    console.error("No username found in cookie.");
  }

  // Creating category
  $("#categoryForm").on("submit", function (e) {
    e.preventDefault();

    const fd = new FormData(this);
    $("#createCategory").text("Adding...");

    $.ajax({
      url: ip + "/api/category",
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
      },
      data: fd,
      processData: false,
      contentType: false,
      success: function (res) {
        // console.log(res);
        Swal.fire({
          icon: "success",
          title: "Category Added Successfully",
          text: "Your category has been added.",
          showConfirmButton: false,
        }).then(() => {
          $("#createCategory").text("Add");
          $("#categoryForm")[0].reset(); // Reset the form
          location.reload(); // Reload the page to see changes
        });
      },
      error: function (xhr) {
        Swal.fire({
          icon: "error",
          title: "Error Adding Category",
          text: xhr.responseText,
        });
      },
    });
    // Move this outside the submit handler, ideally at the end of your document ready block
    $(document).on("click", ".closeBtn", function () {
      location.reload();
    });
  });

  // Displaying Category
  $.ajax({
    url: ip + "/api/category",
    method: "GET",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
    },
    success: function (res) {
      // console.log("Categories fetched successfully:", res);
      const categories = res.data ?? res;

      categories.forEach((category) => {
        // console.log("Image path from API:", category.image);
        $("#category-table tbody").append(`
          <tr>
            <td>${category.category_id}</td>
            <td>${category.name}</td>
            <td>${category.description}</td>
            <td><img src="http://localhost/e-commerce/BackEnd/public/FrontEnd/assets/img/category/${category.image}" width="50" height="50"></td>
            <td>
            <a href="#" data-id="${category.category_id}" class="text-success mx-1 editBtn" data-toggle="modal" data-target="#editCategoryModal">
              <i class="fas fa-edit fa-2x"></i>
            </a>
            <a href="#" data-id="${category.category_id}" class="text-danger mx-1 deleteBtn">
              <i class="fas fa-trash fa-2x"></i>
            </a>
            </td>
          </tr>
        `);
      });

      // Data Tables Initialization
      $(document).ready(function () {
        $("#category-table").DataTable({
          responsive: {
            details: {
              type: "column", // Expands as a plus (+) icon
              target: "tr", // Expands the entire row when clicked
            },
          },
          scrollX: true, // enables horizontal scroll for wide tables
          autoWidth: false, // better responsive behavior
          columnDefs: [{ targets: "_all", className: "text-center" }],
        });
      });
    },
    error: function (xhr) {
      console.error("Error fetching categories:", xhr);
    },
  });

  // Editing Category
  $(document).on("click", ".editBtn", function (e) {
    e.preventDefault();

    const category_id = $(this).data("id"); // get the data-id from the clicked button
    $("#category_id").val(category_id); // set it into the hidden input for form submission

    // console.log("Category ID for edit:", category_id);
    // console.log("Value of category_id:", category_id, typeof category_id);

    // $("#editCategory").text("Updating....");

    $.ajax({
      url: ip + "/api/category/" + category_id,
      method: "GET",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
      },
      success: function (res) {
        // console.log("Category data fetched for edit:", res);
        // console.log("Response from server:", res);
        $("#editName").val(res.name);
        $("#editDescription").val(res.description);
        if (res.image) {
          const imageUrl =
            "http://localhost/e-commerce/BackEnd/public/FrontEnd/assets/img/category/" +
            res.image;
          // console.log("Setting image source to:", imageUrl);
          $("#currentImagePreview").attr("src", imageUrl);
          $("#currentImagePreview").show(); // Make sure the image element is visible
        } else {
          // If no image, hide the image preview element
          $("#currentImagePreview").hide();
        }
      },
      error: function (xhr) {
        console.error("Error fetching category for edit:", xhr);
        console.error("Status:", xhr.status);
        console.error("Response Text:", xhr.responseText);
        alert(
          "Failed to fetch category data. Please check the console for details."
        );
      },
    });
  });

  // Update Category
  $("#editCategoryForm").submit(function (e) {
    e.preventDefault();

    // console.log("Form submitted");
    const fd = new FormData(this);
    fd.append("_method", "PUT"); // Tell Laravel this is a PUT request
    // console.log("FormData created");

    $("#editCategory").text("Updating....");

    $.ajax({
      url: ip + "/api/category/" + $("#category_id").val(),
      method: "POST", // Use POST with _method=PUT for Laravel compatibility
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
      },
      data: fd,
      processData: false,
      contentType: false,
      success: function (res) {
        console.log("Category updated successfully:", res);
        if (res.status === 200) {
          Swal.fire({
            icon: "success",
            title: "Category Updated Successfully",
            text: "Your category has been updated.",
            showConfirmButton: false,
          }).then(() => {
            $("#editCategory").text("Update");
            $("#editCategoryForm")[0].reset(); // Reset the form
            location.reload(); // Reload the page to see changes
          });
        }
      },
      error: function (xhr) {
        Swal.fire({
          icon: "error",
          title: "Error Updating Category",
          text: xhr.responseText,
        });
      },
    });
  });

  // Delete Category
  $(document).on("click", ".deleteBtn", function (e) {
    e.preventDefault();
    const category_id = $(this).data("id");

    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        $.ajax({
          url: ip + "/api/category/" + category_id,
          method: "DELETE",
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json",
          },
          success: function (res) {
            Swal.fire("Deleted!", res.msg, "success").then(() => {
              location.reload(); // Reload the page to see changes
            });
          },
          error: function (xhr) {
            Swal.fire("Error!", xhr.responseText, "error");
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
