/* ─── RoamCircle animate.js — scroll reveal + micro-interactions ─
 * Loads on every page. Handles:
 *  - Intersection Observer scroll reveals
 *  - Nav badge bump on count change
 *  - Smooth number counter for stats
 *  - Parallax tilt on cards (desktop only)
 *  - Ripple effect on buttons
 ─────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  // ── Scroll reveal ──────────────────────────────────────────
  function initReveal() {
    // Auto-add reveal class to key elements if not already present
    const selectors = [
      ".section-heading",
      ".mini-card",
      ".overview article",
      ".flow-grid article",
      ".safety-grid article",
      ".board article",
      ".locked-preview article",
      ".profile-grid article",
      ".profile-stats > div"
    ];

    selectors.forEach((sel, si) => {
      document.querySelectorAll(sel).forEach((el, i) => {
        if (!el.classList.contains("reveal")) {
          el.classList.add("reveal");
          // Stagger delay based on position in its group
          if (i > 0) el.style.transitionDelay = `${i * 0.08}s`;
        }
      });
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          // Once revealed, unobserve to save resources
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold:  0.12,
      rootMargin: "0px 0px -40px 0px"
    });

    document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
  }

  // ── Re-run reveal on dynamic content (request cards, match grid) ─
  // Called by chat.js after injecting cards
  window.RC_revealNew = function (container) {
    const newEls = (container || document).querySelectorAll(
      ".request-card:not(.reveal-done), .match-profile-card:not(.reveal-done), .real-rider-card:not(.reveal-done)"
    );
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          e.target.classList.add("reveal-done");
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });

    newEls.forEach((el, i) => {
      el.classList.add("reveal");
      el.style.transitionDelay = `${i * 0.06}s`;
      observer.observe(el);
    });
  };

  // ── Badge bump on count change ─────────────────────────────
  function initBadgeBump() {
    const badges = ["request-count", "nav-chat-count", "notif-badge"];
    badges.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      let lastVal = el.textContent;
      const mo = new MutationObserver(() => {
        if (el.textContent !== lastVal && el.textContent !== "0") {
          lastVal = el.textContent;
          el.classList.remove("bump");
          void el.offsetWidth; // force reflow
          el.classList.add("bump");
          setTimeout(() => el.classList.remove("bump"), 400);
        }
      });
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  // ── Smooth stat counters ───────────────────────────────────
  function animateCounter(el) {
    const target = parseFloat(el.textContent);
    if (isNaN(target) || target > 999) return; // skip non-numeric or huge numbers
    const isDecimal = el.textContent.includes(".");
    const decimals  = isDecimal ? (el.textContent.split(".")[1]?.length || 1) : 0;
    const duration  = 800;
    const start     = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const ease     = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current  = target * ease;
      el.textContent = isDecimal ? current.toFixed(decimals) : Math.round(current);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function initCounters() {
    const statEls = document.querySelectorAll(".profile-stats strong, .rating-score strong");
    if (!statEls.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          animateCounter(e.target);
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.5 });

    statEls.forEach(el => observer.observe(el));
  }

  // ── Card tilt effect (desktop only) ───────────────────────
  function initTilt() {
    if (window.matchMedia("(hover: none)").matches) return; // skip touch devices

    const tiltEls = document.querySelectorAll(
      ".mini-card, .match-profile-card, .my-trip-card"
    );

    tiltEls.forEach(el => {
      el.addEventListener("mousemove", e => {
        const rect   = el.getBoundingClientRect();
        const cx     = rect.left + rect.width  / 2;
        const cy     = rect.top  + rect.height / 2;
        const dx     = (e.clientX - cx) / (rect.width  / 2);
        const dy     = (e.clientY - cy) / (rect.height / 2);
        const tiltX  = dy * -5;  // max 5deg
        const tiltY  = dx *  5;
        el.style.transform = `perspective(600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-4px)`;
        el.style.transition = "transform 0.1s ease";
      });

      el.addEventListener("mouseleave", () => {
        el.style.transform = "";
        el.style.transition = "transform 0.4s cubic-bezier(0.16,1,0.3,1)";
      });
    });
  }

  // ── Ripple effect on buttons ───────────────────────────────
  function initRipple() {
    document.addEventListener("click", e => {
      const btn = e.target.closest(".button, .open-chat-btn, .mpc-chat-btn");
      if (!btn) return;

      const rect   = btn.getBoundingClientRect();
      const size   = Math.max(rect.width, rect.height) * 1.5;
      const x      = e.clientX - rect.left - size / 2;
      const y      = e.clientY - rect.top  - size / 2;

      const ripple = document.createElement("span");
      ripple.style.cssText = `
        position:absolute; border-radius:50%; pointer-events:none;
        width:${size}px; height:${size}px;
        left:${x}px; top:${y}px;
        background:rgba(255,255,255,0.18);
        transform:scale(0); opacity:1;
        animation:ripple-out 0.55s cubic-bezier(0.16,1,0.3,1) forwards;
      `;

      // Ensure btn has position:relative for ripple containment
      if (getComputedStyle(btn).position === "static") {
        btn.style.position = "relative";
      }
      btn.style.overflow = "hidden";
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  }

  // ── Smooth page transitions on link clicks ─────────────────
  function initPageTransitions() {
    document.addEventListener("click", e => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const link = e.target.closest("a[href]");
      if (!link) return;

      const href = link.getAttribute("href");
      // Only internal .html pages, not anchors, javascript, or external
      if (!href || href.startsWith("#") || href.startsWith("http") ||
          href.startsWith("mailto") || href.startsWith("javascript:") ||
          link.target === "_blank" || link.hasAttribute("download")) return;

      e.preventDefault();
      document.body.style.opacity    = "0";
      document.body.style.transform  = "translateY(-8px)";
      document.body.style.transition = "opacity 0.25s ease, transform 0.25s ease";

      setTimeout(() => { window.location.href = href; }, 240);
    });
  }

  // ── Inject ripple keyframe ─────────────────────────────────
  function injectRippleKeyframe() {
    if (document.getElementById("rc-ripple-style")) return;
    const style = document.createElement("style");
    style.id    = "rc-ripple-style";
    style.textContent = `
      @keyframes ripple-out {
        to { transform: scale(1); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Init everything on DOM ready ──────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    // Skip heavy animations if reduced motion preferred
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    injectRippleKeyframe();
    if (!reduced) {
      initReveal();
      initBadgeBump();
      initCounters();
      initTilt();
      initPageTransitions();
    }
    initRipple(); // ripple is subtle enough to always run
  });

})();
