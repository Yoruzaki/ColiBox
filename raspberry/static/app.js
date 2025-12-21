let depositState = null;
let withdrawState = null;

function showFlow(flow) {
  document.getElementById("home-screen").classList.add("hidden");
  document.getElementById(`${flow}-screen`).classList.remove("hidden");
}

function goHome() {
  depositState = null;
  withdrawState = null;
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  document.getElementById("home-screen").classList.remove("hidden");
}

async function openDeposit() {
  const trackingCode = document.getElementById("deposit-tracking").value.trim();
  const lockerId = parseInt(document.getElementById("deposit-locker").value, 10);
  const result = document.getElementById("deposit-result");
  result.textContent = "Requesting...";
  const resp = await fetch("/api/deposit/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackingCode, lockerId }),
  });
  const data = await resp.json();
  result.textContent = data.message || JSON.stringify(data);
  if (resp.ok) {
    depositState = { lockerId, closetId: data.closetId, trackingCode };
    document.getElementById("deposit-close").classList.remove("hidden");
  }
}

async function closeDeposit() {
  if (!depositState) return;
  const result = document.getElementById("deposit-result");
  result.textContent = "Verifying and closing...";
  const resp = await fetch("/api/deposit/close", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(depositState),
  });
  const data = await resp.json();
  result.textContent = data.message || JSON.stringify(data);
  if (resp.ok && data.password) {
    result.textContent += ` | Password: ${data.password}`;
    document.getElementById("deposit-close").classList.add("hidden");
  }
}

async function openWithdraw() {
  const password = document.getElementById("withdraw-password").value.trim();
  const lockerId = parseInt(document.getElementById("withdraw-locker").value, 10);
  const result = document.getElementById("withdraw-result");
  result.textContent = "Requesting...";
  const resp = await fetch("/api/withdraw/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, lockerId }),
  });
  const data = await resp.json();
  result.textContent = data.message || JSON.stringify(data);
  if (resp.ok) {
    withdrawState = { lockerId, closetId: data.closetId };
    document.getElementById("withdraw-close").classList.remove("hidden");
  }
}

async function closeWithdraw() {
  if (!withdrawState) return;
  const result = document.getElementById("withdraw-result");
  result.textContent = "Closing...";
  const resp = await fetch("/api/withdraw/close", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withdrawState),
  });
  const data = await resp.json();
  result.textContent = data.message || JSON.stringify(data);
  if (resp.ok) {
    document.getElementById("withdraw-close").classList.add("hidden");
  }
}

