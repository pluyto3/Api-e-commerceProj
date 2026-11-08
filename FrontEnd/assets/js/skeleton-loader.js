function showSkeleton(targetSelector, skeletonHtml) {
  const target = document.querySelector(targetSelector);
  if (!target) return;

  target.dataset.originalContent = target.innerHTML;
  target.innerHTML = skeletonHtml;
}

function hideSkeleton(targetSelector) {
  const target = document.querySelector(targetSelector);
  if (!target) return;

  if (target.dataset.originalContent !== undefined) {
    target.innerHTML = target.dataset.originalContent;
    delete target.dataset.originalContent;
  }
}

function showOverlaySkeleton() {
  const card = document.querySelector(".auth-container");
  if (!card) return;

  card.classList.add("hg-skeleton-loading");
  card.setAttribute("aria-busy", "true");
  card.inert = true;
}

function hideOverlaySkeleton() {
  const card = document.querySelector(".auth-container");
  if (!card) return;

  card.classList.remove("hg-skeleton-loading");
  card.removeAttribute("aria-busy");
  card.inert = false;
}
