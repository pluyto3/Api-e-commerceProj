const NOTIFICATION_API = "http://localhost:8000/api/notifications";

function notificationHeaders() {
  return {
    Accept: "application/json",
    Authorization: "Bearer " + $.cookie("token"),
  };
}

function escapeHtml(value) {
  if (!value) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNotificationDate(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleString();
}

function updateNotificationBadge(count) {
  console.trace("Notification bell count updated to:", count);

  const badge = $("#notificationBellCount");

  count = Number(count) || 0;

  if (count > 0) {
    badge.text(count);
    badge.show();
  } else {
    badge.text("");
    badge.hide();
  }
}

function loadNotifications() {
  const token = $.cookie("token");

  if (!token) {
    $("#notificationNav").hide();
    return;
  }

  $("#notificationNav").show();

  $.ajax({
    url: NOTIFICATION_API,
    method: "GET",
    headers: notificationHeaders(),
    success: function (response) {
      const notifications = response.notifications || [];
      const unreadCount = response.unread_count || 0;

      updateNotificationBadge(unreadCount);
      renderNotificationBell(notifications);
    },
    error: function (xhr) {
      console.error("Failed to load notifications:", xhr.responseText);
    },
  });
}

function normalizeNotificationList(notifications) {
  if (Array.isArray(notifications)) {
    return notifications;
  }

  if (Array.isArray(notifications?.notifications)) {
    return notifications.notifications;
  }

  return [];
}

function renderNotificationBell(notifications) {
  notifications = normalizeNotificationList(notifications);

  const list = $("#notificationBellList");
  list.empty();

  if (!notifications.length) {
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
        data-id="${notification.id}"
        data-url="${escapeHtml(url)}">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
        <div class="notification-time">${createdAt}</div>
      </a>
    `);
  });
}

function markNotificationAsRead(notificationId, url) {
  $.ajax({
    url: `${NOTIFICATION_API}/${notificationId}/read`,
    method: "POST",
    headers: notificationHeaders(),
    success: function () {
      loadNotifications();

      if (url) {
        window.location.href = url;
      }
    },
    error: function (xhr) {
      console.error("Failed to mark notification as read:", xhr.responseText);

      if (url) {
        window.location.href = url;
      }
    },
  });
}

function markAllNotificationsAsRead() {
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
        xhr.responseText,
      );
    },
  });
}

$(document).ready(function () {
  if (!$.cookie("token")) {
    $("#notificationNav").hide();
    return;
  }

  loadNotifications();

  setInterval(loadNotifications, 30000);

  $(document).on("click", ".notification-item", function (e) {
    e.preventDefault();

    const notificationId = $(this).data("id");
    const url = $(this).attr("data-url") || "";

    markNotificationAsRead(notificationId, url);
  });

  $(document).on("click", "#markAllNotificationsRead", function (e) {
    e.preventDefault();
    markAllNotificationsAsRead();
  });
});

window.reloadNotificationBell = function () {
  loadNotifications();
};
