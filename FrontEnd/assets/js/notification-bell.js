(function () {
  if (window.__appNotificationBellLoaded) {
    return;
  }

  window.__appNotificationBellLoaded = true;

  if (window.APP_CONFIG?.ENVIRONMENT === "local") {
    console.log("Notification bell API disabled during local UI development.");

    $("#notificationNav").hide();
    return;
  }

  if (!window.APP_CONFIG || !window.APP_CONFIG.API_BASE_URL) {
    console.error(
      "APP_CONFIG is unavailable. Make sure config.js is loaded before notification-bell.js.",
    );
    return;
  }

  const NOTIFICATION_API = `${window.APP_CONFIG.API_BASE_URL}/api/notifications`;

  let notificationRequestRunning = false;
  let notificationIntervalStarted = false;
  let authenticationErrorHandled = false;

  function getAuthToken() {
    const storedToken = $.cookie("token");

    if (!storedToken) {
      return null;
    }

    return String(storedToken)
      .replace(/^Bearer\s+/i, "")
      .trim();
  }

  function notificationHeaders() {
    const token = getAuthToken();

    return {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  function clearAuthenticationCookies() {
    const cookieNames = [
      "token",
      "username",
      "role",
      "user_id",
      "profileImage",
    ];

    cookieNames.forEach(function (name) {
      $.removeCookie(name);
      $.removeCookie(name, { path: "/" });
    });
  }

  function handleAuthenticationError(xhr) {
    if (xhr.status !== 401) {
      return false;
    }

    if (authenticationErrorHandled) {
      return true;
    }

    authenticationErrorHandled = true;

    console.error(
      "Authentication token rejected by:",
      window.APP_CONFIG.API_BASE_URL,
    );

    clearAuthenticationCookies();

    $("#notificationNav").hide();
    updateNotificationBadge(0);

    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: "warning",
        title: "Session Expired",
        text: "Your login session is invalid. Please log in again.",
        confirmButtonText: "Go to Login",
        allowOutsideClick: false,
        allowEscapeKey: false,
      }).then(function () {
        window.location.replace("login.html");
      });
    } else {
      window.location.replace("login.html");
    }

    return true;
  }

  function escapeHtml(value) {
    if (!value) {
      return "";
    }

    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNotificationDate(dateValue) {
    if (!dateValue) {
      return "";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleString();
  }

  function updateNotificationBadge(count) {
    const unreadCount = Number(count) || 0;
    const $notificationBadges = $(
      "#appNotificationBellCount, #notification-count",
    );

    if (unreadCount > 0) {
      $notificationBadges.text(unreadCount).show();
    } else {
      $notificationBadges.text("").hide();
    }
  }

  function renderNotificationBell(notifications) {
    const list = $("#appNotificationBellList, #notificationList").first();

    list.empty();

    if (!Array.isArray(notifications) || notifications.length === 0) {
      list.append(`
        <div class="notification-empty-state">
          No notifications yet.
        </div>
      `);

      return;
    }

    notifications.forEach(function (notification) {
      const isUnread = !notification.read_at;
      const url = notification.url || "";
      const title = escapeHtml(notification.title || "Notification");
      const message = escapeHtml(notification.message || "");
      const createdAt = escapeHtml(
        formatNotificationDate(notification.created_at),
      );

      list.append(`
        <a
          href="#"
          class="dropdown-item notification-item ${isUnread ? "unread" : ""}"
          data-id="${escapeHtml(notification.id)}"
          data-url="${escapeHtml(url)}">
          <div class="notification-title">${title}</div>
          <div class="notification-message">${message}</div>
          <div class="notification-time">${createdAt}</div>
        </a>
      `);
    });
  }

  function loadNotifications() {
    const token = getAuthToken();

    if (!token) {
      $("#notificationNav").hide();
      updateNotificationBadge(0);
      return;
    }

    if (notificationRequestRunning || authenticationErrorHandled) {
      return;
    }

    notificationRequestRunning = true;
    $("#notificationNav").show();

    $.ajax({
      url: NOTIFICATION_API,
      method: "GET",
      headers: notificationHeaders(),

      success: function (response) {
        const notifications = Array.isArray(response.notifications)
          ? response.notifications
          : [];

        const unreadCount = Number(response.unread_count) || 0;

        console.log("Notification API:", NOTIFICATION_API);
        console.log("Current role:", $.cookie("role"));
        console.log("Notification response:", response);

        updateNotificationBadge(unreadCount);
        renderNotificationBell(notifications);
      },

      error: function (xhr) {
        console.error(
          "Failed to load notifications:",
          xhr.status,
          xhr.responseText,
        );

        if (handleAuthenticationError(xhr)) {
          return;
        }
      },

      complete: function () {
        notificationRequestRunning = false;
      },
    });
  }

  function markNotificationAsRead(notificationId, url) {
    const token = getAuthToken();

    if (!token || !notificationId) {
      return;
    }

    $.ajax({
      url: `${NOTIFICATION_API}/${encodeURIComponent(notificationId)}/read`,
      method: "POST",
      headers: notificationHeaders(),

      success: function () {
        loadNotifications();

        if (url) {
          window.location.href = url;
        }
      },

      error: function (xhr) {
        console.error(
          "Failed to mark notification as read:",
          xhr.status,
          xhr.responseText,
        );

        if (handleAuthenticationError(xhr)) {
          return;
        }

        if (url) {
          window.location.href = url;
        }
      },
    });
  }

  function markAllNotificationsAsRead() {
    const token = getAuthToken();

    if (!token) {
      return;
    }

    $.ajax({
      url: `${NOTIFICATION_API}/read-all`,
      method: "POST",
      headers: notificationHeaders(),

      success: function () {
        loadNotifications();
      },

      error: function (xhr) {
        console.error(
          "Failed to mark all notifications as read:",
          xhr.status,
          xhr.responseText,
        );

        handleAuthenticationError(xhr);
      },
    });
  }

  $(document).ready(function () {
    $("#appNotificationBellCount, #notification-count").hide().text("");

    if (!getAuthToken()) {
      $("#notificationNav").hide();
      return;
    }

    loadNotifications();

    if (!notificationIntervalStarted) {
      notificationIntervalStarted = true;

      window.setInterval(function () {
        if (!authenticationErrorHandled) {
          loadNotifications();
        }
      }, 60000);
    }

    $(document)
      .off("click.notificationBell", ".notification-item")
      .on("click.notificationBell", ".notification-item", function (event) {
        event.preventDefault();

        const notificationId = $(this).data("id");
        const url = $(this).attr("data-url") || "";

        markNotificationAsRead(notificationId, url);
      });

    $(document)
      .off("click.notificationReadAll", "#markAllNotificationsRead")
      .on(
        "click.notificationReadAll",
        "#markAllNotificationsRead",
        function (event) {
          event.preventDefault();
          markAllNotificationsAsRead();
        },
      );
  });

  window.reloadAppNotificationBell = function () {
    loadNotifications();
  };
})();
