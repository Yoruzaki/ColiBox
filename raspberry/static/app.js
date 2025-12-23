let depositState = null;
let withdrawState = null;

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
  
  const currentScreen = document.querySelector(".screen:not(.hidden)");
  currentScreen.style.animation = "fadeOut 0.3s ease-out";
  
  setTimeout(() => {
    document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
    const homeScreen = document.getElementById("home-screen");
    homeScreen.classList.remove("hidden");
    homeScreen.style.animation = "fadeIn 0.4s ease-out";
    
    // Reset forms
    document.getElementById("deposit-tracking").value = "";
    document.getElementById("withdraw-password").value = "";
    document.getElementById("deposit-close").classList.add("hidden");
    document.getElementById("withdraw-close").classList.add("hidden");
    document.getElementById("deposit-password-display").classList.add("hidden");
  }, 300);
}

// Keypad functions
function keypadInput(type, digit) {
  const inputId = type === 'deposit' ? 'deposit-tracking' : 'withdraw-password';
  const input = document.getElementById(inputId);
  input.value += digit;
}

function keypadClear(type) {
  const inputId = type === 'deposit' ? 'deposit-tracking' : 'withdraw-password';
  const input = document.getElementById(inputId);
  input.value = input.value.slice(0, -1);
}

async function openDeposit() {
  const trackingCode = document.getElementById("deposit-tracking").value.trim();
  
  if (!trackingCode) {
    showToast("Entrez le code de suivi", "warning");
    return;
  }
  
  showLoading(true);
  
  try {
    // Le client envoie seulement le code de suivi
    // Le serveur décide quelle box utiliser
    const resp = await fetch("/api/deposit/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingCode }),
    });
    
    const data = await resp.json();
    showLoading(false);
    
    if (resp.ok) {
      // Le serveur retourne boxId (la box assignée)
      const boxId = data.boxId || data.lockerId; // fallback pour compatibilité
      const closetId = data.closetId;
      
      if (!boxId) {
        showToast("Erreur: boxId manquant", "error");
        return;
      }
      
      showToast("Box ouverte", "success");
      
      // Afficher le numéro de box
      document.getElementById("deposit-box-number").textContent = `Box ${boxId}`;
      document.getElementById("deposit-close").classList.remove("hidden");
      
      // Sauvegarder l'état
      depositState = { boxId, closetId, trackingCode };
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
      // Le serveur génère et retourne le mot de passe
      if (data.password) {
        document.getElementById("deposit-password").textContent = data.password;
        document.getElementById("deposit-password-display").classList.remove("hidden");
        document.getElementById("deposit-close").classList.add("hidden");
        showToast("Dépôt réussi", "success");
        
        // Retourner automatiquement après affichage du mot de passe
        setTimeout(() => {
          goHome();
        }, 8000);
      } else {
        showToast("Dépôt terminé", "success");
        setTimeout(() => {
          goHome();
        }, 3000);
      }
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
  
  if (!password) {
    showToast("Entrez le mot de passe", "warning");
    return;
  }
  
  showLoading(true);
  
  try {
    // Le client envoie seulement le mot de passe
    // Le serveur trouve la box correspondante
    const resp = await fetch("/api/withdraw/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    
    const data = await resp.json();
    showLoading(false);
    
    if (resp.ok) {
      // Le serveur retourne boxId (la box contenant le colis)
      const boxId = data.boxId || data.lockerId; // fallback pour compatibilité
      const closetId = data.closetId;
      
      if (!boxId) {
        showToast("Erreur: boxId manquant", "error");
        return;
      }
      
      showToast("Box ouverte", "success");
      
      // Afficher le numéro de box
      document.getElementById("withdraw-box-number").textContent = `Box ${boxId}`;
      document.getElementById("withdraw-close").classList.remove("hidden");
      
      // Sauvegarder l'état
      withdrawState = { boxId, closetId };
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
