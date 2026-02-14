const FT_STORAGE_KEY = "focustubes_state";
const GEMINI_KEY_STORAGE = "focustubes_gemini_key";

const ftRelevanceCache = new Map();

function loadFocusState() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(FT_STORAGE_KEY, (result) => {
      resolve(result[FT_STORAGE_KEY] || null);
    });
  });
}

function normalize(text) {
  return text.toLowerCase();
}

function buildKeywordProfile(state) {
  if (!state || !state.task) return null;
  const words = state.task
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2);

  const extras = [];
  switch (state.role) {
    case "student":
      extras.push("lecture", "tutorial", "study", "exam", "practice");
      break;
    case "programmer":
      extras.push("tutorial", "course", "walkthrough", "coding", "programming");
      break;
    case "teacher":
      extras.push("lesson", "classroom", "explained");
      break;
    case "researcher":
      extras.push("talk", "conference", "seminar", "paper");
      break;
    default:
      break;
  }

  const allKeywords = Array.from(new Set([...words, ...extras]));
  return {
    keywords: allKeywords,
    strictness: state.strictness || "medium",
    task: state.task,
    role: state.role
  };
}

function relevanceScore(profile, text) {
  if (!profile || !text) return 0;
  const target = normalize(text);
  let score = 0;
  for (const kw of profile.keywords) {
    if (!kw) continue;
    if (target.includes(kw)) {
      score += 1;
    }
  }
  return score;
}

function getThreshold(strictness) {
  switch (strictness) {
    case "high":
      return 2;
    case "low":
      return 0.5;
    case "medium":
    default:
      return 1;
  }
}

function getCurrentTimerState(timerState) {
  if (!timerState) return null;
  
  const now = Date.now();
  if (now >= timerState.endTime) {
    const nextPhase = timerState.phase === 'focus' ? 'break' : 'focus';
    const duration = nextPhase === 'focus' 
      ? timerState.focusDuration 
      : timerState.breakDuration;
    const newEndTime = now + (duration * 60 * 1000);
    
    return {
      ...timerState,
      phase: nextPhase,
      endTime: newEndTime
    };
  }
  
  return timerState;
}

function formatTimeRemaining(endTime) {
  const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function removeAllFiltering() {
  const videos = collectVideoElements();
  videos.forEach((el) => {
    el.classList.remove('focustubes-hidden', 'focustubes-highlight');
  });
  removeFocusModal();
}

function showTimerIndicator(timerState) {
  const current = getCurrentTimerState(timerState);
  if (!current) {
    removeTimerIndicator();
    return;
  }
  
  let indicator = document.getElementById('focustubes-timer-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'focustubes-timer-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: ${current.phase === 'focus' ? '#22c55e' : '#f59e0b'};
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      z-index: 999998;
      font-weight: 600;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    document.body.appendChild(indicator);
  }
  
  const timeRemaining = formatTimeRemaining(current.endTime);
  const phaseName = current.phase === 'focus' ? 'Focus' : 'Break';
  indicator.textContent = `${phaseName}: ${timeRemaining}`;
  indicator.style.background = current.phase === 'focus' ? '#22c55e' : '#f59e0b';
}

function removeTimerIndicator() {
  const indicator = document.getElementById('focustubes-timer-indicator');
  if (indicator) {
    indicator.remove();
  }
}

function loadGeminiApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(GEMINI_KEY_STORAGE, (result) => {
      resolve(result[GEMINI_KEY_STORAGE] || "");
    });
  });
}

function getVideoTitleFromElement(el) {
  const titleEl =
    el.querySelector("#video-title") ||
    el.querySelector("a#video-title-link") ||
    el.querySelector("h3 a") ||
    el.querySelector("a.ytd-rich-grid-media");

  if (!titleEl) return null;

  return titleEl.textContent || "";
}

async function decideWithLLM(engine, title) {
  const cacheKey = `${engine.profile.task}|${title}`;
  if (ftRelevanceCache.has(cacheKey)) {
    return ftRelevanceCache.get(cacheKey);
  }

  const prompt = [
    "You are a strict focus assistant.",
    "Given a user's current task and role, decide if a YouTube video will genuinely help with that task right now.",
    "Respond with exactly one word: 'on-topic' or 'off-topic'.",
    "",
    `User role: ${engine.profile.role || "unspecified"}.`,
    `Current task: ${engine.profile.task}.`,
    `YouTube video title: ${title}.`,
    "",
    "Is watching this video on-topic for their current task?"
  ].join("\n");

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0
    }
  };

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" +
        encodeURIComponent(engine.apiKey),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) throw new Error("Gemini request failed");
    const data = await res.json();
    const answer =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      (data.candidates[0].content.parts[0].text || "").toLowerCase();

    const isOnTopic = answer.includes("on-topic") && !answer.includes("off-topic");
    ftRelevanceCache.set(cacheKey, isOnTopic);
    return isOnTopic;
  } catch (e) {
    console.warn("FocusTubes: Gemini classification failed, falling back to keywords.", e);
    ftRelevanceCache.set(cacheKey, null);
    return null;
  }
}

async function markVideoElement(el, engine) {
  const title = getVideoTitleFromElement(el);
  if (!title) return;

  let isRelevant = false;

  if (engine.mode === "llm" && engine.apiKey) {
    const llmDecision = await decideWithLLM(engine, title);
    if (llmDecision !== null) {
      isRelevant = llmDecision;
    } else {
      const score = relevanceScore(engine.profile, title);
      isRelevant = score >= getThreshold(engine.profile.strictness);
    }
  } else {
    const score = relevanceScore(engine.profile, title);
    isRelevant = score >= getThreshold(engine.profile.strictness);
  }

  const FT_CLASS_HIDDEN = "focustubes-hidden";
  const FT_CLASS_HIGHLIGHT = "focustubes-highlight";

  el.classList.remove(FT_CLASS_HIDDEN, FT_CLASS_HIGHLIGHT);

  if (isRelevant) {
    el.classList.add(FT_CLASS_HIGHLIGHT);
  } else {
    el.classList.add(FT_CLASS_HIDDEN);
  }
}

function applyStylesIfNeeded() {
  if (document.getElementById("focustubes-style")) return;
  const style = document.createElement("style");
  style.id = "focustubes-style";
  style.textContent = `
    .focustubes-hidden {
      display: none !important;
    }
    .focustubes-highlight {
      position: relative;
      box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.6) !important;
      border-radius: 12px !important;
    }
    .focustubes-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
    }
    .focustubes-modal {
      max-width: 420px;
      width: 92%;
      background: #020617;
      border-radius: 16px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.7);
      padding: 18px 18px 14px;
      border: 1px solid rgba(148, 163, 184, 0.4);
      color: #e5e7eb;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .focustubes-modal-title {
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 6px;
    }
    .focustubes-modal-text {
      font-size: 13px;
      color: #9ca3af;
      margin: 0 0 10px;
    }
    .focustubes-modal-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 6px;
    }
    .focustubes-btn {
      border-radius: 999px;
      border: none;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .focustubes-btn-primary {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: #020617;
    }
    .focustubes-btn-ghost {
      background: transparent;
      color: #cbd5f5;
      border: 1px solid rgba(148, 163, 184, 0.5);
    }
  `;
  document.head.appendChild(style);
}

function collectVideoElements() {
  const selectors = [
    "ytd-rich-grid-media",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer"
  ];

  const elements = [];
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((el) => elements.push(el));
  }
  return elements;
}

async function runFocusFilter() {
  const [state, apiKey] = await Promise.all([
    loadFocusState(),
    loadGeminiApiKey()
  ]);
  
  if (state && state.timerEnabled && state.timerState) {
    const currentTimer = getCurrentTimerState(state.timerState);
    
    if (currentTimer && currentTimer !== state.timerState) {
      const updatedState = { ...state, timerState: currentTimer };
      chrome.storage.sync.set({ [FT_STORAGE_KEY]: updatedState });
    }
    
    if (currentTimer && currentTimer.phase === 'break') {
      removeAllFiltering();
      showTimerIndicator(currentTimer);
      return;
    }
    
    if (currentTimer) {
      showTimerIndicator(currentTimer);
    }
  } else {
    removeTimerIndicator();
  }
  
  const profile = buildKeywordProfile(state);
  if (!profile || !profile.keywords.length) {
    removeTimerIndicator();
    return;
  }

  applyStylesIfNeeded();

  const engine = {
    mode: apiKey ? "llm" : "keywords",
    apiKey,
    profile,
    state
  };

  const videos = collectVideoElements();
  videos.forEach((el) => markVideoElement(el, engine));

  await enforceWatchPageFocus(engine);
}

function getCurrentWatchTitle() {
  const selectors = [
    "h1.ytd-watch-metadata yt-formatted-string",
    "h1.title style-scope ytd-video-primary-info-renderer",
    "h1.ytd-video-primary-info-renderer"
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent) return el.textContent.trim();
  }
  return null;
}

function removeFocusModal() {
  const existing = document.getElementById("focustubes-modal-root");
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
}

function showFocusModal(engine, title) {
  const state = engine.state;
  if (document.getElementById("focustubes-modal-root")) return;

  const root = document.createElement("div");
  root.id = "focustubes-modal-root";
  root.className = "focustubes-modal-backdrop";

  const modal = document.createElement("div");
  modal.className = "focustubes-modal";

  const heading = document.createElement("h2");
  heading.className = "focustubes-modal-title";
  heading.textContent = "Stay on your FocusTube goal?";

  const text = document.createElement("p");
  text.className = "focustubes-modal-text";
  const taskText = state && state.task ? `"${state.task}"` : "your current focus";
  text.textContent =
    `This video looks unrelated to ${taskText}. ` +
    "Do you want to go back to focused content or continue anyway?";

  const buttons = document.createElement("div");
  buttons.className = "focustubes-modal-buttons";

  const backBtn = document.createElement("button");
  backBtn.className = "focustubes-btn focustubes-btn-primary";
  backBtn.textContent = "Back to focus";
  backBtn.addEventListener("click", () => {
    removeFocusModal();
    window.history.back();
  });

  const continueBtn = document.createElement("button");
  continueBtn.className = "focustubes-btn focustubes-btn-ghost";
  continueBtn.textContent = "Keep watching";
  continueBtn.addEventListener("click", () => {
    removeFocusModal();
  });

  buttons.appendChild(backBtn);
  buttons.appendChild(continueBtn);

  modal.appendChild(heading);
  modal.appendChild(text);
  modal.appendChild(buttons);

  root.appendChild(modal);
  document.body.appendChild(root);
}

async function enforceWatchPageFocus(engine) {
  if (!location.pathname.startsWith("/watch")) {
    removeFocusModal();
    return;
  }
  const title = getCurrentWatchTitle();
  if (!title) return;

  let isRelevant = false;
  if (engine.mode === "llm" && engine.apiKey) {
    const llmDecision = await decideWithLLM(engine, title);
    if (llmDecision !== null) {
      isRelevant = llmDecision;
    } else {
      const score = relevanceScore(engine.profile, title);
      const threshold = getThreshold(engine.profile.strictness);
      isRelevant = score >= threshold;
    }
  } else {
    const score = relevanceScore(engine.profile, title);
    const threshold = getThreshold(engine.profile.strictness);
    isRelevant = score >= threshold;
  }

  if (!isRelevant) {
    showFocusModal(engine, title);
  } else {
    removeFocusModal();
  }
}

function installObserver() {
  const observer = new MutationObserver(() => {
    runFocusFilter();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initial run
runFocusFilter();
installObserver();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes[FT_STORAGE_KEY]) {
    runFocusFilter();
  }
});

// Periodic timer check
setInterval(async () => {
  const state = await loadFocusState();
  if (state && state.timerEnabled && state.timerState) {
    const current = getCurrentTimerState(state.timerState);
    if (current && current !== state.timerState) {
      const updatedState = { ...state, timerState: current };
      chrome.storage.sync.set({ [FT_STORAGE_KEY]: updatedState });
      runFocusFilter();
    }
  }
}, 1000);

