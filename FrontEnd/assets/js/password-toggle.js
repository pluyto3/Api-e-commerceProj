document.addEventListener("click", function (event) {
  const button = event.target.closest(".password-toggle");

  if (!button) return;

  const input = document.getElementById(button.dataset.target);

  if (!input) return;

  const showingPassword = input.type === "password";

  input.type = showingPassword ? "text" : "password";

  button.setAttribute(
    "aria-label",
    showingPassword ? "Hide password" : "Show password",
  );

  button.setAttribute(
    "title",
    showingPassword ? "Hide password" : "Show password",
  );

  button.setAttribute("aria-pressed", String(showingPassword));

  const icon = button.querySelector("i");

  if (icon) {
    icon.className = showingPassword ? "far fa-eye-slash" : "far fa-eye";
  }
});
