// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
      saveFcmTokenToServer(currentToken);
    } else {
      console.log("No FCM token received.");
    }
  } catch (error) {
    console.error("FCM setup error:", error);
  }
}

function saveFcmTokenToServer(fcmToken) {
  $.ajax({
    url: "http://localhost:8000/api/fcm-token",
    method: "POST",
    data: {
      token: fcmToken,
      platform: "web",
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
