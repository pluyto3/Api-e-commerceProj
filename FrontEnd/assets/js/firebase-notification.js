// firebase-notification.js

(function () {
  if (window.APP_CONFIG?.ENVIRONMENT === "local") {
    console.log("Firebase notifications disabled during local UI development.");
    return;
  }

  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    console.warn("Firebase notifications are not supported by this browser.");
    return;
  }

  if (!window.APP_CONFIG?.API_BASE_URL) {
    console.error(
      "APP_CONFIG is missing. Load config.js before firebase-notification.js.",
    );
    return;
  }

  const FCM_TOKEN_API = `${window.APP_CONFIG.API_BASE_URL}/api/fcm-token`;

  const firebaseConfig = {
    apiKey: "AIzaSyBg_xIbb74aWye2s0cKF8SfyIBFYBZjy94",
    authDomain: "e-commerce-45367.firebaseapp.com",
    projectId: "e-commerce-45367",
    storageBucket: "e-commerce-45367.firebasestorage.app",
    messagingSenderId: "100656810885",
    appId: "1:100656810885:web:0ae522bd849f6d850352ec",
    measurementId: "G-97XLJS4249",
  };

  const VAPID_KEY =
    "BDByxdeTWtp6S2bSfmSMLT7C85pxreyEw9zHc3l-oNbAH3e2J-_mRM8blQGlOdD5H2MqZ5GXqF1e60qzELv97ic";

  // Prevent Firebase from being initialized more than once.
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const messaging = firebase.messaging();

  let unauthorizedHandled = false;

  function getAuthToken() {
    const storedToken = $.cookie("token");

    if (!storedToken) {
      return null;
    }

    return String(storedToken)
      .replace(/^Bearer\s+/i, "")
      .trim();
  }

  function getAuthHeaders() {
    const authToken = getAuthToken();

    return {
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`,
    };
  }

  function clearFcmLocalStorage() {
    localStorage.removeItem("fcm_token");
    localStorage.removeItem("saved_fcm_token");
    localStorage.removeItem("saved_fcm_auth_token");
    localStorage.removeItem("saved_fcm_token_at");
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

  function handleUnauthorized(xhr) {
    if (unauthorizedHandled) {
      return false;
    }

    const message = (
      xhr.responseJSON?.msg ||
      xhr.responseJSON?.message ||
      ""
    ).toLowerCase();

    const invalidToken =
      (xhr.status === 400 || xhr.status === 401) &&
      message.includes("invalid token");

    if (!invalidToken) {
      return false;
    }

    unauthorizedHandled = true;

    clearFcmLocalStorage();
    clearAuthenticationCookies();

    Swal.fire({
      icon: "warning",
      title: "Session Expired",
      text: "Your login session is invalid. Please log in again.",
    }).then(() => {
      window.location.replace("login.html");
    });

    return true;
  }

  async function initFirebaseNotification() {
    try {
      const authToken = getAuthToken();

      if (!authToken) {
        console.log(
          "Firebase notification setup skipped: user is not logged in.",
        );
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        console.log("Notification permission was not granted.");
        return;
      }

      const registration = await navigator.serviceWorker.register(
        "./firebase-messaging-sw.js",
        {
          scope: "./",
        },
      );

      console.log("Service worker registered:", registration);

      const activeRegistration = await navigator.serviceWorker.ready;

      console.log("Service worker is active:", activeRegistration);

      const currentToken = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: activeRegistration,
      });

      if (!currentToken) {
        console.log("No FCM token was received.");
        return;
      }

      console.log("FCM token received.");

      localStorage.setItem("fcm_token", currentToken);

      saveFcmTokenToServer(currentToken);
    } catch (error) {
      console.error("FCM setup error:", error);
    }
  }

  function getBrowserName() {
    const userAgent = navigator.userAgent;

    if (userAgent.includes("Edg")) {
      return "Microsoft Edge";
    }

    if (userAgent.includes("Chrome")) {
      return "Google Chrome";
    }

    if (userAgent.includes("Firefox")) {
      return "Mozilla Firefox";
    }

    if (userAgent.includes("Safari")) {
      return "Safari";
    }

    return "Unknown Browser";
  }

  function saveFcmTokenToServer(fcmToken) {
    const authToken = getAuthToken();

    if (!authToken) {
      console.warn(
        "FCM token was not saved because no authentication token exists.",
      );
      return;
    }

    localStorage.setItem("fcm_token", fcmToken);

    $.ajax({
      url: FCM_TOKEN_API,
      method: "POST",

      data: {
        token: fcmToken,
        platform: "web",
        browser_name: getBrowserName(),
        device_name:
          navigator.userAgentData?.platform || navigator.platform || "Unknown",
        user_agent: navigator.userAgent,
      },

      headers: getAuthHeaders(),

      success: function (response) {
        console.log("FCM token confirmed on server:", response);
      },

      error: function (xhr) {
        console.error(
          "Failed to save FCM token:",
          xhr.status,
          xhr.responseText,
        );

        handleUnauthorized(xhr);
      },
    });
  }

  window.removeFcmTokenFromServer = function (callback) {
    const fcmToken = localStorage.getItem("fcm_token");

    const authToken = getAuthToken();

    if (!fcmToken || !authToken) {
      clearFcmLocalStorage();

      if (typeof callback === "function") {
        callback();
      }

      return;
    }

    $.ajax({
      url: FCM_TOKEN_API,
      method: "DELETE",

      data: {
        token: fcmToken,
      },

      headers: getAuthHeaders(),

      error: function (xhr) {
        console.error(
          "Failed to remove FCM token:",
          xhr.status,
          xhr.responseText,
        );

        // Continue logout even when the server rejects
        // an old authentication token.
      },

      complete: function () {
        clearFcmLocalStorage();

        if (typeof callback === "function") {
          callback();
        }
      },
    });
  };

  messaging.onMessage(function (payload) {
    console.log("Foreground notification:", payload);

    const title =
      payload.notification?.title ||
      payload.data?.title ||
      "Hanz-Go Notification";

    const body =
      payload.notification?.body ||
      payload.data?.body ||
      payload.data?.message ||
      "You have a new notification.";

    const rawUrl =
      payload.data?.url || payload.fcmOptions?.link || "brand.html";

    const targetUrl = rawUrl.startsWith("http")
      ? rawUrl
      : `${window.location.origin}/${rawUrl.replace(/^\/+/, "")}`;

    if (Notification.permission === "granted") {
      const browserNotification = new Notification(title, {
        body: body,
        icon: "/assets/img/hanz-goLogo.png",
        badge: "/assets/img/hanz-goLogo.png",
        data: {
          url: targetUrl,
        },
      });

      browserNotification.onclick = function () {
        window.focus();
        window.location.href = targetUrl;
        browserNotification.close();
      };
    }

    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: "info",
        title: title,
        text: body,
        timer: 4000,
        showConfirmButton: false,
      });
    }

    if (typeof window.reloadAppNotificationBell === "function") {
      window.reloadAppNotificationBell();
    }
  });

  $(document).ready(function () {
    if (getAuthToken()) {
      console.log("FCM API:", FCM_TOKEN_API);
      initFirebaseNotification();
    }
  });
})();
