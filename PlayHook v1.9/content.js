// Universal Video Shortcuts — v1.5
// Fix 1: shortcuts only fire when no Ctrl/Alt/Meta modifier is held.
// Fix 2: picks the video that's actually visible & playing (FB/IG/TikTok fix).
// Feature: configurable seek amount, set from the popup.
// Feature: Exclude Website / Exclude Website for this Tab / Pause / Pause for this Tab,
//          same pattern as the screenshot you shared.

// Prevents duplicate listeners if the script runs again
if (window.videoKeyHandler) {
  document.removeEventListener('keydown', window.videoKeyHandler, true);
}
if (window.videoStorageListener) {
  chrome.storage.onChanged.removeListener(window.videoStorageListener);
}
if (window.videoRuntimeMessageListener) {
  chrome.runtime.onMessage.removeListener(window.videoRuntimeMessageListener);
}

// ---------- State ----------
// Persistent (chrome.storage.sync) — survives reloads/restarts
window.videoSeekAmount = 5;
window.videoExtensionPaused = false;      // "Pause" — paused everywhere
window.videoExcludedWebsites = [];        // "Exclude Website" — hostname list

// Per-tab, in-memory only — resets on page reload/navigation, same as
// the "...for this Tab" checkboxes in the screenshot
window.videoPausedForTab = false;         // "Pause for this Tab"
window.videoExcludedForTab = false;       // "Exclude Website for this Tab"

chrome.storage.sync.get(
  { seekAmount: 5, extensionPaused: false, excludedWebsites: [] },
  items => {
    window.videoSeekAmount = items.seekAmount;
    window.videoExtensionPaused = items.extensionPaused;
    window.videoExcludedWebsites = items.excludedWebsites;
  }
);

window.videoStorageListener = (changes, area) => {
  if (area !== 'sync') return;
  if (changes.seekAmount) window.videoSeekAmount = changes.seekAmount.newValue;
  if (changes.extensionPaused) window.videoExtensionPaused = changes.extensionPaused.newValue;
  if (changes.excludedWebsites) window.videoExcludedWebsites = changes.excludedWebsites.newValue;
};
chrome.storage.onChanged.addListener(window.videoStorageListener);

// Messages from the popup for this specific tab
window.videoRuntimeMessageListener = (message, sender, sendResponse) => {
  if (message.type === 'video-shortcuts-set-tab-state') {
    if (typeof message.pausedForTab === 'boolean') window.videoPausedForTab = message.pausedForTab;
    if (typeof message.excludedForTab === 'boolean') window.videoExcludedForTab = message.excludedForTab;
    sendResponse({ ok: true });
  }
  if (message.type === 'video-shortcuts-get-tab-state') {
    sendResponse({
      pausedForTab: window.videoPausedForTab,
      excludedForTab: window.videoExcludedForTab
    });
  }
  return true;
};
chrome.runtime.onMessage.addListener(window.videoRuntimeMessageListener);

function isShortcutsActive() {
  if (window.videoPausedForTab) return false;
  if (window.videoExcludedForTab) return false;
  if (window.videoExtensionPaused) return false;
  if (window.videoExcludedWebsites.includes(location.hostname)) return false;
  return true;
}

// Finds the video the user is actually watching right now.
function getActiveVideo() {
  const videos = Array.from(document.querySelectorAll('video'));
  if (videos.length === 0) return null;
  if (videos.length === 1) return videos[0];

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportCenterY = viewportHeight / 2;
  const viewportCenterX = viewportWidth / 2;

  let best = null;
  let bestScore = -Infinity;

  for (const video of videos) {
    const rect = video.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.bottom < 0 || rect.top > viewportHeight) continue;
    if (rect.right < 0 || rect.left > viewportWidth) continue;

    const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    const visibleArea = Math.max(0, visibleWidth) * Math.max(0, visibleHeight);

    const videoCenterX = rect.left + rect.width / 2;
    const videoCenterY = rect.top + rect.height / 2;
    const distance = Math.hypot(videoCenterX - viewportCenterX, videoCenterY - viewportCenterY);

    let score = visibleArea - distance * 500;
    if (!video.paused && !video.ended) score += 10000000;

    if (score > bestScore) {
      bestScore = score;
      best = video;
    }
  }

  return best || videos[0];
}

window.videoKeyHandler = e => {
  if (!isShortcutsActive()) return;

  const v = getActiveVideo();
  if (!v) return;

  const tag = (e.target.tagName || '').toLowerCase();
  const isEditable = e.target.isContentEditable || tag === 'input' || tag === 'textarea';
  if (isEditable) return;

  if (e.ctrlKey || e.altKey || e.metaKey) return;

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    v.currentTime = Math.max(0, v.currentTime - window.videoSeekAmount);
  }

  else if (e.key === 'ArrowRight') {
    e.preventDefault();
    v.currentTime = Math.min(v.duration, v.currentTime + window.videoSeekAmount);
  }

  else if (e.code === 'Space') {
    e.preventDefault();
    if (v.paused) {
      v.play();
    } else {
      v.pause();
    }
  }

  else if (/^[0-9]$/.test(e.key)) {
    e.preventDefault();
    const percent = Number(e.key) * 10;
    v.currentTime = v.duration * percent / 100;
  }

  else if (e.key === '<' || e.key === '>') {
    e.preventDefault();
    const step = 0.25;

    if (e.key === '>') {
      v.playbackRate = Math.min(3, v.playbackRate + step);
    } else {
      v.playbackRate = Math.max(0.25, v.playbackRate - step);
    }

    let indicator = document.getElementById('speed-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'speed-indicator';
      indicator.style.cssText = `
        position:fixed;
        top:50%;
        left:50%;
        transform:translate(-50%,-50%);
        z-index:999999;
        background:rgba(0,0,0,.75);
        color:white;
        padding:12px 20px;
        border-radius:8px;
        font:600 18px Arial,sans-serif;
        pointer-events:none;
      `;
      document.body.appendChild(indicator);
    }

    indicator.textContent = `Speed: ${v.playbackRate}×`;
    indicator.style.display = 'block';
    clearTimeout(indicator.timer);
    indicator.timer = setTimeout(() => {
      indicator.style.display = 'none';
    }, 1000);
  }

  else if (e.key.toLowerCase() === 'm') {
    e.preventDefault();
    v.muted = !v.muted;
  }

  else if (e.key.toLowerCase() === 'f') {
    e.preventDefault();
    if (!document.fullscreenElement) {
      v.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }
};

document.addEventListener('keydown', window.videoKeyHandler, true);
