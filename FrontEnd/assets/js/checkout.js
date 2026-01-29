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

// Data Tables Initialization
$(document).ready(function () {
  load_user();

  // Get the selected cart item IDs from sessionStorage
  const selectedIdsJSON = sessionStorage.getItem("selectedCartItems");

  // if no selected items, redirect to cart page
  if (!selectedIdsJSON) {
    console.error("No selected items found. Redirecting to cart.");
    window.location.href = "cart.html";
    return;
  }

  const selectedIds = JSON.parse(selectedIdsJSON);

  // if selected items array is empty, redirect to cart page
  if (!selectedIds || selectedIds.length === 0) {
    console.error("Selected items array is empty. Redirecting to cart.");
    window.location.href = "cart.html";
    return;
  }

  let totalAmount = 0;

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

  // Display Information in CheckOut Page
  $.ajax({
    url: `${ip}/api/getAccount_username/${usr}`,
    method: "GET",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
    },
    success: function (response) {
      console.log("User response:", response);
      $("#name").val(response.fullname || "");
      $("#phone").val(response.phone_number || "");
    },
  });

  // Populate Address Fields with the DEFAULT address
  $.ajax({
    url: `${ip}/api/location`,
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    success: function (response) {
      // console.log("Full location response:", response);

      // (This logic assumes your API returns { data: [...] } like your previous function)
      let locations = [];
      if (response && response.data && Array.isArray(response.data)) {
        locations = response.data;
      } else if (Array.isArray(response)) {
        locations = response; // In case the API just returns the array
      } else {
        console.error(
          "Unexpected response format. Expected an array or { data: [...] }"
        );
        return;
      }

      //Find the default address from the array
      const defaultAddress = locations.find((addr) => addr.is_default == 1);

      // Populate fields IF a default was found
      if (defaultAddress) {
        // console.log("Default address found:", defaultAddress);
        $("#purok").val(defaultAddress.purok || "");
        $("#barangay").val(defaultAddress.barangay || "");
        $("#city").val(defaultAddress.city || "");
        $("#province").val(defaultAddress.province || "");
      } else {
        console.log("No default address found in the list.");
        // Clear fields if no default is set
        $("#purok").val("");
        $("#barangay").val("");
        $("#city").val("");
        $("#province").val("");
      }
    },
    error: function (xhr) {
      console.error("Error fetching location:", xhr.responseText);
    },
  });

  // Display Cart Items in CheckOut Page
  $.ajax({
    url: `${ip}/api/cart`,
    method: "GET",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
    },
    success: function (response) {
      console.log("Cart response:", response);

      const allCartItems = response.cart || response.data || [];

      const cartItems = allCartItems.filter((item) =>
        selectedIds.includes(item.addTocart_id)
      );
      //   console.log("Cart items:", cartItems);

      totalAmount = 0;

      $(".cartItems").empty();

      cartItems.forEach((item) => {
        const id = item.addTocart_id;
        const name = item.product.product_name || "Unnamed Product";
        const price = item.product.product_price || 0;
        const quantity = item.quantity || 0;
        const subtotal = item.subtotal || price * quantity;
        totalAmount += subtotal;

        console.log("Cart item:", item);

        const listCartItems = `
        <li class="list-group-item d-flex align-items-center" style="text-align: start">
            <div>
                <img src="${ip}/FrontEnd/assets/img/product/${
          item.product.image
        }" alt="${name}" width="80px" height="90px">
            </div>
            <div class="flex-grow-1 cart-item-details" >
              <p class="fw-bold">${name}</p>
              <p>Price: ₱${price.toLocaleString()}</p>
              <p>Quantity: ${quantity}</p>
            </div>
          <div class="cart-item-subtotal fw-bold ms-auto">
            Total: ₱${subtotal.toLocaleString()}
          </div>
        </li>
        `;

        $(".cartItems").append(listCartItems);
        $(".cartTotalPrice").text(
          `Total Price: ₱${totalAmount.toLocaleString()}`
        );
      });
    },
    error: function (xhr) {
      console.error("Error fetching cart items:", xhr.responseText);
    },
  });

  $("#placeOrder").on("click", function (e) {
    e.preventDefault();

    // Get the selected item IDs from sessionStorage
    const selectedItemsJSON = sessionStorage.getItem("selectedCartItems");

    // Validate that there are selected items
    if (!selectedItemsJSON) {
      alert(
        "No items are selected. Please select items from your cart to check out."
      );
      return;
    }

    let selectedItemIDs;
    try {
      // Parse the JSON string back into an array
      selectedItemIDs = JSON.parse(selectedItemsJSON);
    } catch (error) {
      console.error(
        "Error parsing selectedCartItems from sessionStorage:",
        error
      );
      alert(
        "There was an error reading your cart. Please refresh and try again."
      );
      return;
    }

    // Double-check that the array isn't empty
    if (!Array.isArray(selectedItemIDs) || selectedItemIDs.length === 0) {
      alert(
        "No items are selected. Please select items from your cart to check out."
      );
      return;
    }

    // const email = $("#email").val();
    const phone = $("#phone").val();
    const purok = $("#purok").val();
    const barangay = $("#barangay").val();
    const city = $("#city").val();
    const province = $("#province").val();
    const paymentMethod = $("input[name='paymentMethod']:checked").val();

    const checkoutData = {
      phone: phone,
      purok: purok,
      barangay: barangay,
      city: city,
      province: province,
      payment_method: paymentMethod,
      total_amount: totalAmount,
      item_ids: selectedItemIDs,
    };

    console.log("Checkout Data:", checkoutData);

    $.ajax({
      url: `${ip}/api/checkout`,
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: JSON.stringify(checkoutData),
      success: function (response) {
        console.log("Checkout response:", response);

        Swal.fire({
          icon: "success",
          title: "Order Placed Successfully",
          text: "Thank you for your purchase!",
          showConfirmButton: true,
        }).then(() => {
          // Clear selected cart items from sessionStorage
          sessionStorage.removeItem("selectedCartItems");
          window.location.href = "cart.html";
        });
        // window.location.href = "index.html"; // Redirect to homepage or order confirmation page
      },
      error: function (xhr) {
        console.error("Error during checkout:", xhr.responseText);
        alert("Failed to place order. Please try again.");
      },
    });
  });

  // Fetch cart count
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
