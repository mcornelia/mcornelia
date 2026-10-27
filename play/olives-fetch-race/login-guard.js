// Keep the form on screen even if a module fails to load on a stale/offline tab.
(() => {
  const form = document.getElementById("join-form");
  form.addEventListener("submit", event => {
    event.preventDefault();
    if(document.documentElement.dataset.fetchReady !== "yes")
      document.getElementById("setup").textContent = "The garden is still loading. Your entry is still here. Refresh this page if it does not finish.";
  });
})();
