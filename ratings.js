/* RoamCircle — rider ratings & review comments */
(function () {
  "use strict";

  const DEMO_REVIEWS = {
    demo_arjun: {
      average: 4.7,
      count: 9,
      reviews: [
        { reviewerName: "Vikram S.", rating: 5, comment: "Reliable on mountain roads — always waited at major stops and helped fix a loose chain near Keylong.", createdAt: "2025-08-12T10:00:00.000Z" },
        { reviewerName: "Neha R.", rating: 5, comment: "Calm rider, good pace for a mixed group. Early starts were on time every day.", createdAt: "2025-07-03T14:20:00.000Z" },
        { reviewerName: "Karan P.", rating: 4, comment: "Solid toolkit and spare parts. Only wish we had one more rest day in Manali.", createdAt: "2025-05-18T09:15:00.000Z" },
        { reviewerName: "Sana M.", rating: 5, comment: "Great dhaba recommendations and very safety-conscious in rain on the passes.", createdAt: "2025-04-02T11:40:00.000Z" },
        { reviewerName: "Dev T.", rating: 5, comment: "Done Ladakh twice with Arjun — knows the route and fuel stops well.", createdAt: "2024-11-20T16:00:00.000Z" },
        { reviewerName: "Isha K.", rating: 4, comment: "Friendly and patient with slower riders. Communicated clearly on WhatsApp.", createdAt: "2024-09-08T08:30:00.000Z" },
        { reviewerName: "Rahul B.", rating: 5, comment: "Never pushed pace when someone was tired. Would ride with again.", createdAt: "2024-06-15T13:10:00.000Z" },
        { reviewerName: "Anita G.", rating: 5, comment: "Organized meet-up at Nashik perfectly. Good group leader energy.", createdAt: "2024-03-22T10:55:00.000Z" },
        { reviewerName: "Mohit L.", rating: 4, comment: "Honest about daily distance limits — made planning easier for the whole crew.", createdAt: "2024-01-10T17:25:00.000Z" }
      ]
    },
    demo_priya: {
      average: 4.5,
      count: 6,
      reviews: [
        { reviewerName: "Arjun M.", rating: 5, comment: "Patient with photo stops and never rushed the group. Felt safe on narrow sections.", createdAt: "2025-07-28T12:00:00.000Z" },
        { reviewerName: "Leena D.", rating: 4, comment: "Creative eye for scenic detours. Camping setup was tidy and quick.", createdAt: "2025-06-01T09:30:00.000Z" },
        { reviewerName: "Sameer H.", rating: 5, comment: "First-timer friendly — explained passes and altitude basics clearly.", createdAt: "2025-03-14T15:45:00.000Z" },
        { reviewerName: "Pooja V.", rating: 4, comment: "Relaxed pace suited our group. Classic 350 was well maintained.", createdAt: "2024-10-05T11:20:00.000Z" },
        { reviewerName: "Nitin J.", rating: 5, comment: "Great communicator when weather changed plans near Rohtang.", createdAt: "2024-08-19T08:00:00.000Z" },
        { reviewerName: "Riya C.", rating: 4, comment: "Independent but still team-oriented. Would match again for Spiti.", createdAt: "2024-05-30T14:10:00.000Z" }
      ]
    },
    demo_rohan: {
      average: 4.8,
      count: 14,
      reviews: [
        { reviewerName: "Amit Z.", rating: 5, comment: "Fast but disciplined — always regrouped at agreed points. Expert bike checks.", createdAt: "2025-09-01T10:00:00.000Z" },
        { reviewerName: "Sneha W.", rating: 5, comment: "Satellite phone and emergency plan gave everyone confidence on remote stretches.", createdAt: "2025-08-07T13:30:00.000Z" },
        { reviewerName: "Varun N.", rating: 5, comment: "Knows guesthouses on the Manali–Leh route. Worth the faster pace if you're experienced.", createdAt: "2025-06-22T09:00:00.000Z" },
        { reviewerName: "Kavya O.", rating: 4, comment: "Sometimes ambitious on daily km but dialed back when we asked. Solid mechanic.", createdAt: "2025-05-10T16:15:00.000Z" },
        { reviewerName: "Jayant F.", rating: 5, comment: "Led confidently through Sarchu. Clear hand signals in dust.", createdAt: "2025-02-18T11:45:00.000Z" },
        { reviewerName: "Meera Q.", rating: 5, comment: "Self-reliant and helpful when my clutch cable snapped near Jispa.", createdAt: "2024-12-03T08:20:00.000Z" },
        { reviewerName: "Harsh I.", rating: 5, comment: "Best long-ride partner I've had on the Srinagar loop.", createdAt: "2024-10-28T14:00:00.000Z" },
        { reviewerName: "Divya E.", rating: 4, comment: "High energy — match his pace only if you're comfortable with 400+ km days.", createdAt: "2024-09-12T10:30:00.000Z" },
        { reviewerName: "Tarun Y.", rating: 5, comment: "Professional about safety gear and pre-ride briefings.", createdAt: "2024-07-25T17:00:00.000Z" },
        { reviewerName: "Nidhi U.", rating: 5, comment: "Shared live location without being asked. Great for split groups.", createdAt: "2024-06-08T12:40:00.000Z" },
        { reviewerName: "Omar P.", rating: 5, comment: "KTM setup tips saved me fuel on the Ladakh stretches.", createdAt: "2024-04-19T09:55:00.000Z" },
        { reviewerName: "Bhavna R.", rating: 5, comment: "Punctual morning starts and realistic ETAs.", createdAt: "2024-02-14T15:20:00.000Z" },
        { reviewerName: "Gaurav K.", rating: 4, comment: "Intense rider but respectful. Good for experienced crews only.", createdAt: "2023-11-30T11:10:00.000Z" },
        { reviewerName: "Anjali S.", rating: 5, comment: "Would trust him on any high-altitude route again.", createdAt: "2023-09-05T13:50:00.000Z" }
      ]
    }
  };

  const cache = new Map();

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtReviewDate(iso) {
    try {
      return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    } catch { return ""; }
  }

  function starsHtml(rating) {
    const n = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
    return "★".repeat(n) + `<span class="rc-rating-stars-dim">${"★".repeat(5 - n)}</span>`;
  }

  async function fetchRatings(userId) {
    if (!userId) return { average: null, count: 0, reviews: [] };
    if (cache.has(userId)) return cache.get(userId);

    if (userId.startsWith("demo_")) {
      const data = DEMO_REVIEWS[userId] || { average: null, count: 0, reviews: [] };
      cache.set(userId, data);
      return data;
    }

    try {
      const res  = await fetch(`/api/users/${encodeURIComponent(userId)}/reviews`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const empty = { average: null, count: 0, reviews: [] };
        cache.set(userId, empty);
        return empty;
      }
      const summary = {
        average: data.count > 0 ? data.average : null,
        count:   data.count   || 0,
        reviews: data.reviews || []
      };
      cache.set(userId, summary);
      return summary;
    } catch {
      return { average: null, count: 0, reviews: [] };
    }
  }

  function invalidateCache(userId) {
    if (userId) cache.delete(userId);
  }

  function hasRating(summary) {
    return summary && summary.count > 0 && summary.average != null;
  }

  function badgeHtml(summary, extraClass = "") {
    if (!hasRating(summary)) return "";
    const cls = `rc-rating-badge${extraClass ? ` ${extraClass}` : ""}`;
    return `<button type="button" class="${cls}" data-rc-rating-badge aria-label="View ${summary.count} reviews">
      <span class="rc-rating-badge-star">★</span>
      <span class="rc-rating-badge-val">${summary.average.toFixed(1)}</span>
      <span class="rc-rating-badge-count">(${summary.count})</span>
    </button>`;
  }

  function ensureModal() {
    if (document.getElementById("rc-reviews-modal")) return;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="rc-reviews-overlay" id="rc-reviews-overlay" hidden></div>
      <div class="rc-reviews-modal" id="rc-reviews-modal" role="dialog" aria-modal="true" aria-labelledby="rc-reviews-title" hidden>
        <div class="rc-reviews-header">
          <div>
            <h2 id="rc-reviews-title">Rider reviews</h2>
            <p class="rc-reviews-sub" id="rc-reviews-sub"></p>
          </div>
          <button type="button" class="rc-reviews-close" id="rc-reviews-close" aria-label="Close">×</button>
        </div>
        <div class="rc-reviews-summary" id="rc-reviews-summary"></div>
        <div class="rc-reviews-list" id="rc-reviews-list"></div>
      </div>`);

    const modal = document.getElementById("rc-reviews-modal");
    modal?.addEventListener("click", e => {
      if (e.target.closest("#rc-reviews-close")) {
        e.preventDefault();
        e.stopPropagation();
        closeReviewsModal();
      }
    });
    document.getElementById("rc-reviews-overlay")?.addEventListener("click", closeReviewsModal);
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && isReviewsModalOpen()) closeReviewsModal();
    });
  }

  function isReviewsModalOpen() {
    return document.getElementById("rc-reviews-modal")?.classList.contains("is-open");
  }

  function setReviewsModalOpen(open) {
    const modal   = document.getElementById("rc-reviews-modal");
    const overlay = document.getElementById("rc-reviews-overlay");
    if (!modal) return;

    if (open) {
      modal.removeAttribute("hidden");
      modal.classList.add("is-open");
      overlay?.removeAttribute("hidden");
      overlay?.classList.add("is-open");
      document.body.style.overflow = "hidden";
    } else {
      modal.classList.remove("is-open");
      modal.setAttribute("hidden", "");
      overlay?.classList.remove("is-open");
      overlay?.setAttribute("hidden", "");
      document.body.style.overflow = "";
    }
  }

  function closeReviewsModal() {
    setReviewsModalOpen(false);
  }

  async function openReviewsModal(userId, displayName) {
    ensureModal();
    const modal   = document.getElementById("rc-reviews-modal");
    const overlay = document.getElementById("rc-reviews-overlay");
    const listEl  = document.getElementById("rc-reviews-list");
    const subEl   = document.getElementById("rc-reviews-sub");
    const sumEl   = document.getElementById("rc-reviews-summary");
    const titleEl = document.getElementById("rc-reviews-title");

    if (!modal || !listEl) return;

    titleEl.textContent = displayName ? `${displayName} — reviews` : "Rider reviews";
    subEl.textContent   = "Loading…";
    sumEl.innerHTML     = "";
    listEl.innerHTML    = `<div class="rc-reviews-loading">Loading reviews…</div>`;

    setReviewsModalOpen(true);

    const data = await fetchRatings(userId);

    if (!hasRating(data)) {
      subEl.textContent = displayName ? `No reviews for ${displayName} yet.` : "No reviews yet.";
      sumEl.innerHTML   = "";
      listEl.innerHTML  = `<div class="rc-reviews-empty">This rider hasn't received any reviews yet.</div>`;
      return;
    }

    subEl.textContent = `${data.count} ride review${data.count === 1 ? "" : "s"}`;
    sumEl.innerHTML = `
      <div class="rc-reviews-score-big">${data.average.toFixed(1)}</div>
      <div class="rc-reviews-stars-line">${starsHtml(data.average)}</div>`;

    listEl.innerHTML = data.reviews.map(r => `
      <article class="rc-review-item">
        <div class="rc-review-top">
          <strong class="rc-review-author">${esc(r.reviewerName || "Rider")}</strong>
          <span class="rc-review-stars" aria-label="${r.rating} out of 5">${starsHtml(r.rating)}</span>
        </div>
        <p class="rc-review-text">${esc(r.comment)}</p>
        ${r.createdAt ? `<time class="rc-review-date">${fmtReviewDate(r.createdAt)}</time>` : ""}
      </article>`).join("");
  }

  function bindBadge(container, userId, displayName) {
    if (!container) return;
    container.querySelectorAll("[data-rc-rating-badge]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        openReviewsModal(userId, displayName);
      });
    });
  }

  async function mountBadge(container, userId, displayName, extraClass = "") {
    if (!container) return null;
    const data = await fetchRatings(userId);
    container.innerHTML = badgeHtml(data, extraClass);
    bindBadge(container, userId, displayName);
    return data;
  }

  async function initProfilePage(userId, displayName) {
    ensureModal();
    const data = await fetchRatings(userId);

    const statEl = document.getElementById("profile-rating-stat");
    if (statEl) {
      statEl.classList.remove("stat-rating-none", "is-clickable");
      statEl.style.cursor = "";
      statEl.onclick = null;

      if (hasRating(data)) {
        statEl.innerHTML = `<strong>${data.average.toFixed(1)}</strong><span>rider rating · ${data.count} reviews</span>`;
        statEl.classList.add("is-clickable");
        statEl.style.cursor = "pointer";
        statEl.onclick = () => openReviewsModal(userId, displayName);
      } else {
        statEl.innerHTML = `<strong>—</strong><span>No reviews yet</span>`;
        statEl.classList.add("stat-rating-none");
      }
    }

    const card = document.getElementById("profile-rating-card");
    if (card) {
      if (hasRating(data)) {
        card.style.display = "";
        card.classList.add("is-clickable", "rating-card");
        const scoreStrong = card.querySelector(".rating-score strong");
        const scoreSpan   = card.querySelector(".rating-score span");
        const blurb       = card.querySelector(".rating-blurb");
        if (scoreStrong) scoreStrong.textContent = `${data.average.toFixed(1)}/5`;
        if (scoreSpan)   scoreSpan.textContent   = `Based on ${data.count} ride review${data.count === 1 ? "" : "s"} — tap to read`;
        if (blurb && data.reviews[0]) {
          blurb.textContent = `"${data.reviews[0].comment.slice(0, 120)}${data.reviews[0].comment.length > 120 ? "…" : ""}" — ${data.reviews[0].reviewerName}`;
        }
        card.onclick = () => openReviewsModal(userId, displayName);
      } else {
        card.style.display = "none";
      }
    }

    return data;
  }

  async function initOwnProfilePage() {
    ensureModal();
    const meRes  = await fetch("/api/auth/me");
    const meData = await meRes.json().catch(() => ({}));
    if (!meRes.ok || !meData.userId) {
      window.location.href = "/login.html";
      return;
    }
    const name = meData.name || "You";
    const data = await fetchRatings(meData.userId);

    const section = document.getElementById("my-reviews-section");
    if (!section) return;

    if (!hasRating(data)) {
      section.innerHTML = `
        <h3>Your rider rating</h3>
        <p class="section-hint">You don't have any reviews yet. Complete trips with mutual matches to receive ratings from other riders.</p>`;
      return;
    }

    section.innerHTML = `
      <h3>Your rider rating</h3>
      <button type="button" class="rc-rating-badge rc-rating-badge--profile" id="my-rating-open">
        <span class="rc-rating-badge-star">★</span>
        <span class="rc-rating-badge-val">${data.average.toFixed(1)}</span>
        <span class="rc-rating-badge-count">${data.count} review${data.count === 1 ? "" : "s"}</span>
      </button>
      <p class="section-hint" style="margin-top:10px">Tap to read what other riders said about you.</p>`;

    document.getElementById("my-rating-open")?.addEventListener("click", () => {
      openReviewsModal(meData.userId, name);
    });
  }

  window.RC_ratings = {
    fetchRatings,
    invalidateCache,
    hasRating,
    badgeHtml,
    mountBadge,
    bindBadge,
    openReviewsModal,
    closeReviewsModal,
    initProfilePage,
    initOwnProfilePage
  };
})();
