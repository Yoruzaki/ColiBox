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
    document.getElementById("deposit-locker").value = "";
    document.getElementById("withdraw-password").value = "";
    document.getElementById("withdraw-locker").value = "";
    document.getElementById("deposit-result").textContent = "";
    document.getElementById("withdraw-result").textContent = "";
    document.getElementById("deposit-close").classList.add("hidden");
    document.getElementById("withdraw-close").classList.add("hidden");
  }, 300);
}

async function openDeposit() {
  const trackingCode = document.getElementById("deposit-tracking").value.trim();
  const lockerId = parseInt(document.getElementById("deposit-locker").value, 10);
  const result = document.getElementById("deposit-result");
  
  if (!trackingCode) {
    showMessage(result, "⚠️ Please enter a tracking code", "warning");
    return;
  }
  
  if (!lockerId || lockerId < 1 || lockerId > 15) {
    showMessage(result, "⚠️ Please select a valid locker", "warning");
    return;
  }
  
  showLoading(true);
  result.textContent = "🔄 Opening locker...";
  result.style.background = "rgba(99, 102, 241, 0.1)";
  result.style.border = "1px solid rgba(99, 102, 241, 0.3)";
  result.style.color = "#818cf8";
  
  try {
    const resp = await fetch("/api/deposit/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingCode, lockerId }),
    });
    
    const data = await resp.json();
    showLoading(false);
    
    if (resp.ok) {
      showMessage(result, `✅ ${data.message || "Locker opened successfully!"}`, "success");
      depositState = { lockerId, closetId: data.closetId, trackingCode };
      document.getElementById("deposit-close").classList.remove("hidden");
    } else {
      showMessage(result, `❌ ${data.message || "Failed to open locker"}`, "error");
    }
  } catch (error) {
    showLoading(false);
    showMessage(result, `❌ Connection error: ${error.message}`, "error");
  }
}

async function closeDeposit() {
  if (!depositState) return;
  
  const result = document.getElementById("deposit-result");
  showLoading(true);
  result.textContent = "🔄 Verifying and closing locker...";
  result.style.background = "rgba(99, 102, 241, 0.1)";
  result.style.border = "1px solid rgba(99, 102, 241, 0.3)";
  result.style.color = "#818cf8";
  
  try {
    const resp = await fetch("/api/deposit/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(depositState),
    });
    
    const data = await resp.json();
    showLoading(false);
    
    if (resp.ok) {
      let message = `✅ ${data.message || "Deposit complete!"}`;
      if (data.password) {
        message += `\n\n🔑 Your password: ${data.password}\n\n⚠️ Please save this password to retrieve your package!`;
      }
      showMessage(result, message, "success");
      document.getElementById("deposit-close").classList.add("hidden");
      
      // Auto-return to home after success
      setTimeout(() => {
        goHome();
      }, 5000);
    } else {
      showMessage(result, `❌ ${data.message || "Failed to close locker"}`, "error");
    }
  } catch (error) {
    showLoading(false);
    showMessage(result, `❌ Connection error: ${error.message}`, "error");
  }
}

async function openWithdraw() {
  const password = document.getElementById("withdraw-password").value.trim();
  const lockerId = parseInt(document.getElementById("withdraw-locker").value, 10);
  const result = document.getElementById("withdraw-result");
  
  if (!password) {
    showMessage(result, "⚠️ Please enter your password", "warning");
    return;
  }
  
  if (!lockerId || lockerId < 1 || lockerId > 15) {
    showMessage(result, "⚠️ Please select a valid locker", "warning");
    return;
  }
  
  showLoading(true);
  result.textContent = "🔄 Opening locker...";
  result.style.background = "rgba(99, 102, 241, 0.1)";
  result.style.border = "1px solid rgba(99, 102, 241, 0.3)";
  result.style.color = "#818cf8";
  
  try {
    const resp = await fetch("/api/withdraw/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, lockerId }),
    });
    
    const data = await resp.json();
    showLoading(false);
    
    if (resp.ok) {
      showMessage(result, `✅ ${data.message || "Locker opened successfully!"}`, "success");
      withdrawState = { lockerId, closetId: data.closetId };
      document.getElementById("withdraw-close").classList.remove("hidden");
    } else {
      showMessage(result, `❌ ${data.message || "Invalid password or locker"}`, "error");
    }
  } catch (error) {
    showLoading(false);
    showMessage(result, `❌ Connection error: ${error.message}`, "error");
  }
}

async function closeWithdraw() {
  if (!withdrawState) return;
  
  const result = document.getElementById("withdraw-result");
  showLoading(true);
  result.textContent = "🔄 Closing locker...";
  result.style.background = "rgba(99, 102, 241, 0.1)";
  result.style.border = "1px solid rgba(99, 102, 241, 0.3)";
  result.style.color = "#818cf8";
  
  try {
    const resp = await fetch("/api/withdraw/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withdrawState),
    });
    
    const data = await resp.json();
    showLoading(false);
    
    if (resp.ok) {
      showMessage(result, `✅ ${data.message || "Withdrawal complete!"}`, "success");
      document.getElementById("withdraw-close").classList.add("hidden");
      
      // Auto-return to home after success
      setTimeout(() => {
        goHome();
      }, 3000);
    } else {
      showMessage(result, `❌ ${data.message || "Failed to close locker"}`, "error");
    }
  } catch (error) {
    showLoading(false);
    showMessage(result, `❌ Connection error: ${error.message}`, "error");
  }
}

function showMessage(element, message, type = "info") {
  element.textContent = message;
  element.style.whiteSpace = "pre-line";
  
  switch (type) {
    case "success":
      element.style.background = "rgba(16, 185, 129, 0.1)";
      element.style.border = "1px solid rgba(16, 185, 129, 0.3)";
      element.style.color = "#10b981";
      break;
    case "error":
      element.style.background = "rgba(239, 68, 68, 0.1)";
      element.style.border = "1px solid rgba(239, 68, 68, 0.3)";
      element.style.color = "#ef4444";
      break;
    case "warning":
      element.style.background = "rgba(245, 158, 11, 0.1)";
      element.style.border = "1px solid rgba(245, 158, 11, 0.3)";
      element.style.color = "#f59e0b";
      break;
    default:
      element.style.background = "rgba(99, 102, 241, 0.1)";
      element.style.border = "1px solid rgba(99, 102, 241, 0.3)";
      element.style.color = "#818cf8";
  }
}

// Add keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const homeScreen = document.getElementById("home-screen");
    if (homeScreen.classList.contains("hidden")) {
      goHome();
    }
  }
});
