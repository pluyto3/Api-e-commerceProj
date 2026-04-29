(function ($) {
  function showOnly(selectors) {
    const knownSidebarItems = [
      "#dashboard",
      "#account",
      "#address",
      "#sidebarAccounts",
      "#brand",
      "#category",
      "#product",
      "#orders",
    ].join(",");

    $(knownSidebarItems).hide();
    selectors.forEach((selector) => $(selector).show());
  }

  window.applySidebarRoleVisibility = function () {
    const token = $.cookie("token");
    const role = String($.cookie("role") || "").toLowerCase();

    if (!token) {
      showOnly([]);
      return;
    }

    if (role === "admin") {
      showOnly([
        "#dashboard",
        "#account",
        "#sidebarAccounts",
        "#brand",
        "#category",
        "#product",
        "#orders",
      ]);
      return;
    }

    if (role === "seller") {
      showOnly([
        "#dashboard",
        "#account",
        "#address",
        "#brand",
        "#category",
        "#product",
        "#orders",
      ]);
      return;
    }

    showOnly(["#account", "#address", "#orders"]);
  };

  $(document).ready(window.applySidebarRoleVisibility);
  $(window).on("load", function () {
    setTimeout(window.applySidebarRoleVisibility, 0);
  });
})(jQuery);
