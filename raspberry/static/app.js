let depositState = null;
let withdrawState = null;
let selectedDepositLocker = null;
let selectedWithdrawLocker = null;

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

// Setup locker grid click handlers
document.addEventListener("DOMContentLoaded", () => {
  // Deposit locker grid
  document.querySelectorAll("#deposit-locker-grid .locker-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
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
