// Runs the real account.js handlers with DOM/AJAX mocks: no browser, API or database.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

function page() {
  const elements = new Map();
  const requests = [];
  const alerts = [];
  let ready;
  let reloads = 0;
  const input = {
    files: [],
    validityMessage: "",
    reports: 0,
    setCustomValidity(message) { this.validityMessage = message; },
    reportValidity() { this.reports++; },
  };
  function $(selector) {
    if (!elements.has(selector)) {
      const element = {
        0: selector === "#image" ? input : {},
        handlers: {},
        properties: {},
        attributes: { src: "saved-profile.png" },
        textValue: "",
        ready(callback) { ready = callback; return this; },
        on(event, ...args) { this.handlers[event] = args.at(-1); return this; },
        click() { return this; },
        submit() { return this; },
        ajaxStart() { return this; },
        ajaxComplete() { return this; },
        prop(key, value) {
          if (arguments.length === 1) return this.properties[key];
          this.properties[key] = value;
          return this;
        },
        text(value) { this.textValue = value; return this; },
        attr(key, value) {
          if (arguments.length === 1) return this.attributes[key];
          this.attributes[key] = value;
          return this;
        },
        val(value) {
          if (arguments.length) { this.value = value; return this; }
          return this.value ?? "101";
        },
      };
      elements.set(selector, element);
    }
    return elements.get(selector);
  }
  $.ajax = (request) => requests.push(request);
  const context = vm.createContext({
    window: { APP_CONFIG: { API_BASE_URL: "http://127.0.0.1:8000" }, location: { reload() { reloads++; } } },
    document: {},
    $,
    console,
    FormData: class { constructor(form) { this.form = form; } },
    Swal: { fire(options) { alerts.push(options); return { then(fn) { fn(); } }; } },
    location: { reload() { reloads++; } },
  });
  vm.runInContext(readFileSync(join(__dirname, "../assets/js/account.js"), "utf8"), context);
  // Disable unrelated page loading; test only the real upload event handlers.
  vm.runInContext("load_user = () => {}; displayAddresses = () => {}; setupSidebarToggle = () => {};", context);
  ready();
  return {
    $, input, requests, alerts,
    get reloads() { return reloads; },
    choose(file) {
      input.files = file ? [file] : [];
      $("#image").handlers.change.call(input);
    },
    submit() { $("#account-form").handlers.submit.call({}, { preventDefault() {} }); },
  };
}

const image = (name, type, size = 100) => ({ name, type, size });

test("unsupported, empty and oversized selections never submit or replace the saved picture", () => {
  for (const file of [
    image("fixture.txt", "text/plain"),
    image("fixture.svg", "image/svg+xml"),
    image("fixture.png", "text/plain"),
    image("fixture.jpg.txt", "image/jpeg"),
    image("constructor", ""),
    image("fixture.png", "image/png", 0),
    image("fixture.webp", "image/webp", 10 * 1024 * 1024 + 1),
  ]) {
    const ui = page();
    ui.choose(file);
    ui.submit();
    assert.ok(ui.input.validityMessage);
    assert.equal(ui.input.reports, 1);
    assert.equal(ui.requests.length, 0);
    assert.equal(ui.reloads, 0);
    assert.equal(ui.$("#editProfilePic").properties.disabled, undefined);
    assert.equal(ui.$("#profileImg").attributes.src, "saved-profile.png");
    assert.equal(ui.$("#navbarProfileImage").attributes.src, "saved-profile.png");
  }
});

test("empty selection is blocked without constructing an upload", () => {
  const ui = page();
  ui.submit();
  assert.match(ui.input.validityMessage, /select a file/i);
  assert.equal(ui.requests.length, 0);
});

test("supported formats, uppercase extension and unavailable browser MIME can submit", () => {
  for (const file of [
    image("fixture.jpg", "image/jpeg"), image("fixture.jpeg", "image/jpeg"),
    image("fixture.png", "image/png"), image("fixture.gif", "image/gif"),
    image("fixture.WEBP", "image/webp", 10 * 1024 * 1024),
    image("fixture.png", ""),
  ]) {
    const ui = page();
    ui.choose(file);
    ui.submit();
    assert.equal(ui.input.validityMessage, "");
    assert.equal(ui.requests.length, 1);
    const request = ui.requests[0];
    assert.equal(request.url, "http://127.0.0.1:8000/api/updateImageAccount/101");
    assert.equal(request.method, "POST");
    assert.equal(request.processData, false);
    assert.equal(request.contentType, false);
    assert.equal(ui.$("#editProfilePic").properties.disabled, true);
    request.complete();
    assert.equal(ui.$("#editProfilePic").properties.disabled, false);
    assert.equal(ui.$("#editProfilePic").textValue, "Upload Profile Picture");
  }
});

test("correcting an invalid choice clears validation and permits submission", () => {
  const ui = page();
  ui.choose(image("fixture.txt", "text/plain"));
  ui.choose(image("fixture.webp", "image/webp"));
  ui.submit();
  assert.equal(ui.input.validityMessage, "");
  assert.equal(ui.$("#imageError").textValue, "");
  assert.equal(ui.requests.length, 1);
});

test("API field errors are shown without a success message or saved-picture reload", () => {
  const ui = page();
  ui.choose(image("fixture.png", "image/png"));
  ui.submit();
  ui.requests[0].error({ status: 422, responseJSON: {
    msg: "Please check the selected profile picture.",
    errors: { image: ["Invalid image content."] },
  } });
  ui.requests[0].complete();
  assert.equal(ui.$("#imageError").textValue, "Invalid image content.");
  assert.equal(ui.alerts[0].icon, "error");
  assert.equal(ui.alerts[0].text, "Invalid image content.");
  assert.equal(ui.reloads, 0);
  assert.equal(ui.$("#profileImg").attributes.src, "saved-profile.png");
  assert.equal(ui.$("#navbarProfileImage").attributes.src, "saved-profile.png");
  assert.equal(ui.$("#editProfilePic").properties.disabled, false);
});

test("network/server errors retain the saved picture and restore the button", () => {
  const ui = page();
  ui.choose(image("fixture.jpg", "image/jpeg"));
  ui.submit();
  ui.requests[0].error({ status: 500 });
  ui.requests[0].complete();
  assert.equal(ui.alerts[0].text, "Unable to upload your profile picture.");
  assert.equal(ui.reloads, 0);
  assert.equal(ui.$("#profileImg").attributes.src, "saved-profile.png");
  assert.equal(ui.$("#editProfilePic").properties.disabled, false);
});

test("successful upload preserves Profile Saved and reload behavior", () => {
  const ui = page();
  ui.choose(image("fixture.webp", "image/webp"));
  ui.submit();
  ui.requests[0].success({ status: 200 });
  ui.requests[0].complete();
  assert.equal(ui.alerts[0].title, "Profile Saved");
  assert.equal(ui.reloads, 1);
});

// These exercise real account handlers with UI/network doubles, without HTTP.
function accountPage(password = "", confirmation = password, current = "") {
  const ui = page();
  for (const [selector, value] of Object.entries({
    "#username": "synthetic-user", "#phone_number": "synthetic-phone",
    "#fullname": "Synthetic Account", "#password": password,
    "#password_confirmation": confirmation, "#current_password": current,
  })) ui.$(selector).val(value);
  ui.saveAccount = () => ui.$("#signupForm").handlers.submit({ preventDefault() {} });
  return ui;
}

test("ordinary profile edits omit password and current-password values", () => {
  const ui = accountPage("", "", "unused-synthetic-value");
  ui.saveAccount();
  assert.equal(ui.requests.length, 1);
  const data = JSON.parse(ui.requests[0].data);
  assert.equal(data.fullname, "Synthetic Account");
  assert.equal(Object.hasOwn(data, "password"), false);
  assert.equal(Object.hasOwn(data, "current_password"), false);
});

test("password edits require current password and retain length/confirmation checks", () => {
  for (const [password, confirmation, current, error] of [
    ["synthetic-new-password", "synthetic-new-password", "", "#current_passwordError"],
    ["short", "short", "synthetic-old", "#passwordError"],
    ["synthetic-new-password", "different-password", "synthetic-old", "#password_confirmationError"],
  ]) {
    const ui = accountPage(password, confirmation, current);
    ui.saveAccount();
    assert.equal(ui.requests.length, 0);
    assert.ok(ui.$(error).textValue);
  }
});

test("password submission includes current password and displays API field rejection", () => {
  const ui = accountPage("synthetic-new-password", undefined, "synthetic-old");
  ui.saveAccount();
  const request = ui.requests[0], data = JSON.parse(request.data);
  assert.equal(data.current_password, "synthetic-old");
  assert.equal(data.password_confirmation, data.password);
  request.error({ status: 422, responseJSON: { errors: {
    current_password: ["The current password is incorrect."],
  } } });
  assert.equal(ui.$("#current_passwordError").textValue, "The current password is incorrect.");
});

test("successful password edits clear all three password controls", () => {
  const ui = accountPage("synthetic-new-password", undefined, "synthetic-old");
  ui.saveAccount();
  ui.requests[0].success({ msg: "Profile updated successfully." });
  for (const selector of ["#current_password", "#password", "#password_confirmation"])
    assert.equal(ui.$(selector).val(), "");
});
