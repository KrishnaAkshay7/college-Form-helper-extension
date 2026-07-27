/**
 * utils.js
 * --------
 * Small helper functions shared between popup.js and content-script.js.
 * No browser-storage or DOM-specific popup code here — keep this file
 * usable in both contexts.
 */

/** Lowercase + strip punctuation, for loose text comparisons. */
function normalizeText(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Debounce helper — used by the search/filter input in the popup so we
 * don't re-render the whole list on every single keystroke.
 */
function debounce(fn, delay = 150) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Collects every bit of identifying text for a form input element:
 * its name, id, placeholder, aria-label, and any associated <label> text
 * (both via `for=` and by being a wrapping parent).
 * Returns one normalized string combining all of them.
 */
function collectInputIdentifiers(inputEl) {
  const parts = [];

  if (inputEl.name) parts.push(inputEl.name);
  if (inputEl.id) parts.push(inputEl.id);
  if (inputEl.placeholder) parts.push(inputEl.placeholder);
  if (inputEl.getAttribute("aria-label")) parts.push(inputEl.getAttribute("aria-label"));

  // <label for="inputId">
  if (inputEl.id) {
    const linkedLabel = document.querySelector(`label[for="${CSS.escape(inputEl.id)}"]`);
    if (linkedLabel) parts.push(linkedLabel.textContent);
  }

  // Wrapping <label><input/>Some text</label>
  const parentLabel = inputEl.closest("label");
  if (parentLabel) parts.push(parentLabel.textContent);

  // A preceding sibling label-ish element (common on custom-styled forms)
  const prev = inputEl.previousElementSibling;
  if (prev && /label|span|div|p/i.test(prev.tagName) && prev.textContent.trim().length < 60) {
    parts.push(prev.textContent);
  }

  return normalizeText(parts.join(" "));
}

/**
 * Scores how well one field definition matches one input's identifier text.
 * Score = number of keyword hits. Longer/more specific keyword matches
 * (multi-word phrases) count extra, since they're less likely to be a
 * coincidental match than a single generic word like "name".
 */
function scoreFieldMatch(field, identifierText) {
  if (!field.keywords || field.keywords.length === 0) return 0;
  let score = 0;
  for (const keyword of field.keywords) {
    if (identifierText.includes(keyword)) {
      score += keyword.includes(" ") ? 2 : 1;
    }
  }
  return score;
}

/**
 * Dispatches the events React/Vue/Angular-based forms listen for, so the
 * page's own JS "sees" the value we just set (plain `.value =` alone is
 * often ignored by modern framework-controlled inputs).
 */
function fillInputAndNotify(inputEl, value) {
  const proto = Object.getPrototypeOf(inputEl);
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (nativeSetter) {
    nativeSetter.call(inputEl, value);
  } else {
    inputEl.value = value;
  }
  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  inputEl.dispatchEvent(new Event("change", { bubbles: true }));
}

if (typeof module !== "undefined") {
  module.exports = {
    normalizeText,
    debounce,
    collectInputIdentifiers,
    scoreFieldMatch,
    fillInputAndNotify,
  };
}
