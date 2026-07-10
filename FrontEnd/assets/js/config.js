(function () {
  const hostname = window.location.hostname;

  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "" ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

  window.APP_CONFIG = Object.freeze({
    ENVIRONMENT: isLocal ? "local" : "production",

    API_BASE_URL: isLocal
      ? "http://127.0.0.1:8000"
      : "http://api.hanzgo.me",

    FRONTEND_URL: isLocal
      ? "http://localhost/e-commerce/FrontEnd"
      : "http://hanzgo.me",

    BACKEND_PUBLIC_URL: isLocal
      ? "http://127.0.0.1:8000"
      : "http://api.hanzgo.me",
  });

  console.log("Hostname:", hostname);
  console.log("Environment:", window.APP_CONFIG.ENVIRONMENT);
  console.log("API URL:", window.APP_CONFIG.API_BASE_URL);
})();
