let depositState = null;
let withdrawState = null;
let selectedDepositLocker = null;
let selectedWithdrawLocker = null;
let statusPollingInterval = null;
let lockerStatuses = {};

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
    
    // Refresh status when entering a flow
    fetchLockerStatus();
  }, 300);
}

function goHome() {
  depositState = null;
  withdrawState = null;
  selectedDepositLocker = null;
  selectedWithdrawLocker = null;
  
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

// Fetch locker statuses from server + sensors
async function fetchLockerStatus() {
  try {
    const resp = await fetch("/api/lockers/status");
    if (resp.ok) {
      const data = await resp.json();
      if (data.lockers) {
        lockerStatuses = {};
        data.lockers.forEach(locker => {
          lockerStatuses[locker.id] = locker.status;
        });
        updateLockerGrid();
        
        // Auto-detect locker closure during deposit/withdraw
        if (depositState && lockerStatuses[depositState.lockerId] === "occupied") {
          // Locker was closed with package, auto-trigger close
          autoCloseDeposit();
        }
        if (withdrawState && lockerStatuses[withdrawState.lockerId] === "available") {
          // Locker was closed after withdrawal, auto-trigger close
          autoCloseWithdraw();
        }
      }
    }
  } catch (error) {
    console.error("Error fetching locker status:", error);
  }
}

// Update grid visual states
function updateLockerGrid() {
  document.querySelectorAll(".locker-btn").forEach(btn => {
    const lockerId = parseInt(btn.dataset.locker);
    const status = lockerStatuses[lockerId] || "available";
    
    // Remove all status classes
    btn.classList.remove("status-available", "status-occupied", "status-open");
    
    // Add current status class
    btn.classList.add(`status-${status}`);
    
    // Disable occupied lockers for deposits
    if (status === "occupied" && btn.closest("#deposit-locker-grid")) {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    } else {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    }
  });
}

// Start/stop status polling
function startStatusPolling() {
  if (statusPollingInterval) return;
  fetchLockerStatus(); // Immediate fetch
  statusPollingInterval = setInterval(fetchLockerStatus, 6000); // Every 6 seconds
}

function stopStatusPolling() {
  if (statusPollingInterval) {
    clearInterval(statusPollingInterval);
    statusPollingInterval = null;
  }
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
      document.querySelectorAll("#withdraw-locker-grid .locker-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedWithdrawLocker = parseInt(btn.dataset.locker);
      document.getElementById("withdraw-locker").value = selectedWithdrawLocker;
    });
  });
  
  // Start status polling
  startStatusPolling();
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
      depositState = null;
      
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

// Auto-close deposit when sensor detects closed door
async function autoCloseDeposit() {
  if (!depositState) return;
  
  // Check if already processing
  if (document.getElementById("deposit-close").classList.contains("hidden")) {
    return;
  }
  
  // Auto-trigger close
  await closeDeposit();
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
      withdrawState = null;
      
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

// Auto-close withdraw when sensor detects closed door
async function autoCloseWithdraw() {
  if (!withdrawState) return;
  
  // Check if already processing
  if (document.getElementById("withdraw-close").classList.contains("hidden")) {
    return;
  }
  
  // Auto-trigger close
  await closeWithdraw();
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
