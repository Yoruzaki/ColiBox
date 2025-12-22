let depositState = null;
let withdrawState = null;
let selectedDepositLocker = null;
let selectedWithdrawLocker = null;
let statusPollInterval = null;

function showLoading(show = true) {
  const overlay = document.getElementById("loading-overlay");
  if (show) {
    overlay.classList.remove("hidden");
  } else {
    overlay.classList.add("hidden");
  }
}

function showToast(message, type = "info") {
  const toast = document.getElementById("message-toast");
  toast.textContent = message;
  toast.className = `message-toast ${type}`;
  toast.classList.remove("hidden");
  
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

function showFlow(flow) {
  const homeScreen = document.getElementById("home-screen");
  const flowScreen = document.getElementById(`${flow}-screen`);
  
  homeScreen.style.animation = "fadeOut 0.3s ease-out";
  setTimeout(() => {
    homeScreen.classList.add("hidden");
    flowScreen.classList.remove("hidden");
    flowScreen.style.animation = "fadeIn 0.4s ease-out";
    
    // Start status polling when entering flow screen
    startStatusPolling();
  }, 300);
}

function goHome() {
  depositState = null;
  withdrawState = null;
  selectedDepositLocker = null;
  selectedWithdrawLocker = null;
  
  // Stop status polling
  stopStatusPolling();
  
  const currentScreen = document.querySelector(".screen:not(.hidden)");
  currentScreen.style.animation = "fadeOut 0.3s ease-out";
  
  setTimeout(() => {
    document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
    const homeScreen = document.getElementById("home-screen");
    homeScreen.classList.remove("hidden");
    homeScreen.style.animation = "fadeIn 0.4s ease-out";
    
    // Reset forms
    document.getElementById("deposit-tracking").value = "";
    document.getElementById("deposit-locker").value = "";
    document.getElementById("withdraw-password").value = "";
    document.getElementById("withdraw-locker").value = "";
    document.querySelectorAll(".locker-btn").forEach(btn => btn.classList.remove("selected"));
    document.getElementById("deposit-close").classList.add("hidden");
    document.getElementById("withdraw-close").classList.add("hidden");
  }, 300);
}

// Status polling
function startStatusPolling() {
  // Poll immediately
  updateLockerStatuses();
  
  // Then poll every 10 seconds
  if (statusPollInterval) {
    clearInterval(statusPollInterval);
  }
  statusPollInterval = setInterval(updateLockerStatuses, 10000);
}

function stopStatusPolling() {
  if (statusPollInterval) {
    clearInterval(statusPollInterval);
    statusPollInterval = null;
  }
}

async function updateLockerStatuses() {
  try {
    const resp = await fetch("/api/lockers/status");
    if (!resp.ok) return;
    
    const data = await resp.json();
    const lockers = data.lockers || [];
    
    // Update both grids
    updateGridStatuses("deposit-locker-grid", lockers);
    updateGridStatuses("withdraw-locker-grid", lockers);
  } catch (error) {
    console.error("Failed to update locker statuses:", error);
  }
}

function updateGridStatuses(gridId, lockers) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  
  lockers.forEach(locker => {
    const btn = grid.querySelector(`[data-locker="${locker.id}"]`);
    if (!btn) return;
    
    // Remove all status classes
    btn.classList.remove("status-available", "status-occupied", "status-open");
    
    // Add current status class
    btn.classList.add(`status-${locker.status}`);
    
    // Disable if occupied or open (but not if already selected)
    if (locker.status === "occupied" || locker.status === "open") {
      if (!btn.classList.contains("selected")) {
        btn.disabled = true;
        btn.style.cursor = "not-allowed";
      }
    } else {
      btn.disabled = false;
      btn.style.cursor = "pointer";
    }
  });
}

// Setup locker grid click handlers
document.addEventListener("DOMContentLoaded", () => {
  // Deposit locker grid
  document.querySelectorAll("#deposit-locker-grid .locker-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      
      document.querySelectorAll("#deposit-locker-grid .locker-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedDepositLocker = parseInt(btn.dataset.locker);
      document.getElementById("deposit-locker").value = selectedDepositLocker;
    });
  });
  
  // Withdraw locker grid
  document.querySelectorAll("#withdraw-locker-grid .locker-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      
      document.querySelectorAll("#withdraw-locker-grid .locker-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedWithdrawLocker = parseInt(btn.dataset.locker);
      document.getElementById("withdraw-locker").value = selectedWithdrawLocker;
    });
  });
});

async function openDeposit() {
  const trackingCode = document.getElementById("deposit-tracking").value.trim();
  const lockerId = selectedDepositLocker;
  
  if (!trackingCode) {
    showToast("Entrez le code de suivi", "warning");
    return;
  }
  
  if (!lockerId || lockerId < 1 || lockerId > 15) {
    showToast("Sélectionnez un casier", "warning");
    return;
  }
  
  showLoading(true);
  
  try {
    const resp = await fetch("/api/deposit/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingCode, lockerId }),
    });
    
    const data = await resp.json();
    showLoading(false);
    
    if (resp.ok) {
      showToast("Casier ouvert", "success");
      depositState = { lockerId, closetId: data.closetId, trackingCode };
      document.getElementById("deposit-close").classList.remove("hidden");
      
      // Update status immediately
      updateLockerStatuses();
    } else {
      showToast(data.message || "Erreur", "error");
    }
  } catch (error) {
    showLoading(false);
    showToast("Erreur de connexion", "error");
  }
}

async function closeDeposit() {
  if (!depositState) return;
  
  showLoading(true);
  
  try {
    const resp = await fetch("/api/deposit/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(depositState),
    });
    
    const data = await resp.json();
    showLoading(false);
    
    if (resp.ok) {
      if (data.password) {
        showToast(`Mot de passe: ${data.password}`, "success");
      } else {
        showToast("Dépôt terminé", "success");
      }
      document.getElementById("deposit-close").classList.add("hidden");
      
      // Update status immediately
      updateLockerStatuses();
      
      setTimeout(() => {
        goHome();
      }, 4000);
    } else {
      showToast(data.message || "Erreur", "error");
    }
  } catch (error) {
    showLoading(false);
    showToast("Erreur de connexion", "error");
  }
}

async function openWithdraw() {
  const password = document.getElementById("withdraw-password").value.trim();
  const lockerId = selectedWithdrawLocker;
  
  if (!password) {
    showToast("Entrez le mot de passe", "warning");
    return;
  }
  
  if (!lockerId || lockerId < 1 || lockerId > 15) {
    showToast("Sélectionnez un casier", "warning");
    return;
  }
  
  showLoading(true);
  
  try {
    const resp = await fetch("/api/withdraw/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, lockerId }),
    });
    
    const data = await resp.json();
    showLoading(false);
    
    if (resp.ok) {
      showToast("Casier ouvert", "success");
      withdrawState = { lockerId, closetId: data.closetId };
      document.getElementById("withdraw-close").classList.remove("hidden");
      
      // Update status immediately
      updateLockerStatuses();
    } else {
      showToast(data.message || "Mot de passe invalide", "error");
    }
  } catch (error) {
    showLoading(false);
    showToast("Erreur de connexion", "error");
  }
}

async function closeWithdraw() {
  if (!withdrawState) return;
  
  showLoading(true);
  
  try {
    const resp = await fetch("/api/withdraw/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withdrawState),
    });
    
    const data = await resp.json();
    showLoading(false);
    
    if (resp.ok) {
      showToast("Retrait terminé", "success");
      document.getElementById("withdraw-close").classList.add("hidden");
      
      // Update status immediately
      updateLockerStatuses();
      
      setTimeout(() => {
        goHome();
      }, 3000);
    } else {
      showToast(data.message || "Erreur", "error");
    }
  } catch (error) {
    showLoading(false);
    showToast("Erreur de connexion", "error");
  }
}

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const homeScreen = document.getElementById("home-screen");
    if (homeScreen.classList.contains("hidden")) {
      goHome();
    }
  }
});
