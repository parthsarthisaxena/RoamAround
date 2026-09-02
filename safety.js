/* ─── RoamCircle safety.js — Convoy Safety Hub & Rider SOS Beacon ───
 * Real-time location check-ins, emergency hotlines, medical ID,
 * and high-altitude / remote route safety checklists.
 ───────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  const STORAGE_CHECKLIST_KEY = "rc_safety_checklist";
  const STORAGE_MEDICAL_KEY = "rc_medical_id";

  const DEFAULT_MEDICAL = {
    bloodGroup: "O+",
    iceName: "Emergency Contact",
    icePhone: "+91 98765 43210",
    iceRelation: "Family",
    medicalNotes: "No known allergies. Carry standard rider first-aid."
  };

  const HELPLINES = [
    { name: "National Emergency (SOS)", number: "112", icon: "🚨", desc: "All-in-one Police, Fire & Medical rescue" },
    { name: "NHAI Highway Patrol", number: "1033", icon: "🛣️", desc: "National Highway breakdown & ambulance" },
    { name: "Medical Ambulance", number: "108", icon: "🚑", desc: "Emergency trauma & medical transport" },
    { name: "Police Assistance", number: "100", icon: "👮", desc: "Local state police dispatch" }
  ];

  let sosCountdownTimer = null;
  let sosCountdownSeconds = 3;
  let activeTargetRequesterId = null;

  // ── Geolocation Helper ─────────────────────────────────────────
  async function getCurrentPosition() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        // Fallback simulated coordinate if browser blocks or in demo
        resolve({
          lat: 18.5204,
          lng: 73.8567,
          accuracy: 50,
          label: "Highway Stop (GPS fallback)",
          timestamp: new Date().toISOString()
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: parseFloat(pos.coords.latitude.toFixed(5)),
            lng: parseFloat(pos.coords.longitude.toFixed(5)),
            accuracy: Math.round(pos.coords.accuracy || 20),
            altitude: pos.coords.altitude ? Math.round(pos.coords.altitude) : null,
            label: "Live GPS Fix",
            timestamp: new Date().toISOString()
          });
        },
        (err) => {
          console.warn("[safety] Geolocation error or denied:", err.message);
          // Return default rider coordinate (e.g. Pune/Mumbai highway corridor)
          resolve({
            lat: 18.7547,
            lng: 73.4062,
            accuracy: 100,
            label: "Mumbai-Pune Expressway Corridor",
            isSimulated: true,
            timestamp: new Date().toISOString()
          });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  // ── Medical Profile ────────────────────────────────────────────
  function getMedicalProfile() {
    try {
      const saved = localStorage.getItem(STORAGE_MEDICAL_KEY);
      if (saved) return { ...DEFAULT_MEDICAL, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULT_MEDICAL };
  }

  function saveMedicalProfile(data) {
    try {
      const current = getMedicalProfile();
      const updated = { ...current, ...data };
      localStorage.setItem(STORAGE_MEDICAL_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error("[safety] Failed to save medical profile:", e);
      return data;
    }
  }

  // ── Checklist Management ───────────────────────────────────────
  function getChecklistState() {
    try {
      const saved = localStorage.getItem(STORAGE_CHECKLIST_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }

  function setChecklistItem(key, isChecked) {
    try {
      const state = getChecklistState();
      state[key] = !!isChecked;
      localStorage.setItem(STORAGE_CHECKLIST_KEY, JSON.stringify(state));
      updateChecklistProgress();
    } catch (e) {
      console.error("[safety] Failed to save checklist state:", e);
    }
  }

  function updateChecklistProgress() {
    const state = getChecklistState();
    const checkboxes = document.querySelectorAll(".safety-check-item input[type='checkbox']");
    if (!checkboxes.length) return;

    let total = checkboxes.length;
    let checked = 0;
    checkboxes.forEach((cb) => {
      const key = cb.dataset.key;
      if (key && state[key]) {
        cb.checked = true;
        checked++;
      } else if (!key && cb.checked) {
        checked++;
      }
    });

    const progressEl = document.getElementById("safety-checklist-progress-text");
    const barEl = document.getElementById("safety-checklist-progress-bar");
    if (progressEl) {
      progressEl.textContent = `${checked} of ${total} safety checks completed`;
    }
    if (barEl) {
      const pct = Math.round((checked / total) * 100);
      barEl.style.width = `${pct}%`;
    }
  }

  // ── Modal Controller ───────────────────────────────────────────
  function openSafetyModal(tab = "sos", requesterId = null) {
    if (requesterId) activeTargetRequesterId = requesterId;

    const modal = document.getElementById("safety-modal");
    if (!modal) return;

    modal.classList.add("open");
    document.body.style.overflow = "hidden";

    switchTab(tab);
    populateMedicalForm();
    populateChecklist();
    cancelSosCountdown();
  }

  function closeSafetyModal() {
    const modal = document.getElementById("safety-modal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
    cancelSosCountdown();
  }

  function switchTab(tabId) {
    const tabs = document.querySelectorAll(".safety-tab-btn");
    const contents = document.querySelectorAll(".safety-tab-content");

    tabs.forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === tabId);
    });

    contents.forEach((c) => {
      c.classList.toggle("active", c.id === `safety-tab-${tabId}`);
    });
  }

  function populateMedicalForm() {
    const med = getMedicalProfile();
    const bg = document.getElementById("safety-med-blood-group");
    const iname = document.getElementById("safety-med-ice-name");
    const iphone = document.getElementById("safety-med-ice-phone");
    const irel = document.getElementById("safety-med-ice-relation");
    const inotes = document.getElementById("safety-med-notes");

    if (bg) bg.value = med.bloodGroup || "O+";
    if (iname) iname.value = med.iceName || "";
    if (iphone) iphone.value = med.icePhone || "";
    if (irel) irel.value = med.iceRelation || "Family";
    if (inotes) inotes.value = med.medicalNotes || "";

    // Update preview badge in SOS tab
    const sosBg = document.getElementById("sos-blood-group-badge");
    if (sosBg) sosBg.textContent = med.bloodGroup || "O+";
    const sosIceBtn = document.getElementById("sos-quick-ice-call");
    if (sosIceBtn) {
      sosIceBtn.href = `tel:${(med.icePhone || "112").replace(/\s+/g, "")}`;
      sosIceBtn.innerHTML = `📞 Call ICE (${med.iceName || "Emergency Contact"})`;
    }
  }

  function populateChecklist() {
    const state = getChecklistState();
    const checkboxes = document.querySelectorAll(".safety-check-item input[type='checkbox']");
    checkboxes.forEach((cb) => {
      const key = cb.dataset.key;
      if (key && state[key] !== undefined) {
        cb.checked = !!state[key];
      }
    });
    updateChecklistProgress();
  }

  // ── SOS Broadcast Trigger ──────────────────────────────────────
  function startSosCountdown(requesterId = null) {
    const targetId = requesterId || activeTargetRequesterId || window._rcActiveRequesterId;
    const overlay = document.getElementById("sos-countdown-overlay");
    const countNum = document.getElementById("sos-countdown-number");
    const sosBtn = document.getElementById("safety-sos-big-btn");

    sosCountdownSeconds = 3;
    if (overlay) overlay.style.display = "flex";
    if (countNum) countNum.textContent = sosCountdownSeconds;
    if (sosBtn) sosBtn.classList.add("active-pulse");

    if (sosCountdownTimer) clearInterval(sosCountdownTimer);

    sosCountdownTimer = setInterval(async () => {
      sosCountdownSeconds--;
      if (countNum) countNum.textContent = sosCountdownSeconds;

      if (sosCountdownSeconds <= 0) {
        clearInterval(sosCountdownTimer);
        sosCountdownTimer = null;
        if (overlay) overlay.style.display = "none";
        if (sosBtn) sosBtn.classList.remove("active-pulse");
        await executeSosBroadcast(targetId);
      }
    }, 1000);
  }

  function cancelSosCountdown() {
    if (sosCountdownTimer) {
      clearInterval(sosCountdownTimer);
      sosCountdownTimer = null;
    }
    const overlay = document.getElementById("sos-countdown-overlay");
    const sosBtn = document.getElementById("safety-sos-big-btn");
    if (overlay) overlay.style.display = "none";
    if (sosBtn) sosBtn.classList.remove("active-pulse");
  }

  async function executeSosBroadcast(targetRequesterId = null) {
    const pos = await getCurrentPosition();
    const med = getMedicalProfile();
    const reasonInput = document.getElementById("safety-sos-reason");
    const reason = reasonInput?.value?.trim() || "Immediate Convoy Assistance / Breakdown";

    const sosPayload = {
      type: "sos",
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracy,
      altitude: pos.altitude,
      reason: reason,
      bloodGroup: med.bloodGroup,
      iceName: med.iceName,
      icePhone: med.icePhone,
      timestamp: new Date().toISOString(),
      mapUrl: `https://www.google.com/maps?q=${pos.lat},${pos.lng}`
    };

    // If chat is open with a user, dispatch directly
    if (window.RC_sendSOSAlert) {
      await window.RC_sendSOSAlert(targetRequesterId, sosPayload);
    }

    closeSafetyModal();

    // Trigger audible tone or alert toast
    if (window.RC_realtime?.toast) {
      window.RC_realtime.toast("🚨 EMERGENCY SOS BROADCASTED TO CONVOY", "Urgent alert sent with GPS coordinates.");
    } else {
      alert(`🚨 EMERGENCY SOS SENT!\n\nGPS: ${pos.lat}, ${pos.lng}\nReason: ${reason}\nICE Contact: ${med.icePhone}`);
    }
  }

  // ── 1-Tap Location Check-in ────────────────────────────────────
  async function sendLocationCheckin(requesterId) {
    if (!requesterId) return;

    const pos = await getCurrentPosition();
    const note = prompt("Add a note for this check-in (optional):", "Riding on schedule / Reached waypoint 👍");
    if (note === null) return; // User cancelled

    const checkinPayload = {
      type: "location",
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracy,
      altitude: pos.altitude,
      label: pos.label || "Live Highway Location",
      note: note.trim() || "Live Convoy Check-In",
      timestamp: new Date().toISOString(),
      mapUrl: `https://www.google.com/maps?q=${pos.lat},${pos.lng}`
    };

    if (window.RC_sendLocationCheckin) {
      await window.RC_sendLocationCheckin(requesterId, checkinPayload);
    }
  }

  // ── Initialization & Event Wiring ─────────────────────────────
  function init() {
    // Wire topbar trigger
    const navSafetyBtn = document.getElementById("nav-safety-btn");
    if (navSafetyBtn) {
      navSafetyBtn.addEventListener("click", () => openSafetyModal("sos"));
    }

    // Modal close buttons
    const closeBtn = document.getElementById("safety-modal-close");
    const overlay = document.getElementById("safety-modal-overlay");
    if (closeBtn) closeBtn.addEventListener("click", closeSafetyModal);
    if (overlay) overlay.addEventListener("click", closeSafetyModal);

    // Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.getElementById("safety-modal")?.classList.contains("open")) {
        closeSafetyModal();
      }
    });

    // Tab buttons
    document.querySelectorAll(".safety-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchTab(btn.dataset.tab);
      });
    });

    // Big SOS Button
    const bigSosBtn = document.getElementById("safety-sos-big-btn");
    if (bigSosBtn) {
      bigSosBtn.addEventListener("click", () => startSosCountdown());
    }

    // Cancel SOS countdown
    const abortSosBtn = document.getElementById("sos-countdown-abort");
    if (abortSosBtn) {
      abortSosBtn.addEventListener("click", cancelSosCountdown);
    }

    // Save Medical Info form
    const saveMedBtn = document.getElementById("safety-save-med-btn");
    if (saveMedBtn) {
      saveMedBtn.addEventListener("click", () => {
        const bg = document.getElementById("safety-med-blood-group")?.value;
        const iname = document.getElementById("safety-med-ice-name")?.value.trim();
        const iphone = document.getElementById("safety-med-ice-phone")?.value.trim();
        const irel = document.getElementById("safety-med-ice-relation")?.value.trim();
        const inotes = document.getElementById("safety-med-notes")?.value.trim();

        saveMedicalProfile({
          bloodGroup: bg,
          iceName: iname,
          icePhone: iphone,
          iceRelation: irel,
          medicalNotes: inotes
        });

        // Also attempt background sync with backend profile
        fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bloodGroup: bg,
            emergencyContact: { name: iname, phone: iphone, relation: irel },
            medicalNotes: inotes
          })
        }).catch(() => {});

        const statusEl = document.getElementById("safety-med-save-status");
        if (statusEl) {
          statusEl.textContent = "✓ Medical ID saved";
          statusEl.style.color = "#1DB954";
          setTimeout(() => {
            statusEl.textContent = "";
          }, 3000);
        }
        populateMedicalForm();
      });
    }

    // Checklist checkboxes change
    document.querySelectorAll(".safety-check-item input[type='checkbox']").forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.dataset.key) {
          setChecklistItem(cb.dataset.key, cb.checked);
        } else {
          updateChecklistProgress();
        }
      });
    });

    // Chat toolbar share location
    const chatLocationBtn = document.getElementById("chat-share-location");
    if (chatLocationBtn) {
      chatLocationBtn.addEventListener("click", () => {
        if (window._rcActiveRequesterId) {
          sendLocationCheckin(window._rcActiveRequesterId);
        } else {
          openSafetyModal("sos");
        }
      });
    }
  }

  // Export to global scope
  window.RC_safety = {
    openSafetyModal,
    closeSafetyModal,
    getCurrentPosition,
    getMedicalProfile,
    saveMedicalProfile,
    sendLocationCheckin,
    startSosCountdown,
    cancelSosCountdown,
    executeSosBroadcast,
    init
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
