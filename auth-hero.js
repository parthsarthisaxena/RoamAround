/**
 * Auth panel hero photos (login + signup trip-type picker).
 * Uses <img> layers — more reliable than CSS var(url(...)) on background-image.
 */
(function initAuthHero() {
  const tc = window.RC_tripCovers;
  const heroFrom = (key) => {
    const base = tc?.coverForType(key) || tc?.DEFAULT;
    return base ? base.replace("w=900&h=400", "w=1400&h=900") : "";
  };
  const HERO = {
    login: heroFrom("hiking"),
    motorcycle: heroFrom("motorcycle"),
    roadtrip: heroFrom("roadtrip"),
    cycling: heroFrom("cycling"),
    hiking: heroFrom("hiking"),
    backpacking: heroFrom("backpacking")
  };
  const HERO_FALLBACK = HERO.motorcycle;

  function ensureHeroImg(panel) {
    let img = panel.querySelector(".auth-hero-img");
    if (img) return img;
    img = document.createElement("img");
    img.className = "auth-hero-img";
    img.alt = "";
    img.decoding = "async";
    img.loading = "eager";
    panel.insertBefore(img, panel.firstChild);
    return img;
  }

  function setHeroImage(img, url, allowFallback = true) {
    if (!img || !url) return;
    if (img.dataset.current === url) return;

    const preload = new Image();
    preload.onload = () => {
      img.dataset.current = url;
      img.src = url;
      img.classList.add("is-loaded");
      img.classList.remove("is-error");
    };
    preload.onerror = () => {
      if (allowFallback && url !== HERO_FALLBACK) {
        setHeroImage(img, HERO_FALLBACK, false);
        return;
      }
      img.classList.add("is-error");
      img.classList.remove("is-loaded");
    };
    preload.src = url;
  }

  document.querySelectorAll(".auth-panel").forEach(panel => {
    const img = ensureHeroImg(panel);
    const tripSelect = document.getElementById("trip-type");
    const isSignup = panel.classList.contains("signup");

    if (isSignup && tripSelect) {
      const apply = () => {
        const key = tripSelect.value;
        panel.dataset.tripType = key;
        setHeroImage(img, HERO[key] || HERO.motorcycle);
      };
      tripSelect.addEventListener("change", apply);
      apply();
      return;
    }

    setHeroImage(img, HERO.login);
  });
})();
