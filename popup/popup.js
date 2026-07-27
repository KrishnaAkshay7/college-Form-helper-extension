/**
 * popup.js
 * --------
 * All UI logic for the extension popup. Talks to storage.js for data and
 * to content-script.js (via chrome.tabs.sendMessage) for autofill.
 * Depends on constants.js, storage.js, and utils.js being loaded first.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  fieldDefinitions: [], // defaults + custom, from storage.getFieldDefinitions()
  fieldValues: {},      // { fieldId: value }
  searchTerm: "",
  modalMode: null,      // "edit" | "add-field"
};

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const el = {
  setupView: document.getElementById("setup-view"),
  mainView: document.getElementById("main-view"),
  setupForm: document.getElementById("setup-form"),
  setupSaveBtn: document.getElementById("setup-save-btn"),

  searchInput: document.getElementById("search-input"),
  autofillBtn: document.getElementById("autofill-btn"),
  editBtn: document.getElementById("edit-btn"),
  addFieldBtn: document.getElementById("add-field-btn"),
  resetBtn: document.getElementById("reset-btn"),
  statusMessage: document.getElementById("status-message"),
  sectionsContainer: document.getElementById("sections-container"),

  modalOverlay: document.getElementById("modal-overlay"),
  modalTitle: document.getElementById("modal-title"),
  modalBody: document.getElementById("modal-body"),
  modalSaveBtn: document.getElementById("modal-save-btn"),
  modalCancelBtn: document.getElementById("modal-cancel-btn"),
  modalCloseBtn: document.getElementById("modal-close-btn"),

  confirmOverlay: document.getElementById("confirm-overlay"),
  confirmMessage: document.getElementById("confirm-message"),
  confirmOkBtn: document.getElementById("confirm-ok-btn"),
  confirmCancelBtn: document.getElementById("confirm-cancel-btn"),
};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  const setupDone = await isInitialized();
  if (!setupDone) {
    showSetupView();
  } else {
    await loadData();
    showMainView();
  }
  attachGlobalEvents();
}

async function loadData() {
  state.fieldDefinitions = await getFieldDefinitions();
  state.fieldValues = await getFieldValues();
}

function showSetupView() {
  el.setupView.classList.remove("hidden");
  el.mainView.classList.add("hidden");
  renderSetupForm();
}

function showMainView() {
  el.setupView.classList.add("hidden");
  el.mainView.classList.remove("hidden");
  renderMainView();
}

// ---------------------------------------------------------------------------
// Shared form-building helper (used by setup view AND edit modal)
// ---------------------------------------------------------------------------
function buildFormFieldsHtml(fields, existingValues) {
  const groups = {};
  for (const field of fields) {
    if (!groups[field.group]) groups[field.group] = [];
    groups[field.group].push(field);
  }

  let html = "";
  for (const groupName of Object.keys(groups)) {
    html += `<div class="field-group"><div class="field-group-title">${escapeHtml(groupName)}</div>`;
    for (const field of groups[groupName]) {
      const value = existingValues[field.id] || "";
      html += renderFormField(field, value);
    }
    html += `</div>`;
  }
  return html;
}

function renderFormField(field, value) {
  const safeValue = escapeHtml(value);
  let inputHtml = "";

  switch (field.type) {
    case FIELD_TYPES.TEXTAREA:
      inputHtml = `<textarea data-field-id="${field.id}" rows="3">${safeValue}</textarea>`;
      break;
    case FIELD_TYPES.DATE:
      inputHtml = `<input type="date" data-field-id="${field.id}" value="${safeValue}" />`;
      break;
    case FIELD_TYPES.SELECT: {
      const options = (field.options || [])
        .map((opt) => `<option value="${escapeHtml(opt)}" ${opt === value ? "selected" : ""}>${escapeHtml(opt)}</option>`)
        .join("");
      inputHtml = `<select data-field-id="${field.id}"><option value="">— Select —</option>${options}</select>`;
      break;
    }
    default:
      inputHtml = `<input type="text" data-field-id="${field.id}" value="${safeValue}" />`;
  }

  return `<div class="form-field"><label>${escapeHtml(field.label)}</label>${inputHtml}</div>`;
}

function collectFormValues(container) {
  const values = {};
  container.querySelectorAll("[data-field-id]").forEach((input) => {
    values[input.dataset.fieldId] = input.value.trim();
  });
  return values;
}

// ---------------------------------------------------------------------------
// Setup view (first run)
// ---------------------------------------------------------------------------
async function renderSetupForm() {
  const fields = await getFieldDefinitions();
  el.setupForm.innerHTML = buildFormFieldsHtml(fields, {});
}

el.setupSaveBtn.addEventListener("click", async () => {
  const values = collectFormValues(el.setupForm);
  await initializeStorage();
  await saveAllFieldValues(values);
  await loadData();
  showMainView();
  showStatus("All set! Your details are saved locally.", "success");
});

// ---------------------------------------------------------------------------
// Main view — grouped field cards
// ---------------------------------------------------------------------------
function renderMainView() {
  const term = normalizeText(state.searchTerm);
  const groups = {};

  for (const field of state.fieldDefinitions) {
    if (term && !normalizeText(field.label).includes(term)) continue;
    if (!groups[field.group]) groups[field.group] = [];
    groups[field.group].push(field);
  }

  const groupNames = Object.keys(groups);
  if (groupNames.length === 0) {
    el.sectionsContainer.innerHTML = `<p class="setup-intro">No fields match "${escapeHtml(state.searchTerm)}".</p>`;
    return;
  }

  let html = "";
  for (const groupName of groupNames) {
    html += `<div class="field-group"><div class="field-group-title">${escapeHtml(groupName)}</div>`;
    for (const field of groups[groupName]) {
      html += renderFieldCard(field);
    }
    html += `</div>`;
  }
  el.sectionsContainer.innerHTML = html;
  attachCardEvents();
}

function renderFieldCard(field) {
  const value = state.fieldValues[field.id] || "";
  const hasValue = value.length > 0;
  const displayValue = hasValue ? escapeHtml(value) : "Not set";
  const deleteBtn = field.isCustom
    ? `<button class="delete-field-btn" data-delete-id="${field.id}" title="Delete this custom field">🗑</button>`
    : "";

  return `
    <div class="field-card">
      <div class="field-card-text">
        <div class="field-card-label">${escapeHtml(field.label)}</div>
        <div class="field-card-value ${hasValue ? "" : "empty"}">${displayValue}</div>
      </div>
      <div class="field-card-actions">
        <button class="fill-btn" data-fill-id="${field.id}" title="Click a field on the page to fill it" ${hasValue ? "" : "disabled"}>🎯</button>
        <button class="copy-btn" data-copy-id="${field.id}" ${hasValue ? "" : "disabled"}>Copy</button>
        ${deleteBtn}
      </div>
    </div>`;
}

function attachCardEvents() {
  el.sectionsContainer.querySelectorAll("[data-copy-id]").forEach((btn) => {
    btn.addEventListener("click", () => handleCopy(btn));
  });
  el.sectionsContainer.querySelectorAll("[data-fill-id]").forEach((btn) => {
    btn.addEventListener("click", () => handleManualFill(btn.dataset.fillId));
  });
  el.sectionsContainer.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => handleDeleteField(btn.dataset.deleteId));
  });
}

// ---------------------------------------------------------------------------
// Copy button behavior
// ---------------------------------------------------------------------------
async function handleCopy(btn) {
  const fieldId = btn.dataset.copyId;
  const value = state.fieldValues[fieldId] || "";
  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
    const original = btn.textContent;
    btn.textContent = "✓ Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 1000);
  } catch (err) {
    showStatus("Couldn't copy to clipboard.", "error");
  }
}

// ---------------------------------------------------------------------------
// Autofill (smart) — sends the whole field list + values to content script
// ---------------------------------------------------------------------------
el.autofillBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showStatus("Couldn't find the active tab.", "error");
    return;
  }

  chrome.tabs.sendMessage(
    tab.id,
    { action: "autofill", fields: state.fieldDefinitions, values: state.fieldValues },
    (response) => {
      if (chrome.runtime.lastError) {
        showStatus("Can't autofill this page (browser pages and some sites block extensions).", "error");
        return;
      }
      if (!response) {
        showStatus("No response from the page — try reloading it.", "error");
        return;
      }
      const { filledCount, unmatchedFieldIds } = response;
      if (filledCount === 0) {
        showStatus("No matching fields found on this page. Try the 🎯 button to fill fields manually.", "error");
      } else {
        showStatus(
          `Filled ${filledCount} field${filledCount === 1 ? "" : "s"}.` +
            (unmatchedFieldIds.length ? ` ${unmatchedFieldIds.length} field(s) need manual fill (🎯).` : " All matched fields filled!"),
          "success"
        );
      }
    }
  );
});

// ---------------------------------------------------------------------------
// Manual point-and-click fill
// ---------------------------------------------------------------------------
async function handleManualFill(fieldId) {
  const field = state.fieldDefinitions.find((f) => f.id === fieldId);
  const value = state.fieldValues[fieldId];
  if (!field || !value) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  chrome.tabs.sendMessage(tab.id, { action: "armPick", fieldLabel: field.label, value }, () => {
    if (chrome.runtime.lastError) {
      showStatus("Can't do this on the current page.", "error");
      return;
    }
    // Popup will lose focus and close as soon as the user clicks the page —
    // that's expected. The content script keeps working independently.
    window.close();
  });
}

// ---------------------------------------------------------------------------
// Search / filter
// ---------------------------------------------------------------------------
const debouncedSearch = debounce((value) => {
  state.searchTerm = value;
  renderMainView();
}, 120);

el.searchInput.addEventListener("input", (e) => debouncedSearch(e.target.value));

// ---------------------------------------------------------------------------
// Edit Details modal
// ---------------------------------------------------------------------------
el.editBtn.addEventListener("click", () => openEditModal());

function openEditModal() {
  state.modalMode = "edit";
  el.modalTitle.textContent = "Edit Details";
  el.modalBody.innerHTML = buildFormFieldsHtml(state.fieldDefinitions, state.fieldValues);
  el.modalSaveBtn.textContent = "Save";
  openModal();
}

async function saveEditModal() {
  const values = collectFormValues(el.modalBody);
  const success = await saveAllFieldValues(values);
  if (success) {
    await loadData();
    renderMainView();
    closeModal();
    showStatus("Details updated.", "success");
  } else {
    showStatus("Couldn't save — please try again.", "error");
  }
}

// ---------------------------------------------------------------------------
// Add Field modal
// ---------------------------------------------------------------------------
el.addFieldBtn.addEventListener("click", () => openAddFieldModal());

function openAddFieldModal() {
  state.modalMode = "add-field";
  el.modalTitle.textContent = "Add New Field";
  el.modalBody.innerHTML = `
    <div class="form-field">
      <label>Field Name</label>
      <input type="text" id="new-field-label" placeholder="e.g. Scholarship ID" />
    </div>
    <div class="form-field">
      <label>Section</label>
      <select id="new-field-group">
        ${Object.values(FIELD_GROUPS).map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("")}
        <option value="Custom Fields" selected>Custom Fields</option>
      </select>
    </div>
    <div class="form-field">
      <label>Field Type</label>
      <select id="new-field-type">
        <option value="${FIELD_TYPES.TEXT}">Short text</option>
        <option value="${FIELD_TYPES.TEXTAREA}">Long text</option>
        <option value="${FIELD_TYPES.DATE}">Date</option>
      </select>
    </div>
    <div class="form-field">
      <label>Autofill Keywords <span style="font-weight:400;">(optional, comma separated)</span></label>
      <input type="text" id="new-field-keywords" placeholder="e.g. scholarship id, scholarship number" />
    </div>
  `;
  el.modalSaveBtn.textContent = "Add Field";
  openModal();
}

async function saveAddFieldModal() {
  const label = document.getElementById("new-field-label").value.trim();
  if (!label) {
    showStatus("Please enter a field name.", "error");
    return;
  }
  const group = document.getElementById("new-field-group").value;
  const type = document.getElementById("new-field-type").value;
  const keywords = document
    .getElementById("new-field-keywords")
    .value.split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const newField = await addCustomField({ label, group, type, keywords });
  if (!newField) {
    showStatus("Couldn't add field — please try again.", "error");
    return;
  }

  await loadData();
  closeModal();
  showStatus(`Added "${label}". Now let's fill in its value.`, "success");

  // Immediately open the edit modal, scrolled/focused to the new field,
  // so adding a field and filling it feels like one smooth action.
  openEditModal();
  requestAnimationFrame(() => {
    const input = el.modalBody.querySelector(`[data-field-id="${newField.id}"]`);
    if (input) {
      input.scrollIntoView({ block: "center" });
      input.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Delete custom field
// ---------------------------------------------------------------------------
function handleDeleteField(fieldId) {
  const field = state.fieldDefinitions.find((f) => f.id === fieldId);
  if (!field) return;

  openConfirm(`Delete the custom field "${field.label}"? This can't be undone.`, async () => {
    const success = await deleteCustomField(fieldId);
    if (success) {
      await loadData();
      renderMainView();
      showStatus(`Deleted "${field.label}".`, "success");
    } else {
      showStatus("Couldn't delete field.", "error");
    }
  });
}

// ---------------------------------------------------------------------------
// Reset all data (with confirmation)
// ---------------------------------------------------------------------------
el.resetBtn.addEventListener("click", () => {
  openConfirm("Reset ALL saved data? This will erase every field and custom field you've added. This can't be undone.", async () => {
    await resetAllData();
    state.fieldDefinitions = [];
    state.fieldValues = {};
    showSetupView();
    showStatus("All data has been reset.", "success");
  });
});

// ---------------------------------------------------------------------------
// Modal plumbing
// ---------------------------------------------------------------------------
function openModal() {
  el.modalOverlay.classList.remove("hidden");
}
function closeModal() {
  el.modalOverlay.classList.add("hidden");
  state.modalMode = null;
}

el.modalSaveBtn.addEventListener("click", () => {
  if (state.modalMode === "edit") saveEditModal();
  else if (state.modalMode === "add-field") saveAddFieldModal();
});
el.modalCancelBtn.addEventListener("click", closeModal);
el.modalCloseBtn.addEventListener("click", closeModal);
el.modalOverlay.addEventListener("click", (e) => {
  if (e.target === el.modalOverlay) closeModal();
});

// ---------------------------------------------------------------------------
// Confirm dialog plumbing
// ---------------------------------------------------------------------------
let confirmCallback = null;

function openConfirm(message, onConfirm) {
  el.confirmMessage.textContent = message;
  confirmCallback = onConfirm;
  el.confirmOverlay.classList.remove("hidden");
}
function closeConfirm() {
  el.confirmOverlay.classList.add("hidden");
  confirmCallback = null;
}

el.confirmOkBtn.addEventListener("click", async () => {
  const cb = confirmCallback;
  closeConfirm();
  if (cb) await cb();
});
el.confirmCancelBtn.addEventListener("click", closeConfirm);
el.confirmOverlay.addEventListener("click", (e) => {
  if (e.target === el.confirmOverlay) closeConfirm();
});

// ---------------------------------------------------------------------------
// Status message helper
// ---------------------------------------------------------------------------
let statusTimer = null;
function showStatus(text, type = "") {
  el.statusMessage.textContent = text;
  el.statusMessage.className = `status-message ${type}`;
  el.statusMessage.classList.remove("hidden");
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.statusMessage.classList.add("hidden"), 3000);
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------
function attachGlobalEvents() {
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      el.searchInput.focus();
    }
    if (e.key === "Escape") {
      if (!el.confirmOverlay.classList.contains("hidden")) closeConfirm();
      else if (!el.modalOverlay.classList.contains("hidden")) closeModal();
    }
  });
}

// ---------------------------------------------------------------------------
// Small utils local to popup.js
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// Go!
init();
