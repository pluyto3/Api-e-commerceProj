(function ($) {
  function showOnly(selectors) {
    const knownSidebarItems = [
      "#dashboard",
      "#account",
      "#address",
      "#sidebarAccounts",
      "#sidebarSupportInbox",
      "#brand",
      "#category",
      "#product",
      "#orders",
    ].join(",");

    $(knownSidebarItems).hide();

    selectors.forEach(function (selector) {
      $(selector).show();
    });
  }

  // =======================================
  // Sidebar Visibility by Role
  // =======================================
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
        "#sidebarSupportInbox",
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
        "#product",
        "#orders",
      ]);
      return;
    }

    // Customer
    showOnly(["#account", "#address", "#orders"]);
  };

  // =======================================
  // Highlight Current Sidebar Page
  // =======================================
  window.highlightCurrentSidebarItem = function () {
    const currentPage =
      window.location.pathname.split("/").pop() || "dashboard.html";

    const currentHash = window.location.hash;

    $(".sidebar .nav-bar a").each(function () {
      const $link = $(this);
      const href = String($link.attr("href") || "");

      if (!href || href === "#") {
        $link.removeClass("active");
        $link.parent().removeClass("active");
        return;
      }

      const linkUrl = new URL(href, window.location.href);
      const linkPage = linkUrl.pathname.split("/").pop() || currentPage;
      const linkHash = linkUrl.hash;

      let isActive = false;

      // Support Inbox is inside dashboard.html
      if (
        currentPage === "dashboard.html" &&
        currentHash === "#supportInboxSection"
      ) {
        isActive =
          linkPage === "dashboard.html" && linkHash === "#supportInboxSection";
      } else {
        // Normal page
        isActive = linkPage === currentPage && !linkHash;
      }

      $link.toggleClass("active", isActive);
      $link.parent().toggleClass("active", isActive);
    });
  };

  // =======================================
  // Initialize Sidebar
  // =======================================
  $(document).ready(function () {
    window.applySidebarRoleVisibility();
    window.highlightCurrentSidebarItem();
  });

  $(window).on("load", function () {
    setTimeout(function () {
      window.applySidebarRoleVisibility();
      window.highlightCurrentSidebarItem();
    }, 0);
  });

  // Update active item whenever URL hash changes
  $(window).on("hashchange.sidebarActive", function () {
    window.highlightCurrentSidebarItem();
  });
})(jQuery);
