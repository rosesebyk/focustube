const STORAGE_KEY = "focustubes_state";
const MODEL_KEY_STORAGE = "focustubes_gemini_key";

function saveState(state) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: state }, () => resolve());
  });
}

function loadState() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

function saveApiKey(key) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [MODEL_KEY_STORAGE]: key }, () => resolve());
  });
}

function loadApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(MODEL_KEY_STORAGE, (result) => {
      resolve(result[MODEL_KEY_STORAGE] || "");
    });
  });
}

function startTimer(focusDuration, breakDuration) {
  const endTime = Date.now() + (focusDuration * 60 * 1000);
  return {
    phase: 'focus',
    endTime: endTime,
    focusDuration,
    breakDuration
  };
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

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("focus-form");
  const taskInput = document.getElementById("task");
  const roleSelect = document.getElementById("role");
  const strictnessSelect = document.getElementById("strictness");
  const statusEl = document.getElementById("status");
  const openaiKeyInput = document.getElementById("openai-key");
  
  const timerEnabledCheckbox = document.getElementById("timer-enabled");
  const timerSettings = document.getElementById("timer-settings");
  const focusDurationInput = document.getElementById("focus-duration");
  const breakDurationInput = document.getElementById("break-duration");
  const timerStatus = document.getElementById("timer-status");
  const timerControlBtn = document.getElementById("timer-control");

  const [existing, existingKey] = await Promise.all([
    loadState(),
    loadApiKey()
  ]);
  if (existing) {
    if (existing.task) taskInput.value = existing.task;
    if (existing.role) roleSelect.value = existing.role;
    if (existing.strictness) strictnessSelect.value = existing.strictness;
    
    if (existing.timerEnabled) {
      timerEnabledCheckbox.checked = true;
      timerSettings.style.display = "block";
    }
    if (existing.focusDuration) focusDurationInput.value = existing.focusDuration;
    if (existing.breakDuration) breakDurationInput.value = existing.breakDuration;
    
    statusEl.textContent = "Focus loaded. YouTube will stay aligned with this.";
  }
  if (existingKey) {
    openaiKeyInput.value = existingKey;
  }

  timerEnabledCheckbox.addEventListener("change", (e) => {
    timerSettings.style.display = e.target.checked ? "block" : "none";
  });

  const updateTimerStatus = async () => {
    const state = await loadState();
    if (state && state.timerEnabled && state.timerState) {
      const current = getCurrentTimerState(state.timerState);
      if (current) {
        const phaseName = current.phase === 'focus' ? 'Focus' : 'Break';
        timerStatus.textContent = `${phaseName} time: ${formatTimeRemaining(current.endTime)}`;
        timerControlBtn.textContent = "Pause Timer";
      } else {
        timerStatus.textContent = "";
        timerControlBtn.textContent = "Start Timer";
      }
    } else {
      timerStatus.textContent = "";
      timerControlBtn.textContent = "Start Timer";
    }
  };

  setInterval(updateTimerStatus, 1000);
  updateTimerStatus();

  timerControlBtn.addEventListener("click", async () => {
    const state = await loadState();
    if (state && state.timerState) {
      const newState = { ...state, timerState: null };
      await saveState(newState);
      timerControlBtn.textContent = "Start Timer";
      timerStatus.textContent = "";
    } else {
      const currentState = await loadState();
      const focusDur = parseInt(focusDurationInput.value) || 25;
      const breakDur = parseInt(breakDurationInput.value) || 10;
      const timerState = startTimer(focusDur, breakDur);
      const newState = { 
        ...currentState || {}, 
        timerState, 
        timerEnabled: true,
        focusDuration: focusDur,
        breakDuration: breakDur
      };
      await saveState(newState);
      timerControlBtn.textContent = "Pause Timer";
      updateTimerStatus();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const task = taskInput.value.trim();
    const role = roleSelect.value;
    const strictness = strictnessSelect.value;
    const apiKey = openaiKeyInput.value.trim();

    if (!task) {
      statusEl.textContent = "Please describe what you’re working on.";
      return;
    }

    const currentState = await loadState();
    const state = {
      task,
      role,
      strictness,
      updatedAt: Date.now(),
      timerEnabled: timerEnabledCheckbox.checked,
      focusDuration: parseInt(focusDurationInput.value) || 25,
      breakDuration: parseInt(breakDurationInput.value) || 10,
      timerState: currentState && currentState.timerState ? currentState.timerState : null
    };

    await Promise.all([saveState(state), saveApiKey(apiKey)]);
    statusEl.textContent =
      "Focus saved. Reload YouTube if it’s already open.";
  });
});

