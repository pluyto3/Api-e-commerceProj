importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyBg_xIbb74aWye2s0cKF8SfyIBFYBZjy94",
  authDomain: "e-commerce-45367.firebaseapp.com",
  projectId: "e-commerce-45367",
  storageBucket: "e-commerce-45367.firebasestorage.app",
  messagingSenderId: "100656810885",
  appId: "1:100656810885:web:0ae522bd849f6d850352ec",
  measurementId: "G-97XLJS4249",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log("Background notification received:", payload);

  const notificationTitle =
    payload.notification?.title ||
    payload.data?.title ||
    "Hanz-Go Notification";

  const notificationOptions = {
    body:
      payload.notification?.body ||
      payload.data?.body ||
      payload.data?.message ||
      "You have a new notification.",
    icon: "/assets/img/hanz-goLogo.png",
    badge: "/assets/img/hanz-goLogo.png",
    data: {
      url: payload.data?.url || "/brand.html",
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification.data?.url || "/brand.html";

  event.waitUntil(clients.openWindow(url));
});
