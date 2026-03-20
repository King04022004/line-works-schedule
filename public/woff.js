const el = {
  durationMinutes: document.getElementById("durationMinutes"),
  excludeWeekends: document.getElementById("excludeWeekends"),
  memberSearch: document.getElementById("memberSearch"),
  memberOptions: document.getElementById("memberOptions"),
  selectedMembers: document.getElementById("selectedMembers"),
  rangeFrom: document.getElementById("rangeFrom"),
  rangeTo: document.getElementById("rangeTo"),
  searchBtn: document.getElementById("searchBtn"),
  searchSummary: document.getElementById("searchSummary"),
  candidates: document.getElementById("candidates"),
  confirmSlot: document.getElementById("confirmSlot"),
  eventTitle: document.getElementById("eventTitle"),
  createBtn: document.getElementById("createBtn"),
  loginBtn: document.getElementById("loginBtn"),
  authStatus: document.getElementById("authStatus"),
  log: document.getElementById("log"),
  authModal: document.getElementById("authModal"),
  modalLoginBtn: document.getElementById("modalLoginBtn"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
  successModal: document.getElementById("successModal"),
  successMessage: document.getElementById("successMessage"),
  successCloseBtn: document.getElementById("successCloseBtn")
};

let selectedCandidate = null;
let selectedMemberIds = [];
let allMembers = [];
let loggedIn = false;

function fmtISOFromLocal(localText) {
  if (!localText) return null;
  return `${localText}:00+09:00`;
}

function defaultDateRange() {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const toLocalText = (d) => {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T00:00`;
  };
  el.rangeFrom.value = toLocalText(now);
  el.rangeTo.value = toLocalText(in7);
}

function writeLog(message, isError = false) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  el.log.textContent = `${line}\n${el.log.textContent}`;
  if (isError) el.searchSummary.classList.add("danger");
  else el.searchSummary.classList.remove("danger");
}

function loginUrl() {
  return `/api/v1/auth/login?returnTo=${encodeURIComponent("/woff")}`;
}

function formatSlotText(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateFmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
  const timeFmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return `${dateFmt.format(start)} ${timeFmt.format(start)} - ${timeFmt.format(end)}`;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function renderSelectedMembers() {
  const selected = allMembers.filter((m) => selectedMemberIds.includes(m.id));
  if (!selected.length) {
    el.selectedMembers.innerHTML = "<span class=\"status\">2名以上選択してください。</span>";
    return;
  }
  el.selectedMembers.innerHTML = selected.map((m) => `<span class=\"chip\">${m.name}</span>`).join("");
}

function toggleMember(id) {
  if (selectedMemberIds.includes(id)) {
    selectedMemberIds = selectedMemberIds.filter((x) => x !== id);
  } else {
    selectedMemberIds.push(id);
  }
  renderMemberOptions(el.memberSearch.value.trim());
  renderSelectedMembers();
}

function renderMemberOptions(keyword = "") {
  const q = keyword.toLowerCase();
  const filtered = allMembers.filter((m) => {
    const t = `${m.name}`.toLowerCase();
    return !q || t.includes(q);
  });

  if (!filtered.length) {
    el.memberOptions.innerHTML = "<div class=\"member-row\">候補がありません</div>";
    return;
  }

  el.memberOptions.innerHTML = "";
  for (const m of filtered) {
    const row = document.createElement("div");
    row.className = "member-row";
    const checked = selectedMemberIds.includes(m.id) ? "checked" : "";
    row.innerHTML = `
      <div>
        <div>${m.name}</div>
      </div>
      <input type="checkbox" ${checked} />
    `;
    row.querySelector("input").addEventListener("change", () => toggleMember(m.id));
    row.addEventListener("click", (e) => {
      if (e.target?.tagName !== "INPUT") toggleMember(m.id);
    });
    el.memberOptions.appendChild(row);
  }
}

function setAuthUi(isLoggedIn) {
  loggedIn = isLoggedIn;
  if (isLoggedIn) {
    el.authStatus.textContent = "OAuthログイン済みです。予定登録できます。";
    el.loginBtn.textContent = "再ログイン";
    el.authModal.classList.add("hidden");
  } else {
    el.authStatus.textContent = "初回はLINE WORKSログインが必要です。";
    el.loginBtn.textContent = "LINE WORKSでログイン";
    el.authModal.classList.remove("hidden");
  }
}

async function refreshAuthStatus() {
  try {
    const s = await api("/api/v1/auth/status");
    setAuthUi(!!s.loggedIn);
  } catch {
    el.authStatus.textContent = "認証状態を取得できませんでした。";
    setAuthUi(false);
  }
}

async function loadMembers() {
  try {
    const data = await api("/api/v1/members?limit=100");
    allMembers = data.items || [];
    selectedMemberIds = allMembers.slice(0, 2).map((x) => x.id);
    renderMemberOptions("");
    renderSelectedMembers();
  } catch (e) {
    writeLog(`メンバー一覧取得失敗: ${e instanceof Error ? e.message : String(e)}`, true);
  }
}

function renderCandidates(candidates) {
  el.candidates.innerHTML = "";
  if (!candidates.length) {
    el.candidates.innerHTML = `<p class="status">候補が見つかりませんでした。</p>`;
    return;
  }

  for (const c of candidates) {
    const row = document.createElement("div");
    row.className = "slot";
    row.innerHTML = `
      <div>
        <div><strong>${formatSlotText(c.start, c.end)}</strong></div>
      </div>
      <button type="button">この日時を選択</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      selectedCandidate = c;
      document.querySelectorAll(".slot").forEach((x) => x.classList.remove("selected"));
      row.classList.add("selected");
      el.confirmSlot.textContent = formatSlotText(c.start, c.end);
      el.createBtn.disabled = false;
    });
    el.candidates.appendChild(row);
  }
}

el.searchBtn.addEventListener("click", async () => {
  try {
    if (selectedMemberIds.length < 2) {
      throw new Error("参加メンバーを2名以上選択してください。");
    }

    const body = {
      actorUserId: "me",
      participantUserIds: selectedMemberIds,
      durationMinutes: Number(el.durationMinutes.value),
      range: {
        from: fmtISOFromLocal(el.rangeFrom.value),
        to: fmtISOFromLocal(el.rangeTo.value)
      },
      options: {
        businessHours: { start: "09:00", end: "18:00" },
        excludeWeekends: el.excludeWeekends.value === "true",
        resultLimit: 5
      }
    };

    const result = await api("/api/v1/availability/search", {
      method: "POST",
      body: JSON.stringify(body)
    });
    renderCandidates(result.candidates || []);
    el.searchSummary.textContent = `候補 ${result.total} 件`;
    writeLog(`候補検索成功: ${result.total}件`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    el.searchSummary.textContent = `候補検索失敗: ${m}`;
    writeLog(`候補検索失敗: ${m}`, true);
  }
});

el.createBtn.addEventListener("click", async () => {
  if (!selectedCandidate) return;
  el.createBtn.disabled = true;
  try {
    const recheck = await api("/api/v1/availability/recheck", {
      method: "POST",
      body: JSON.stringify({
        participantUserIds: selectedMemberIds,
        start: selectedCandidate.start,
        end: selectedCandidate.end
      })
    });
    if (!recheck.available) {
      throw new Error(`再判定NG: ${recheck.conflicts?.join(", ") || "conflict"}`);
    }

    const idempotencyKey = `${selectedCandidate.candidateId}_me`;
    const event = await api("/api/v1/events", {
      method: "POST",
      body: JSON.stringify({
        actorUserId: "me",
        calendarId: "me",
        title: el.eventTitle.value.trim() || "打ち合わせ",
        start: selectedCandidate.start,
        end: selectedCandidate.end,
        participantUserIds: selectedMemberIds,
        idempotencyKey
      })
    });
    writeLog(`予定登録成功: ${event.eventId}`);
    el.searchSummary.textContent = "予定を登録しました。";
    const when = formatSlotText(selectedCandidate.start, selectedCandidate.end);
    const title = el.eventTitle.value.trim() || "打ち合わせ";
    el.successMessage.textContent = `${when} の予定に「${title}」を登録しました。`;
    el.successModal.classList.remove("hidden");
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (m.includes("User OAuth login required")) {
      setAuthUi(false);
      el.searchSummary.textContent = "ログインが必要です。「LINE WORKSでログイン」を押してください。";
    } else {
      el.searchSummary.textContent = `予定登録失敗: ${m}`;
    }
    writeLog(`予定登録失敗: ${m}`, true);
  } finally {
    el.createBtn.disabled = false;
  }
});

el.memberSearch.addEventListener("input", () => {
  renderMemberOptions(el.memberSearch.value.trim());
});

el.loginBtn.addEventListener("click", () => {
  window.location.href = loginUrl();
});

el.modalLoginBtn.addEventListener("click", () => {
  window.location.href = loginUrl();
});

el.modalCloseBtn.addEventListener("click", () => {
  el.authModal.classList.add("hidden");
});

el.successCloseBtn.addEventListener("click", () => {
  el.successModal.classList.add("hidden");
});

const params = new URLSearchParams(window.location.search);
if (params.get("auth") === "ok") {
  writeLog("OAuthログインが完了しました。");
}

defaultDateRange();
loadMembers();
refreshAuthStatus();

