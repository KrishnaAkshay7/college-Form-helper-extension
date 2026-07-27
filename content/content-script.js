/**
 * content-script.js
 * ------------------
 * Loaded on every page (per manifest.json), but does NOTHING until it
 * receives a message from the popup. Two modes:
 *
 *   1. "autofill"   — smart scan of the page, fills every input it can
 *                      confidently match to a saved field.
 *   2. "armPick"    — manual fallback: shows a small banner, waits for the
 *                      user to click one input on the page, fills just that
 *                      one with the given value.
 *
 * Relies on constants.js and utils.js being loaded first (see manifest.json
 * content_scripts "js" array order).
 */

const FILLABLE_SELECTOR = "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]), textarea, select";
const MATCH_THRESHOLD = 1; // minimum score to accept a match

/** Finds all fillable, visible elements on the current page. */
function getFillableElements() {
  return Array.from(document.querySelectorAll(FILLABLE_SELECTOR)).filter((el) => {
    const rects = el.getClientRects();
    return rects.length > 0 && !el.disabled && !el.readOnly;
  });
}

/**
 * Greedy best-match assignment: for each field (in the order given),
 * find the best-scoring unused input above the threshold.
 */
function smartAutofill(fields, values) {
  const inputs = getFillableElements();
  const inputScores = inputs.map((el) => ({ el, identifier: collectInputIdentifiers(el) }));
  const usedInputs = new Set();

  let filledCount = 0;
  const unmatchedFieldIds = [];

  for (const field of fields) {
    const value = values[field.id];
    if (!value) continue; // nothing to fill for this field

    let bestEl = null;
    let bestScore = 0;

    for (const { el, identifier } of inputScores) {
      if (usedInputs.has(el)) continue;
      const score = scoreFieldMatch(field, identifier);
      if (score > bestScore) {
        bestScore = score;
        bestEl = el;
      }
    }

    if (bestEl && bestScore >= MATCH_THRESHOLD) {
      applyValueToElement(bestEl, value);
      usedInputs.add(bestEl);
      filledCount += 1;
    } else {
      unmatchedFieldIds.push(field.id);
    }
  }

  return { filledCount, unmatchedFieldIds, totalInputsOnPage: inputs.length };
}

/** Handles select elements (match by option text) vs regular text inputs. */
function applyValueToElement(el, value) {
  if (el.tagName === "SELECT") {
    const options = Array.from(el.options);
    const match = options.find(
      (opt) => normalizeText(opt.textContent) === normalizeText(value) || normalizeText(opt.value) === normalizeText(value)
    );
    if (match) {
      el.value = match.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } else {
    fillInputAndNotify(el, value);
  }
  flashElement(el);
}

/** Brief highlight so the user can see which fields got filled. */
function flashElement(el) {
  const originalOutline = el.style.outline;
  const originalTransition = el.style.transition;
  el.style.transition = "outline 0.2s ease";
  el.style.outline = "2px solid #4F46E5";
  setTimeout(() => {
    el.style.outline = originalOutline;
    el.style.transition = originalTransition;
  }, 900);
}

// ---------------------------------------------------------------------------
// Manual "point and click" fallback mode
// ---------------------------------------------------------------------------
let pickModeCleanup = null;

function armPickMode(fieldLabel, value) {
  cancelPickMode(); // only one active at a time

  const banner = document.createElement("div");
  banner.textContent = `College Helper: click a field to fill it with "${fieldLabel}" — press Esc to cancel`;
  Object.assign(banner.style, {
    position: "fixed",
    top: "12px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#4F46E5",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: "8px",
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
    zIndex: 2147483647,
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
  });
  document.body.appendChild(banner);

  const clickHandler = (e) => {
    const target = e.target;
    if (target.matches && target.matches(FILLABLE_SELECTOR)) {
      e.preventDefault();
      e.stopPropagation();
      applyValueToElement(target, value);
      cancelPickMode();
    }
  };

  const escHandler = (e) => {
    if (e.key === "Escape") cancelPickMode();
  };

  document.addEventListener("click", clickHandler, true);
  document.addEventListener("keydown", escHandler, true);

  pickModeCleanup = () => {
    banner.remove();
    document.removeEventListener("click", clickHandler, true);
    document.removeEventListener("keydown", escHandler, true);
    pickModeCleanup = null;
  };
}

function cancelPickMode() {
  if (pickModeCleanup) pickModeCleanup();
}

// ---------------------------------------------------------------------------
// Message listener — the popup talks to this page through here
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "autofill") {
    const result = smartAutofill(message.fields, message.values);
    sendResponse(result);
  } else if (message.action === "armPick") {
    armPickMode(message.fieldLabel, message.value);
    sendResponse({ armed: true });
  }
  return true; // keep the message channel open for async sendResponse
});
