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
  let defaultAddressInfo = null;
  let defaultAccountInfo = null;
  let allCartItems = []; // Declare here to make it accessible later

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

  // Combine AJAX calls for user info and address
  const accountRequest = $.ajax({
    url: `${ip}/api/getAccount_username/${usr}`,
    method: "GET",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
    },
  });

  const locationRequest = $.ajax({
    url: `${ip}/api/location`,
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  $.when(accountRequest, locationRequest)
    .done(function (accountAjax, locationAjax) {
      const accountResponse = accountAjax[0];
      const locationResponse = locationAjax[0];

      // Store default account info
      defaultAccountInfo = {
        fullname: accountResponse.fullname || "",
        phone_number: accountResponse.phone_number || "",
      };

      // Find and store default address info
      let locations = [];
      if (
        locationResponse &&
        locationResponse.data &&
        Array.isArray(locationResponse.data)
      ) {
        locations = locationResponse.data;
      } else if (Array.isArray(locationResponse)) {
        locations = locationResponse;
      }

      defaultAddressInfo = locations.find(
        (addr) =>
          addr.is_default == 1 ||
          addr.is_default === true ||
          addr.is_default === "1",
      );

      if (!defaultAddressInfo && locations.length > 0) {
        defaultAddressInfo = locations[0];
      }

      // Initially, check the box if we have a default address, otherwise uncheck and disable it
      if (defaultAddressInfo) {
        $("#sameAddress").prop("checked", true);
      } else {
        $("#sameAddress").prop("checked", false).prop("disabled", true);
      }
      // Trigger change to set the initial state of the form
      handleAddressCheckbox();
    })
    .fail(function (xhr) {
      console.error(
        "Error fetching account or location details:",
        xhr.responseText,
      );
      // If requests fail, uncheck box, disable it, and enable fields for manual input
      $("#sameAddress").prop("checked", false).prop("disabled", true);
      handleAddressCheckbox();
    });

  // Function to validate form fields
  function validateForm() {
    let isValid = true;
    const requiredFields = [
      "#name",
      "#phone",
      "#purok",
      "#barangay",
      "#city",
      "#province",
    ];

    requiredFields.forEach(function (fieldSelector) {
      const $field = $(fieldSelector);
      if ($field.val().trim() === "") {
        $field.addClass("is-invalid");
        isValid = false;
      } else {
        $field.removeClass("is-invalid");
      }
    });

    if (!isValid) {
      Swal.fire(
        "Validation Error",
        "Please fill in all required billing and shipping address fields.",
        "error",
      );
    }
    return isValid;
  }

  // Checkbox change handler
  $("#sameAddress").on("change", handleAddressCheckbox);

  function handleAddressCheckbox() {
    const isChecked = $("#sameAddress").is(":checked");
    $("#sameAddress").prop("disabled", false);
    // Select all input fields in the form, EXCEPT the 'sameAddress' checkbox
    const formFields = $("#checkoutform input");

    if (isChecked) {
      // If checkbox is checked, fill with default info and disable fields
      if (defaultAccountInfo) {
        $("#name").val(defaultAccountInfo.fullname || "");
        $("#phone").val(defaultAccountInfo.phone_number || "");
      } else {
        // If no default account info, clear name/phone and warn
        $("#name").val("");
        $("#phone").val("");
        console.warn("No default account info found to pre-fill name/phone.");
      }

      if (defaultAddressInfo) {
        $("#purok").val(defaultAddressInfo.purok || "");
        $("#barangay").val(defaultAddressInfo.barangay || "");
        $("#city").val(defaultAddressInfo.city || "");
        $("#province").val(defaultAddressInfo.province || "");
        $("#zipcode").val(defaultAddressInfo.zipcode || "");
      } else {
        // If no default address, clear address fields and warn
        $("#purok").val("");
        $("#barangay").val("");
        $("#city").val("");
        $("#province").val("");
        console.warn("No default address found to pre-fill address fields.");
      }

      formFields.prop("disabled", true);
      $("#sameAddress").prop("disabled", false);
    } else {
      // If checkbox is unchecked, enable fields and clear them for manual entry
      formFields.prop("disabled", false);
      $("#name").val("");
      $("#phone").val("");
      $("#purok").val("");
      $("#barangay").val("");
      $("#city").val("");
      $("#sameAddress").prop("disabled", false);
      $("#province").val("");
      $("#zipcode").val("");
    }
  }

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

      allCartItems = response.cart || response.data || []; // Assign to the higher-scoped variable

      const cartItems = allCartItems.filter((item) =>
        selectedIds.includes(item.addTocart_id),
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
          <div class="d-flex align-items-center mb-3">
              <img src="${ip}/FrontEnd/assets/img/product/${item.product.image}" alt="${name}" style="width: 65px; height: 65px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0;">
              <div class="flex-grow-1 ml-3" style="line-height: 1.2;">
                  <h6 class="font-weight-bold mb-1" style="font-size: 0.95rem;">${name}</h6>
                  <small class="text-muted d-block">Price: ₱${price.toLocaleString()}</small>
                  <small class="text-muted d-block">Qty: ${quantity}</small>
              </div>
              <div class="font-weight-bold ml-2">
                  ₱${subtotal.toLocaleString()}
              </div>
          </div>
        `;

        $(".cartItems").append(listCartItems);
      });

      // Update Subtotal and Total calculations
      const subtotal = totalAmount;
      const shippingFee = 50; // This can be made dynamic based on address later.
      const finalTotal = subtotal + shippingFee;

      $("#ui-subtotal").text(`₱${subtotal.toLocaleString()}`);
      $("#ui-shipping").text(`₱${shippingFee.toLocaleString()}`);
      $("#ui-total").text(`₱${finalTotal.toLocaleString()}`);

      // Update your global totalAmount variable so the correct final price is sent to your backend
      totalAmount = finalTotal; // The backend expects the grand total.
    },
    error: function (xhr) {
      console.error("Error fetching cart items:", xhr.responseText);
    },
  });

  $("#placeOrder").on("click", function (e) {
    e.preventDefault();

    // Get the current cart items for confirmation page display
    // This assumes cartItems is populated from the earlier AJAX call
    const currentCartItems = $(".cartItems")
      .children()
      .map(function () {
        return $(this).data("item-details"); // Assuming you store item details with .data()
      })
      .get();
    // Validate form fields before proceeding
    if (!validateForm()) {
      return; // Stop execution if validation fails
    }

    // Get the selected item IDs from sessionStorage
    const selectedItemsJSON = sessionStorage.getItem("selectedCartItems");

    // Validate that there are selected items
    if (!selectedItemsJSON) {
      alert(
        "No items are selected. Please select items from your cart to check out.",
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
        error,
      );
      alert(
        "There was an error reading your cart. Please refresh and try again.",
      );
      return;
    }

    // Double-check that the array isn't empty
    if (!Array.isArray(selectedItemIDs) || selectedItemIDs.length === 0) {
      alert(
        "No items are selected. Please select items from your cart to check out.",
      );
      return;
    }

    // const email = $("#email").val();
    const phone = $("#phone").val();
    const purok = $("#purok").val();
    const barangay = $("#barangay").val();
    const city = $("#city").val();
    const province = $("#province").val();
    const zipcode = $("#zipcode").val();
    const paymentMethod = $("input[name='paymentMethod']:checked").val();

    const checkoutData = {
      // Include name for the backend if needed, but for confirmation page, we'll use the form value
      // name: $("#name").val(),
      // email: $("#email").val(), // If you add an email field
      fullname: $("#name").val(), // Assuming name is for recipient
      username: usr, // Pass username for backend association
      phone: phone,
      purok: purok,
      barangay: barangay,
      city: city,
      province: province,
      zipcode: zipcode,
      payment_method: paymentMethod,
      total_amount: totalAmount,
      item_ids: selectedItemIDs,
      shipping_fee: 50, // Assuming fixed shipping fee for now
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

        // Prepare data for the confirmation page
        const confirmedOrderDetails = {
          orderId: response.order_id || "N/A", // Assuming backend returns order_id
          customerName: $("#name").val(),
          totalAmount: totalAmount,
          paymentMethod: paymentMethod,
          shippingFee: 50, // Consistent with calculation
          shipping: {
            name: $("#name").val(),
            phone: $("#phone").val(),
            purok: $("#purok").val(),
            barangay: $("#barangay").val(),
            city: $("#city").val(),
            province: $("#province").val(),
            zipcode: $("#zipcode").val(),
          },
          // Filter cart items to only include those that were selected for this order
          orderedItems: allCartItems
            .filter((item) => selectedItemIDs.includes(item.addTocart_id))
            .map((item) => ({
              name: item.product.product_name,
              price: item.product.product_price,
              quantity: item.quantity,
              subtotal: item.subtotal,
              image: item.product.image,
            })),
        };
        sessionStorage.setItem(
          "lastConfirmedOrder",
          JSON.stringify(confirmedOrderDetails),
        );

        Swal.fire({
          icon: "success",
          title: "Order Placed Successfully",
          text: "Thank you for your purchase!",
          showConfirmButton: true,
        }).then(() => {
          sessionStorage.removeItem("selectedCartItems"); // Clear selected items
          window.location.href = "orderConfirmation.html"; // Redirect to confirmation page
        });
      },
      error: function (xhr) {
        console.error("Error during checkout:", xhr.responseText);
        Swal.fire({
          icon: "error",
          title: "Checkout Failed",
          text: "An error occurred while processing your order. Please try again.",
          showConfirmButton: true,
        }).then(() => {
          window.location.href = "checkout.html";
        });
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
