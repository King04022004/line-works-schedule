const el = {
  actorUserId: document.getElementById("actorUserId"),
  durationMinutes: document.getElementById("durationMinutes"),
  participants: document.getElementById("participants"),
  rangeFrom: document.getElementById("rangeFrom"),
  rangeTo: document.getElementById("rangeTo"),
  excludeWeekends: document.getElementById("excludeWeekends"),
  searchBtn: document.getElementById("searchBtn"),
  searchSummary: document.getElementById("searchSummary"),
  candidates: document.getElementById("candidates"),
  confirmSlot: document.getElementById("confirmSlot"),
  eventTitle: document.getElementById("eventTitle"),
  calendarId: document.getElementById("calendarId"),
  createBtn: document.getElementById("createBtn"),
  loginBtn: document.getElementById("loginBtn"),
  authStatus: document.getElementById("authStatus"),
  log: document.getElementById("log")
};

let selectedCandidate = null;
let lastParticipants = [];

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
  if (isError) {
    el.searchSummary.classList.add("danger");
  } else {
    el.searchSummary.classList.remove("danger");
  }
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
        <div><strong>${c.start}</strong> - <strong>${c.end}</strong></div>
        <div class="status">${c.participantUserIds.join(", ")}</div>
      </div>
      <button type="button">この日時を選択</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      selectedCandidate = c;
      document.querySelectorAll(".slot").forEach((x) => x.classList.remove("selected"));
      row.classList.add("selected");
      el.confirmSlot.textContent = `${c.start} - ${c.end}`;
      el.createBtn.disabled = false;
    });
    el.candidates.appendChild(row);
  }
}

async function refreshAuthStatus() {
  try {
    const s = await api("/api/v1/auth/status");
    if (s.loggedIn) {
      el.authStatus.textContent = "OAuthログイン済みです。予定登録できます。";
      el.loginBtn.textContent = "再ログイン";
    } else {
      el.authStatus.textContent = "初回はLINE WORKSログインが必要です。";
      el.loginBtn.textContent = "LINE WORKSでログイン";
    }
  } catch {
    el.authStatus.textContent = "認証状態を取得できませんでした。";
  }
}

function loginUrl() {
  return `/api/v1/auth/login?returnTo=${encodeURIComponent("/woff")}`;
}

el.searchBtn.addEventListener("click", async () => {
  try {
    const participants = el.participants.value
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean);
    lastParticipants = participants;
    const body = {
      actorUserId: el.actorUserId.value.trim() || "me",
      participantUserIds: participants,
      durationMinutes: Number(el.durationMinutes.value),
      range: {
        from: fmtISOFromLocal(el.rangeFrom.value),
        to: fmtISOFromLocal(el.rangeTo.value)
      },
      options: {
        businessHours: { start: "09:00", end: "18:00" },
        excludeWeekends: el.excludeWeekends.checked,
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
        participantUserIds: lastParticipants,
        start: selectedCandidate.start,
        end: selectedCandidate.end
      })
    });
    if (!recheck.available) {
      throw new Error(`再判定NG: ${recheck.conflicts?.join(", ") || "conflict"}`);
    }

    const idempotencyKey = `${selectedCandidate.candidateId}_${el.actorUserId.value || "me"}`;
    const event = await api("/api/v1/events", {
      method: "POST",
      body: JSON.stringify({
        actorUserId: el.actorUserId.value.trim() || "me",
        calendarId: el.calendarId.value.trim() || "me",
        title: el.eventTitle.value.trim() || "打ち合わせ",
        start: selectedCandidate.start,
        end: selectedCandidate.end,
        participantUserIds: lastParticipants,
        idempotencyKey
      })
    });
    writeLog(`予定登録成功: ${event.eventId}`);
    el.searchSummary.textContent = "予定を登録しました。";
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (m.includes("User OAuth login required")) {
      el.searchSummary.textContent = "ログインが必要です。「LINE WORKSでログイン」を押してください。";
    }
    writeLog(`予定登録失敗: ${m}`, true);
    el.searchSummary.textContent = `予定登録失敗: ${m}`;
  } finally {
    el.createBtn.disabled = false;
  }
});

el.loginBtn.addEventListener("click", () => {
  window.location.href = loginUrl();
});

const params = new URLSearchParams(window.location.search);
if (params.get("auth") === "ok") {
  writeLog("OAuthログインが完了しました。");
}

defaultDateRange();
refreshAuthStatus();
