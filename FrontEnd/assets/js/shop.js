/* ================================
   GLOBAL VARIABLES
================================ */
const ip = "http://165.245.179.185:8080";
let token = null;
let usr = null;
let role = null;
let profileImage = null;
const apiBaseUrl = getApiBaseUrl();
let allCategories = [];
let allBrands = [];
let allProducts = [];
const productsPerPage = 20;
let currentPage = 1;
let activeCategory = { id: "all", name: "all" };
let activeBrand = { id: "all", name: "all" };
let activeSort = "relevance";
let activeSearch = "";
let activeMinPrice = "";
let activeMaxPrice = "";

function getApiBaseUrl() {
  if (window.SHOP_API_BASE_URL) {
    return String(window.SHOP_API_BASE_URL).replace(/\/+$/, "");
  }

  const pathname = window.location.pathname || "";
  const projectRoot = pathname.includes("/FrontEnd/")
    ? pathname.split("/FrontEnd/")[0]
    : "";

  if (projectRoot.endsWith("/BackEnd/public")) {
    return `${window.location.origin}${projectRoot}`;
  }

  if (projectRoot) {
    return `${window.location.origin}${projectRoot}/BackEnd/public`;
  }

  if (window.location.port === "8000") {
    return window.location.origin;
  }

  return "http://165.245.179.185:8080";
}

function getApiHeaders(extraHeaders = {}) {
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

function getResponseList(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.categories)) return response.categories;
  if (Array.isArray(response?.products)) return response.products;
  return [];
}

function getCartItemsFromResponse(response) {
  if (Array.isArray(response?.cart)) return response.cart;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function updateCartCount(count) {
  $("#cart-count").text(count || 0);
}

function loadCartCount() {
  const userRole = normalizeText(role);

  if (!token || userRole === "admin" || userRole === "seller") {
    updateCartCount(0);
    return;
  }

  $.ajax({
    url: `${apiBaseUrl}/api/cart`,
    method: "GET",
    headers: getApiHeaders(),
    success: function (response) {
      const cartItems = getCartItemsFromResponse(response);
      updateCartCount(response?.count || cartItems.length || 0);
    },
    error: function (xhr) {
      console.error("Error loading cart count:", xhr.responseText || xhr);
      updateCartCount(0);
    },
  });
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeStatus(status) {
  return normalizeText(status || "approved");
}

function getProductId(product) {
  return product?.product_id || product?.id || "";
}

function getProductName(product) {
  return product?.product_name || product?.name || "Unknown Product";
}

function getCategoryId(category) {
  return category?.category_id || category?.id || "";
}

function getCategoryName(category) {
  return category?.name || category?.category_name || "Unnamed Category";
}

function getCategoryKey(categoryId, categoryName) {
  const id = String(categoryId || "").trim();
  if (id) return `id:${id}`;

  return `name:${normalizeText(categoryName)}`;
}

function getBrandId(brand) {
  return brand?.brand_id || brand?.id || "";
}

function getBrandName(brand) {
  return brand?.name || brand?.brand_name || "Unnamed Brand";
}

function getProductBrandId(product) {
  if (product?.brand && typeof product.brand === "object") {
    return product.brand.brand_id || product.brand.id || "";
  }

  return product?.brand_id || "";
}

function getProductBrandName(product) {
  if (product?.brand && typeof product.brand === "object") {
    return product.brand.name || product.brand.brand_name || "";
  }

  return product?.brand || product?.brand_name || "";
}

function getProductCategoryId(product) {
  if (product?.category && typeof product.category === "object") {
    return product.category.category_id || product.category.id || "";
  }

  return product?.category_id || "";
}

function getProductCategoryName(product) {
  if (product?.category && typeof product.category === "object") {
    return product.category.name || product.category.category_name || "";
  }

  return product?.category || product?.category_name || "";
}

function buildImageUrl(folder, image) {
  if (!image) return "assets/img/back.jpg";

  const imageValue = String(image);
  if (/^(https?:)?\/\//i.test(imageValue)) return imageValue;

  const filename = imageValue.split("/").pop();
  return `${apiBaseUrl}/FrontEnd/assets/img/${folder}/${encodeURIComponent(filename)}`;
}

function showShopCatalog() {
  $("#shop-categories-panel, #shop-products-panel, #shop-products-container")
    .removeAttr("hidden")
    .css("display", "");
}

function loadUser() {
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
  const $productUi = $("#productUi");
  const $navbarProfileImage = $("#navbarProfileImage");
  const $defaultProfileIcon = $("#defaultProfileIcon");
  const userRole = normalizeText(role);

  if (!usr || !token) {
    // No session → show login/register, hide logout & cart
    $displayUsername.html("My Account");
    $login.show();
    $register.show();
    $logout.hide();
    $cartCount.hide();
    $adminDashboard.hide();
    $productUi.hide();
    $navbarProfileImage.hide();
    $defaultProfileIcon.show();
    return;
  }

  // Session exists → show username & logout
  $displayUsername.html(`<b>${usr}</b>`);
  $login.hide();
  $register.hide();
  $logout.show();
  showShopCatalog();

  // Show cart only for regular users (not sellers/admins)
  if (!userRole || userRole === "user") {
    $cartCount.show();
  } else {
    $cartCount.hide();
  }

  // Show admin dashboard for admin/seller only
  userRole === "admin" || userRole === "seller"
    ? $adminDashboard.show()
    : $adminDashboard.hide();

  userRole === "admin" || userRole === "seller"
    ? $productUi.show()
    : $productUi.hide();
}

function renderCategories(categories) {
  const $list = $("#shop-category-list").empty();
  const categoryMap = new Map();
  const categoriesByName = new Map();

  categories.forEach((category) => {
    const categoryId = getCategoryId(category);
    const categoryName = getCategoryName(category);

    if (!categoryName) return;

    categoriesByName.set(normalizeText(categoryName), category);

    if (
      normalizeStatus(category.status || category.approval_status) !==
      "approved"
    ) {
      return;
    }

    categoryMap.set(getCategoryKey(categoryId, categoryName), {
      id: String(categoryId),
      name: categoryName,
    });
  });

  allProducts.forEach((product) => {
    const productStatus = normalizeStatus(
      product.approval_status || product.status,
    );
    const productCategoryName = getProductCategoryName(product);

    if (productStatus !== "approved" || !productCategoryName) return;

    const matchingCategory = categoriesByName.get(
      normalizeText(productCategoryName),
    );
    const categoryId =
      getProductCategoryId(product) ||
      (matchingCategory ? getCategoryId(matchingCategory) : "");
    const categoryName = matchingCategory
      ? getCategoryName(matchingCategory)
      : productCategoryName;

    categoryMap.set(getCategoryKey(categoryId, categoryName), {
      id: String(categoryId || `name:${normalizeText(categoryName)}`),
      name: categoryName,
    });
  });

  const catalogCategories = Array.from(categoryMap.values());

  $list.append(
    createCategoryItem("all", "All Categories", activeCategory.id === "all"),
  );

  if (!catalogCategories.length) {
    $list.append(
      $("<li>").append(
        $("<span>", {
          class: "text-muted py-1 d-block small",
        }).text("No approved categories yet."),
      ),
    );
    return;
  }

  catalogCategories.forEach((category) => {
    const isActive =
      String(category.id) === String(activeCategory.id) ||
      normalizeText(category.name) === normalizeText(activeCategory.name);
    $list.append(createCategoryItem(category.id, category.name, isActive));
  });
}

function createCategoryItem(categoryId, categoryName, isActive) {
  return $("<li>").append(
    $("<a>", {
      href: "#",
      class: `text-dark py-1 d-block shop-category-link${isActive ? " active" : ""}`,
      "data-category-id": categoryId,
      "data-category-name": categoryName,
    }).text(categoryName),
  );
}

function renderBrands(brands) {
  const $list = $("#shop-brand-list").empty();
  const brandMap = new Map();
  const brandsByName = new Map();

  brands.forEach((brand) => {
    const brandId = getBrandId(brand);
    const brandName = getBrandName(brand);

    if (!brandName) return;
    brandsByName.set(normalizeText(brandName), brand);

    if (normalizeStatus(brand.status || brand.approval_status) !== "approved") {
      return;
    }

    brandMap.set(String(brandId || `name:${normalizeText(brandName)}`), {
      id: String(brandId),
      name: brandName,
    });
  });

  allProducts.forEach((product) => {
    const productStatus = normalizeStatus(
      product.approval_status || product.status,
    );
    const productBrandName = getProductBrandName(product);

    if (productStatus !== "approved" || !productBrandName) return;

    const matchingBrand = brandsByName.get(normalizeText(productBrandName));
    const brandId =
      getProductBrandId(product) ||
      (matchingBrand ? getBrandId(matchingBrand) : "");
    const brandName = matchingBrand
      ? getBrandName(matchingBrand)
      : productBrandName;

    brandMap.set(String(brandId || `name:${normalizeText(brandName)}`), {
      id: String(brandId || `name:${normalizeText(brandName)}`),
      name: brandName,
    });
  });

  const catalogBrands = Array.from(brandMap.values());
  $list.append(createBrandItem("all", "All Brands", activeBrand.id === "all"));

  if (!catalogBrands.length) {
    $list.append(
      $("<li>").append(
        $("<span>", {
          class: "text-muted py-1 d-block small",
        }).text("No approved brands yet."),
      ),
    );
    return;
  }

  catalogBrands.forEach((brand) => {
    const isActive =
      String(brand.id) === String(activeBrand.id) ||
      normalizeText(brand.name) === normalizeText(activeBrand.name);
    $list.append(createBrandItem(brand.id, brand.name, isActive));
  });
}

function createBrandItem(brandId, brandName, isActive) {
  return $("<li>").append(
    $("<a>", {
      href: "#",
      class: `text-dark py-1 d-block shop-brand-link${isActive ? " active" : ""}`,
      "data-brand-id": brandId,
      "data-brand-name": brandName,
    }).text(brandName),
  );
}

function loadCategories() {
  return $.ajax({
    url: `${apiBaseUrl}/api/category?scope=public`,
    method: "GET",
    headers: getApiHeaders(),
    success: function (response) {
      allCategories = getResponseList(response);
      renderCategories(allCategories);
    },
    error: function (xhr) {
      console.error("Error loading categories:", xhr.responseText || xhr);
      $("#shop-category-list")
        .empty()
        .append(
          $("<li>").append(
            $("<span>", {
              class: "text-danger py-1 d-block small",
            }).text("Unable to load categories."),
          ),
        );
    },
  });
}

function loadBrands() {
  return $.ajax({
    url: `${apiBaseUrl}/api/brands?scope=public`,
    method: "GET",
    headers: getApiHeaders(),
    success: function (response) {
      allBrands = getResponseList(response);
      renderBrands(allBrands);
    },
    error: function (xhr) {
      console.error("Error loading brands:", xhr.responseText || xhr);
      $("#shop-brand-list")
        .empty()
        .append(
          $("<li>").append(
            $("<span>", {
              class: "text-danger py-1 d-block small",
            }).text("Unable to load brands."),
          ),
        );
    },
  });
}

function loadProducts() {
  return $.ajax({
    url: `${apiBaseUrl}/api/products?scope=public`,
    method: "GET",
    headers: getApiHeaders(),
    success: function (response) {
      allProducts = getResponseList(response);
      renderCategories(allCategories);
      renderBrands(allBrands);
      renderProducts();
    },
    error: function (xhr) {
      console.error("Error loading products:", xhr.responseText || xhr);
      $("#shop-products-container").html(`
        <div class="col-12">
          <p class="text-danger text-center py-4 mb-0">Unable to load products.</p>
        </div>
      `);
    },
  });
}

function getVisibleProducts() {
  const categoryId = String(activeCategory.id || "all");
  const categoryName = normalizeText(activeCategory.name);
  const brandId = String(activeBrand.id || "all");
  const brandName = normalizeText(activeBrand.name);
  const minPrice = activeMinPrice === "" ? null : Number(activeMinPrice);
  const maxPrice = activeMaxPrice === "" ? null : Number(activeMaxPrice);

  return allProducts.filter((product) => {
    const approvalStatus = normalizeStatus(product.approval_status);
    const productStatus = normalizeStatus(product.status);
    const stock = Number(product.stock_quantity || 0);
    const price = Number(product.product_price || product.price || 0);

    if (approvalStatus !== "approved") return false;
    if (productStatus !== "active") return false;
    if (!Number.isFinite(stock) || stock <= 0) return false;

    if (categoryId !== "all") {
      const productCategoryId = String(getProductCategoryId(product));
      const productCategoryName = normalizeText(
        getProductCategoryName(product),
      );
      const matchesCategoryId =
        productCategoryId && productCategoryId === categoryId;
      const matchesCategoryName =
        productCategoryName && productCategoryName === categoryName;

      if (!matchesCategoryId && !matchesCategoryName) return false;
    }

    if (brandId !== "all") {
      const productBrandId = String(getProductBrandId(product));
      const productBrandName = normalizeText(getProductBrandName(product));
      const matchesBrandId = productBrandId && productBrandId === brandId;
      const matchesBrandName =
        productBrandName && productBrandName === brandName;

      if (!matchesBrandId && !matchesBrandName) return false;
    }

    if (minPrice !== null && Number.isFinite(minPrice) && price < minPrice) {
      return false;
    }

    if (maxPrice !== null && Number.isFinite(maxPrice) && price > maxPrice) {
      return false;
    }

    if (activeSearch) {
      const searchableText = normalizeText(
        [
          getProductName(product),
          getProductCategoryName(product),
          getProductBrandName(product),
          product.product_description,
          product.description,
        ].join(" "),
      );

      if (!searchableText.includes(activeSearch)) return false;
    }

    return true;
  });
}

function sortProducts(products) {
  const sortedProducts = products.slice();

  if (activeSort === "latest") {
    return sortedProducts.sort((a, b) => {
      const dateA = Date.parse(a.created_at || a.updated_at || "") || 0;
      const dateB = Date.parse(b.created_at || b.updated_at || "") || 0;
      return dateB - dateA;
    });
  }

  if (activeSort === "sales") {
    return sortedProducts.sort((a, b) => {
      return (Number(b.sold) || 0) - (Number(a.sold) || 0);
    });
  }

  if (activeSort === "price_asc") {
    return sortedProducts.sort((a, b) => {
      return (
        Number(a.product_price || a.price || 0) -
        Number(b.product_price || b.price || 0)
      );
    });
  }

  if (activeSort === "price_desc") {
    return sortedProducts.sort((a, b) => {
      return (
        Number(b.product_price || b.price || 0) -
        Number(a.product_price || a.price || 0)
      );
    });
  }

  if (activeSort === "name_asc") {
    return sortedProducts.sort((a, b) =>
      getProductName(a).localeCompare(getProductName(b)),
    );
  }

  if (activeSort === "name_desc") {
    return sortedProducts.sort((a, b) =>
      getProductName(b).localeCompare(getProductName(a)),
    );
  }

  return sortedProducts;
}

function renderProducts() {
  const $container = $("#shop-products-container").empty();
  const products = sortProducts(getVisibleProducts());
  const totalPages = Math.ceil(products.length / productsPerPage);

  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

  if (!products.length) {
    $container.html(`
      <div class="col-12">
        <p class="text-muted text-center py-4 mb-0">No products found.</p>
      </div>
    `);
    renderPagination(0);
    return;
  }

  const startIndex = (currentPage - 1) * productsPerPage;
  const pageProducts = products.slice(startIndex, startIndex + productsPerPage);

  pageProducts.forEach((product) => {
    $container.append(createProductCard(product));
  });

  renderPagination(totalPages);
}

function createProductCard(product) {
  const productId = getProductId(product);
  const productName = getProductName(product);
  const productImage = buildImageUrl("product", product.image);
  const productLink = productId ? `single-product.html?id=${productId}` : "#";
  const stock = Number(product.stock_quantity || 0);

  const $image = $("<img>", {
    src: productImage,
    class: "card-img-top rounded-0",
    alt: productName,
    style: "aspect-ratio: 1; object-fit: cover;",
  }).on("error", function () {
    $(this).off("error").attr("src", "assets/img/back.jpg");
  });

  const $body = $("<div>", { class: "card-body p-2 d-flex flex-column" })
    .append(
      $("<a>", {
        href: productLink,
        class: "text-decoration-none text-dark",
      }).append($image),
    )
    .append(
      $("<p>", {
        class: "card-title mb-1",
        style:
          "display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 0.85rem; line-height: 1.2;",
      }).text(productName),
    )
    .append(
      $("<div>", {
        class: "mt-auto d-flex justify-content-between align-items-center pt-2",
      })
        .append(
          $("<span>", {
            style: "color: #ee4d2d; font-size: 1.1rem; font-weight: 500;",
          }).text(`\u20b1${product.product_price ?? product.price ?? ""}`),
        )
        .append(
          $("<small>", {
            class: "text-muted",
            style: "font-size: 0.7rem;",
          }).text(`Sold ${product.sold ?? 0}`),
        ),
    )
    .append(
      $("<small>", {
        class: stock <= 5 ? "text-warning font-weight-bold" : "text-muted",
        style: "font-size: 0.7rem;",
      }).text(`Stock ${stock}`),
    );

  const $card = $("<div>", {
    class: "card dailyProductCard",
  }).append($body);

  return $("<div>", {
    class: "col-6 col-sm-4 col-md-3 col-lg-2-4 shop-product-item",
  }).append($card);
}

function renderPagination(totalPages) {
  const $pagination = $("#shop-pagination");
  const $list = $pagination.find(".pagination").empty();

  if (totalPages <= 1) {
    $pagination.hide();
    return;
  }

  $pagination.show();
  $list.append(createPageItem("Previous", currentPage - 1, currentPage === 1));

  for (let page = 1; page <= totalPages; page += 1) {
    $list.append(createPageItem(page, page, false, page === currentPage));
  }

  $list.append(
    createPageItem("Next", currentPage + 1, currentPage === totalPages),
  );
}

function createPageItem(label, page, isDisabled, isActive = false) {
  return $(`
    <li class="page-item${isDisabled ? " disabled" : ""}${isActive ? " active" : ""}">
      <a class="page-link shop-page-link" href="#" data-page="${page}">${label}</a>
    </li>
  `);
}

function loadFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const q = normalizeText(params.get("q") || params.get("search") || "");

  if (q) {
    activeSearch = q;
    $("#shopSearchInput").val(q);
  }

  if (params.get("category_id")) {
    activeCategory = {
      id: String(params.get("category_id")),
      name: String(params.get("category") || ""),
    };
  }

  if (params.get("brand_id")) {
    activeBrand = {
      id: String(params.get("brand_id")),
      name: String(params.get("brand") || ""),
    };
  }

  activeMinPrice = params.get("min_price") || "";
  activeMaxPrice = params.get("max_price") || "";
  $("#minPriceFilter").val(activeMinPrice);
  $("#maxPriceFilter").val(activeMaxPrice);
}

function setupEvents() {
  $(document).on("click", ".shop-category-link", function (event) {
    event.preventDefault();

    activeCategory = {
      id: String($(this).data("category-id") || "all"),
      name: String($(this).data("category-name") || "all"),
    };
    currentPage = 1;

    $(".shop-category-link").removeClass("active");
    $(this).addClass("active");
    renderProducts();
  });

  $(document).on("click", ".shop-brand-link", function (event) {
    event.preventDefault();

    activeBrand = {
      id: String($(this).data("brand-id") || "all"),
      name: String($(this).data("brand-name") || "all"),
    };
    currentPage = 1;

    $(".shop-brand-link").removeClass("active");
    $(this).addClass("active");
    renderProducts();
  });

  $(".shop-sort-btn").on("click", function () {
    activeSort = String($(this).data("sort") || "relevance");
    currentPage = 1;

    $(".shop-sort-btn").removeClass("active");
    $(this).addClass("active");
    renderProducts();
  });

  let shopSearchTimer = null;

  function applyShopSearch() {
    activeSearch = normalizeText($("#shopSearchInput").val());
    currentPage = 1;

    renderProducts();

    if (activeSearch) {
      const resultCount = getVisibleProducts().length;

      $("#shopSearchStatus").text(
        `${resultCount} product(s) found for "${$("#shopSearchInput").val().trim()}".`,
      );
    } else {
      $("#shopSearchStatus").text("");
    }
  }

  $("#shopSearchForm").on("submit", function (event) {
    event.preventDefault();
    applyShopSearch();
  });

  $("#shopSearchInput").on("input search", function () {
    clearTimeout(shopSearchTimer);

    shopSearchTimer = setTimeout(function () {
      applyShopSearch();
    }, 300);
  });

  $("#clearShopSearch").on("click", function () {
    $("#shopSearchInput").val("");
    activeSearch = "";
    currentPage = 1;
    $("#shopSearchStatus").text("");
    renderProducts();
  });

  $("#applyPriceFilter").on("click", function () {
    activeMinPrice = $("#minPriceFilter").val();
    activeMaxPrice = $("#maxPriceFilter").val();
    currentPage = 1;
    renderProducts();
  });

  $(document).on("click", ".shop-page-link", function (event) {
    event.preventDefault();

    const $pageItem = $(this).closest(".page-item");
    if ($pageItem.hasClass("disabled") || $pageItem.hasClass("active")) return;

    currentPage = Number($(this).data("page")) || 1;
    renderProducts();
    window.scrollTo({
      top: $("#shop-products-container").offset().top - 120,
      behavior: "smooth",
    });
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
}

$(document).ready(function () {
  loadUser();
  loadCartCount();
  loadFiltersFromUrl();
  setupEvents();
  loadCategories();
  loadBrands();
  loadProducts();

  /* -----------------------------
     LOAD NAVBAR PROFILE IMAGE
  ----------------------------- */
  if (usr && token) {
    $.ajax({
      url: `${ip}/api/getAccount_username/${usr}`,
      type: "GET",
      headers: getApiHeaders(),
      success: (response) => {
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
      error: (xhr) => {
        console.error("Error loading profile:", xhr.responseText);
        $("#navbarProfileImage").hide();
        $("#defaultProfileIcon").show();
      },
    });
  } else {
    console.warn("No username found in cookie.");
  }

  /* -----------------------------
     SLIDER INITIALIZATION
  ----------------------------- */
  $(".slider").bxSlider({ auto: true });

  /* -----------------------------
     GLOBAL AJAX LOADING INDICATOR
  ----------------------------- */
  $(document)
    .ajaxStart(() => $("#wait").show())
    .ajaxComplete(() => $("#wait").hide());
});
