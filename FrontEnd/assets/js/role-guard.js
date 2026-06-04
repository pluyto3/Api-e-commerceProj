(function () {
  const page = window.location.pathname.split("/").pop();

  const username = $.cookie("username");
  const token = $.cookie("token");
  const role = String($.cookie("role") || "")
    .toLowerCase()
    .trim();

  const pageAccess = {
    "dashboard.html": ["admin", "seller"],
    "brand.html": ["admin", "seller"],
    "category.html": ["admin", "seller"],
    "product.html": ["admin", "seller"],
    "manageAccounts.html": ["admin"],
  };

  if (!pageAccess[page]) return;

  if (!username || !token) {
    window.location.replace("login.html");
    return;
  }

  if (!pageAccess[page].includes(role)) {
    sessionStorage.setItem("accessDenied", "true");
    window.location.replace("index.html");
    return;
  }
})();
