// RHC Collection item gallery — filmstrip nav + fullscreen lightbox. Vanilla JS, no deps.
(function () {
  if (typeof PHOTOS === "undefined" || !PHOTOS.length) return;

  let index = 0;
  const mainPhoto = document.querySelector(".main-photo");
  const thumbs = document.querySelectorAll(".thumb");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = lightbox.querySelector(".lightbox-img");

  function setIndex(i) {
    index = (i + PHOTOS.length) % PHOTOS.length;
    mainPhoto.src = PHOTOS[index];
    thumbs.forEach((t, ti) => t.classList.toggle("active", ti === index));
    if (lightbox.classList.contains("open")) {
      lightboxImg.src = PHOTOS[index];
    }
  }

  thumbs.forEach((t) => {
    t.addEventListener("click", () => setIndex(parseInt(t.dataset.index, 10)));
  });

  document.querySelectorAll(".main-photo-wrap .nav-arrow.prev").forEach((b) =>
    b.addEventListener("click", () => setIndex(index - 1))
  );
  document.querySelectorAll(".main-photo-wrap .nav-arrow.next").forEach((b) =>
    b.addEventListener("click", () => setIndex(index + 1))
  );

  mainPhoto.addEventListener("click", () => openLightbox());

  function openLightbox() {
    lightboxImg.src = PHOTOS[index];
    lightbox.classList.add("open");
  }
  function closeLightbox() {
    lightbox.classList.remove("open");
  }

  lightbox.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  lightbox.querySelector(".nav-arrow.prev").addEventListener("click", () => setIndex(index - 1));
  lightbox.querySelector(".nav-arrow.next").addEventListener("click", () => setIndex(index + 1));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") setIndex(index - 1);
    if (e.key === "ArrowRight") setIndex(index + 1);
  });
})();
