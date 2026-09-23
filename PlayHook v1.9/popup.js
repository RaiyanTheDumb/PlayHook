const SEEK_VALUES = [1, 2, 3, 5, 7, 10, 30, 60, 300, 600];

function formatSeek(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = seconds / 60;
  return `${mins}min`;
}

const excludeWebsiteEl = document.getElementById('excludeWebsite');
const excludeWebsiteTabEl = document.getElementById('excludeWebsiteTab');
const pauseExtensionEl = document.getElementById('pauseExtension');
const pauseTabEl = document.getElementById('pauseTab');
const seekSlider = document.getElementById('seekSlider');
const seekTooltip = document.getElementById('seekTooltip');
const seekValLabel = document.getElementById('seekValLabel');
const hintText = document.getElementById('hintText');

const shortcutsHeader = document.getElementById('shortcutsHeader');
const shortcutsToggle = document.getElementById('shortcutsToggle');
const shortcutsList = document.getElementById('shortcutsList');
const shortcutsHint = document.getElementById('shortcutsHint');

let currentTabId = null;
let currentHostname = null;
let tabScriptAvailable = true;

// ---------- Collapsible shortcuts ----------
shortcutsHeader.addEventListener('click', () => {
  const isOpen = shortcutsList.classList.toggle('open');
  shortcutsToggle.classList.toggle('open', isOpen);
  shortcutsHint.style.display = isOpen ? 'none' : 'block';
});

// ---------- Keyhole seek slider ----------
function updateTooltipPosition() {
  const min = Number(seekSlider.min);
  const max = Number(seekSlider.max);
  const val = Number(seekSlider.value);
  const percent = (val - min) / (max - min);

  seekSlider.style.setProperty('--fill', `${percent * 100}%`);

  const thumbWidth = 20;
  const offsetPx = (0.5 - percent) * thumbWidth;
  const leftPercent = percent * 100;

  seekTooltip.style.left = `calc(${leftPercent}% + ${offsetPx}px)`;
  const label = formatSeek(SEEK_VALUES[val]);
  seekTooltip.textContent = label;
  seekValLabel.textContent = label;
}

seekSlider.addEventListener('input', () => {
  updateTooltipPosition();
  const seconds = SEEK_VALUES[Number(seekSlider.value)];
  chrome.storage.sync.set({ seekAmount: seconds });
});

// ---------- Load persistent (site-wide) settings ----------
chrome.storage.sync.get(
  { seekAmount: 10, extensionPaused: false, excludedWebsites: [] },
  items => {
    const idx = SEEK_VALUES.indexOf(items.seekAmount);
    seekSlider.value = idx === -1 ? 5 : idx;
    updateTooltipPosition();

    pauseExtensionEl.checked = items.extensionPaused;

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (!tab || !tab.url) return;

      currentTabId = tab.id;
      try {
        currentHostname = new URL(tab.url).hostname;
      } catch (err) {
        currentHostname = null;
      }

      excludeWebsiteEl.checked = currentHostname
        ? items.excludedWebsites.includes(currentHostname)
        : false;

      if (!currentHostname) {
        document.getElementById('excludeWebsiteRow').classList.add('disabled');
        document.getElementById('excludeWebsiteTabRow').classList.add('disabled');
      }

      chrome.tabs.sendMessage(
        currentTabId,
        { type: 'video-shortcuts-get-tab-state' },
        response => {
          if (chrome.runtime.lastError || !response) {
            tabScriptAvailable = false;
            document.getElementById('excludeWebsiteTabRow').classList.add('disabled');
            document.getElementById('pauseTabRow').classList.add('disabled');
            hintText.textContent = "This page doesn't support video shortcuts.";
            return;
          }
          excludeWebsiteTabEl.checked = !!response.excludedForTab;
          pauseTabEl.checked = !!response.pausedForTab;
          document.getElementById('excludeWebsiteTabRow').classList.remove('disabled');
          document.getElementById('pauseTabRow').classList.remove('disabled');
        }
      );
    });
  }
);

function sendTabState(partial) {
  if (!tabScriptAvailable || currentTabId === null) return;
  chrome.tabs.sendMessage(currentTabId, {
    type: 'video-shortcuts-set-tab-state',
    ...partial
  });
}

// ---------- Checkbox handlers ----------
excludeWebsiteEl.addEventListener('change', () => {
  if (!currentHostname) return;
  chrome.storage.sync.get({ excludedWebsites: [] }, items => {
    let list = items.excludedWebsites;
    if (excludeWebsiteEl.checked) {
      if (!list.includes(currentHostname)) list.push(currentHostname);
    } else {
      list = list.filter(h => h !== currentHostname);
    }
    chrome.storage.sync.set({ excludedWebsites: list });
  });
});

excludeWebsiteTabEl.addEventListener('change', () => {
  sendTabState({ excludedForTab: excludeWebsiteTabEl.checked });
});

pauseExtensionEl.addEventListener('change', () => {
  chrome.storage.sync.set({ extensionPaused: pauseExtensionEl.checked });
});

pauseTabEl.addEventListener('change', () => {
  sendTabState({ pausedForTab: pauseTabEl.checked });
});
