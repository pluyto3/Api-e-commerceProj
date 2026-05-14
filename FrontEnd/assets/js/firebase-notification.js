// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

// console.log("firebase-notification.js loaded");
// console.log("Current token cookie:", $.cookie("token"));
// console.log("Current role cookie:", $.cookie("role"));
// console.log("Notification permission:", Notification.permission);

const firebaseConfig = {
  apiKey: "AIzaSyBg_xIbb74aWye2s0cKF8SfyIBFYBZjy94",
  authDomain: "e-commerce-45367.firebaseapp.com",
  projectId: "e-commerce-45367",
  storageBucket: "e-commerce-45367.firebasestorage.app",
  messagingSenderId: "100656810885",
  appId: "1:100656810885:web:0ae522bd849f6d850352ec",
  measurementId: "G-97XLJS4249",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

const VAPID_KEY =
  "BDByxdeTWtp6S2bSfmSMLT7C85pxreyEw9zHc3l-oNbAH3e2J-_mRM8blQGlOdD5H2MqZ5GXqF1e60qzELv97ic";

// Request permission and get FCM token
async function initFirebaseNotification() {
  try {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications.");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      console.log("This browser does not support service workers.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.log("Notification permission denied.");
      return;
    }

    const registration = await navigator.serviceWorker.register(
      "./firebase-messaging-sw.js",
      { scope: "./" },
    );

    console.log("Service worker registered:", registration);

    // Wait until the service worker is active
    const activeRegistration = await navigator.serviceWorker.ready;

    console.log("Service worker is active:", activeRegistration);

    const currentToken = await messaging.getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: activeRegistration,
    });

    if (currentToken) {
      console.log("FCM Token:", currentToken);
      localStorage.setItem("fcm_token", currentToken);
      saveFcmTokenToServer(currentToken);
    } else {
      console.log("No FCM token received.");
    }
  } catch (error) {
    console.error("FCM setup error:", error);
  }
}

// Utility function to get browser name from user agent
function getBrowserName() {
  const userAgent = navigator.userAgent;

  if (userAgent.includes("Edg")) return "Microsoft Edge";
  if (userAgent.includes("Chrome")) return "Google Chrome";
  if (userAgent.includes("Firefox")) return "Mozilla Firefox";
  if (userAgent.includes("Safari")) return "Safari";

  return "Unknown Browser";
}

// Save the FCM token to the server for later use (e.g., sending notifications)
function saveFcmTokenToServer(fcmToken) {
  localStorage.setItem("fcm_token", fcmToken);

  $.ajax({
    url: "http://localhost:8000/api/fcm-token",
    method: "POST",
    data: {
      token: fcmToken,
      platform: "web",
      browser_name: getBrowserName(),
      device_name: navigator.platform,
      user_agent: navigator.userAgent,
    },
    headers: {
      Accept: "application/json",
      Authorization: "Bearer " + $.cookie("token"),
    },
    success: function (response) {
      console.log("FCM token saved:", response);
    },
    error: function (xhr) {
      console.error("Failed to save FCM token:", xhr.responseText);
    },
  });
}

// Call this function when user logs out to remove token from server and local storage
window.removeFcmTokenFromServer = function (callback) {
  const fcmToken = localStorage.getItem("fcm_token");

  if (!fcmToken) {
    if (callback) callback();
    return;
  }

  $.ajax({
    url: "http://localhost:8000/api/fcm-token",
    method: "DELETE",
    data: {
      token: fcmToken,
    },
    headers: {
      Accept: "application/json",
      Authorization: "Bearer " + $.cookie("token"),
    },
    complete: function () {
      localStorage.removeItem("fcm_token");

      if (callback) callback();
    },
  });
};

// Handle incoming messages when the web page is in the foreground
messaging.onMessage(function (payload) {
  console.log("Foreground notification:", payload);

  Swal.fire({
    icon: "info",
    title: payload.notification?.title || "New Notification",
    text: payload.notification?.body || "",
    timer: 4000,
    showConfirmButton: false,
  });
});

$(document).ready(function () {
  if ($.cookie("token")) {
    initFirebaseNotification();
  }
});
