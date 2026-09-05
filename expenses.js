/* ─── RoamAround expenses.js — In-Chat Crew Expense Splitter & Fuel Calculator ───
 * Modular expense calculator and modal manager for shared road trip costs.
 ───────────────────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  const CATEGORIES = {
    fuel:   { label: "Fuel",          icon: "⛽", defaultDesc: "Highway Fuel Station" },
    food:   { label: "Food / Dhaba",  icon: "🍛", defaultDesc: "Highway Dhaba Meal" },
    stay:   { label: "Stay / Camp",   icon: "🏨", defaultDesc: "Guesthouse / Camp Stay" },
    toll:   { label: "Toll / Permit", icon: "🛣️", defaultDesc: "State Highway Toll & Permit" },
    repair: { label: "Spares / Fix",  icon: "🔧", defaultDesc: "Bike Spares & Puncture Fix" },
    other:  { label: "Misc Expense",  icon: "🏷️", defaultDesc: "Shared Road Expense" }
  };

  let activeRequesterId = null;
  let activeTab = "quick"; // 'quick' | 'fuel'
  let selectedCategory = "fuel";

  // Fuel calculation formula
  function calcFuelCost(distanceKm, mileageKmpl, fuelRate = 100, numRiders = 2) {
    const dist = Math.max(parseFloat(distanceKm) || 0, 0);
    const mileage = Math.max(parseFloat(mileageKmpl) || 1, 1);
    const rate = Math.max(parseFloat(fuelRate) || 0, 0);
    const riders = Math.max(parseInt(numRiders) || 1, 1);

    const liters = dist / mileage;
    const totalCost = Math.round(liters * rate);
    const perRider = Math.round(totalCost / riders);

    return {
      liters: parseFloat(liters.toFixed(1)),
      totalCost,
      perRider
    };
  }

  // Calculate net balance for a thread from message history
  function calculateThreadBalances(messages, myUserId) {
    let totalSpent = 0;
    let youPaid = 0;
    let youAreOwed = 0;
    let youOwe = 0;

    (messages || []).forEach(m => {
      if (m.type !== "expense" || !m.meta) return;
      const amount = Number(m.meta.amount) || 0;
      const splitAmount = Number(m.meta.splitAmount) || Math.round(amount / 2);
      const isSettled = m.meta.status === "settled";

      totalSpent += amount;

      if (m.from === myUserId) {
        youPaid += amount;
        if (!isSettled) {
          youAreOwed += splitAmount;
        }
      } else {
        if (!isSettled) {
          youOwe += splitAmount;
        }
      }
    });

    const netBalance = youAreOwed - youOwe; // positive = you are owed, negative = you owe

    return {
      totalSpent,
      youPaid,
      youAreOwed,
      youOwe,
      netBalance
    };
  }

  // Open Expense Modal
  function openExpenseModal(requesterId) {
    activeRequesterId = requesterId;
    const modal = document.getElementById("expense-modal");
    const overlay = document.getElementById("expense-modal-overlay");
    if (!modal || !overlay) return;

    // Reset inputs
    resetForm();
    modal.classList.add("open");
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeExpenseModal() {
    const modal = document.getElementById("expense-modal");
    const overlay = document.getElementById("expense-modal-overlay");
    if (modal) modal.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
    document.body.style.overflow = "";
    activeRequesterId = null;
  }

  function resetForm() {
    activeTab = "quick";
    switchTab("quick");
    selectCategory("fuel");

    const amtInput = document.getElementById("exp-amount");
    const descInput = document.getElementById("exp-desc");
    if (amtInput) amtInput.value = "";
    if (descInput) descInput.value = "";

    // Reset fuel inputs
    const distInput = document.getElementById("exp-fuel-dist");
    const mileageInput = document.getElementById("exp-fuel-mileage");
    const rateInput = document.getElementById("exp-fuel-rate");
    if (distInput) distInput.value = "300";
    if (mileageInput) mileageInput.value = "30";
    if (rateInput) rateInput.value = "102";

    updateLiveSplit();
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll(".exp-tab-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });

    const quickSection = document.getElementById("exp-quick-section");
    const fuelSection = document.getElementById("exp-fuel-section");
    if (quickSection) quickSection.style.display = tab === "quick" ? "block" : "none";
    if (fuelSection) fuelSection.style.display = tab === "fuel" ? "block" : "none";

    updateLiveSplit();
  }

  function selectCategory(catKey) {
    selectedCategory = catKey;
    document.querySelectorAll(".exp-cat-chip").forEach(c => {
      c.classList.toggle("active", c.dataset.cat === catKey);
    });
    const descInput = document.getElementById("exp-desc");
    if (descInput && !descInput.value.trim()) {
      descInput.placeholder = `e.g. ${CATEGORIES[catKey]?.defaultDesc || "Highway Expense"}`;
    }
  }

  function updateLiveSplit() {
    let total = 0;

    if (activeTab === "quick") {
      const amtInput = document.getElementById("exp-amount");
      total = parseFloat(amtInput?.value) || 0;
    } else {
      const dist = parseFloat(document.getElementById("exp-fuel-dist")?.value) || 0;
      const mileage = parseFloat(document.getElementById("exp-fuel-mileage")?.value) || 30;
      const rate = parseFloat(document.getElementById("exp-fuel-rate")?.value) || 100;
      const calc = calcFuelCost(dist, mileage, rate, 2);
      total = calc.totalCost;

      const litersEl = document.getElementById("exp-calc-liters");
      if (litersEl) litersEl.textContent = `${calc.liters} L fuel`;
    }

    const split = Math.round(total / 2);
    const previewTotal = document.getElementById("exp-preview-total");
    const previewShare = document.getElementById("exp-preview-share");

    if (previewTotal) previewTotal.textContent = `₹${total.toLocaleString("en-IN")}`;
    if (previewShare) previewShare.textContent = `₹${split.toLocaleString("en-IN")}`;
  }

  // Handle Form Submission
  async function submitExpense() {
    if (!activeRequesterId) return;

    let total = 0;
    let desc = "";
    let category = selectedCategory;

    if (activeTab === "quick") {
      const amtInput = document.getElementById("exp-amount");
      const descInput = document.getElementById("exp-desc");
      total = Math.round(parseFloat(amtInput?.value) || 0);
      desc = descInput?.value.trim() || CATEGORIES[category]?.defaultDesc || "Shared Expense";
    } else {
      const dist = parseFloat(document.getElementById("exp-fuel-dist")?.value) || 0;
      const mileage = parseFloat(document.getElementById("exp-fuel-mileage")?.value) || 30;
      const rate = parseFloat(document.getElementById("exp-fuel-rate")?.value) || 100;
      const calc = calcFuelCost(dist, mileage, rate, 2);
      total = calc.totalCost;
      category = "fuel";
      desc = `Highway Fuel (${dist} km @ ${mileage} km/L)`;
    }

    if (total <= 0) {
      alert("Please enter a valid expense amount greater than ₹0.");
      return;
    }

    const splitAmount = Math.round(total / 2);
    const catInfo = CATEGORIES[category] || CATEGORIES.other;

    const expensePayload = {
      category,
      categoryLabel: catInfo.label,
      icon: catInfo.icon,
      amount: total,
      splitAmount,
      desc,
      status: "pending",
      paidAt: new Date().toISOString()
    };

    // Send through chat system
    if (typeof window.RC_sendExpense === "function") {
      await window.RC_sendExpense(activeRequesterId, expensePayload);
    }

    closeExpenseModal();
  }

  // Initialize UI events on DOM ready
  function init() {
    // Quick category chips
    document.querySelectorAll(".exp-cat-chip").forEach(chip => {
      chip.addEventListener("click", () => selectCategory(chip.dataset.cat));
    });

    // Preset amount buttons
    document.querySelectorAll(".exp-preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const amtInput = document.getElementById("exp-amount");
        if (amtInput) {
          amtInput.value = btn.dataset.amount;
          updateLiveSplit();
        }
      });
    });

    // Tab buttons
    document.querySelectorAll(".exp-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Input listeners for live calculation
    ["exp-amount", "exp-fuel-dist", "exp-fuel-mileage", "exp-fuel-rate"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", updateLiveSplit);
    });

    // Modal controls
    document.getElementById("expense-modal-close")?.addEventListener("click", closeExpenseModal);
    document.getElementById("expense-modal-overlay")?.addEventListener("click", closeExpenseModal);
    document.getElementById("exp-submit-btn")?.addEventListener("click", submitExpense);
  }

  document.addEventListener("DOMContentLoaded", init);

  window.RC_expenses = {
    CATEGORIES,
    calcFuelCost,
    calculateThreadBalances,
    openExpenseModal,
    closeExpenseModal,
    updateLiveSplit
  };
})();
