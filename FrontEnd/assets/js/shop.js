/* ================================
   GLOBAL VARIABLES
================================ */
const ip = "http://localhost:8000";
let token = null;
let usr = null;
let role = null;
let profileImage = null;
const apiBaseUrl = getApiBaseUrl();
let allCategories = [];
let allProducts = [];
const productsPerPage = 20;
let currentPage = 1;
let activeCategory = { id: "all", name: "all" };
let activeSort = "relevance";
let activeSearch = "";

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

  return "http://localhost/e-commerce/BackEnd/public";
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

  $list.append(createCategoryItem("all", "All Categories", true));

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
    $list.append(createCategoryItem(category.id, category.name, false));
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

function loadCategories() {
  return $.ajax({
    url: `${apiBaseUrl}/api/category`,
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

function loadProducts() {
  return $.ajax({
    url: `${apiBaseUrl}/api/products`,
    method: "GET",
    headers: getApiHeaders(),
    success: function (response) {
      allProducts = getResponseList(response);
      renderCategories(allCategories);
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

  return allProducts.filter((product) => {
    const productStatus = normalizeStatus(
      product.approval_status || product.status,
    );

    if (productStatus !== "approved") return false;

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

    if (activeSearch) {
      const searchableText = normalizeText(
        [
          getProductName(product),
          getProductCategoryName(product),
          product.brand,
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

  $(".shop-sort-btn").on("click", function () {
    activeSort = String($(this).data("sort") || "relevance");
    currentPage = 1;

    $(".shop-sort-btn").removeClass("active");
    $(this).addClass("active");
    renderProducts();
  });

  $(".search-form").on("submit", function (event) {
    event.preventDefault();
    activeSearch = normalizeText($("#searchInput").val());
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

  $("#logout").on("click", function (event) {
    event.preventDefault();

    $.ajax({
      url: `${apiBaseUrl}/api/logout`,
      type: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      data: { token },
      complete: function () {
        Object.keys($.cookie()).forEach((cookie) => $.removeCookie(cookie));
        window.location.replace("login.html");
      },
    });
  });
}

$(document).ready(function () {
  loadUser();
  setupEvents();
  loadCategories();
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
