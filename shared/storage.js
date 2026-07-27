/**
 * storage.js
 * ----------
 * The ONLY file in this project that talks to chrome.storage.local directly.
 * popup.js and content-script.js should always go through the functions
 * exported here instead of calling chrome.storage themselves — this keeps
 * the storage format changeable in one place without hunting through the
 * whole codebase later.
 *
 * Storage shape (inside chrome.storage.local):
 * {
 *   initialized:   true | false,
 *   fieldValues:   { [fieldId]: string },
 *   customFields:  [ { id, label, group, type, keywords, isCustom: true } ]
 * }
 *
 * Uses chrome.storage.local (NOT .sync) on purpose — .sync would silently
 * push this data to the user's Google/Microsoft account and other signed-in
 * devices. .local never leaves this machine, which is the whole point.
 */

const STORAGE_KEYS = {
  INITIALIZED: "initialized",
  FIELD_VALUES: "fieldValues",
  CUSTOM_FIELDS: "customFields",
};

/**
 * Low-level safe read wrapper.
 * Returns the requested keys, or `fallback` values if anything goes wrong
 * (corrupted storage, extension context invalidated, etc.) instead of
 * throwing and breaking the whole popup.
 */
async function safeGet(keys, fallback) {
  try {
    const result = await chrome.storage.local.get(keys);
    return { ...fallback, ...result };
  } catch (err) {
    console.error("College Helper: storage read failed, using fallback.", err);
    return fallback;
  }
}

/**
 * Low-level safe write wrapper.
 * Returns true/false so callers can show an error message on failure
 * instead of assuming the save always worked.
 */
async function safeSet(obj) {
  try {
    await chrome.storage.local.set(obj);
    return true;
  } catch (err) {
    console.error("College Helper: storage write failed.", err);
    return false;
  }
}

/**
 * Has the user completed first-time setup?
 * Mirrors the original "check if data.json exists" requirement.
 */
async function isInitialized() {
  const { [STORAGE_KEYS.INITIALIZED]: initialized } = await safeGet(
    [STORAGE_KEYS.INITIALIZED],
    { [STORAGE_KEYS.INITIALIZED]: false }
  );
  return Boolean(initialized);
}

/**
 * Runs once, the first time the extension is used.
 * Sets up empty-but-valid storage so every later read can assume
 * fieldValues/customFields always exist (no undefined checks scattered
 * around the rest of the app).
 */
async function initializeStorage() {
  return safeSet({
    [STORAGE_KEYS.INITIALIZED]: true,
    [STORAGE_KEYS.FIELD_VALUES]: {},
    [STORAGE_KEYS.CUSTOM_FIELDS]: [],
  });
}

/**
 * Returns the full list of field DEFINITIONS (not values) —
 * the 31 defaults from constants.js plus any custom fields the user added.
 * This is what the popup uses to know what to render.
 */
async function getFieldDefinitions() {
  const { [STORAGE_KEYS.CUSTOM_FIELDS]: customFields } = await safeGet(
    [STORAGE_KEYS.CUSTOM_FIELDS],
    { [STORAGE_KEYS.CUSTOM_FIELDS]: [] }
  );

  // Basic shape validation — if customFields got corrupted into something
  // that isn't an array, silently recover instead of crashing.
  const safeCustomFields = Array.isArray(customFields) ? customFields : [];

  return [...DEFAULT_FIELDS, ...safeCustomFields];
}

/**
 * Returns the saved VALUES only, as a plain { fieldId: value } object.
 */
async function getFieldValues() {
  const { [STORAGE_KEYS.FIELD_VALUES]: fieldValues } = await safeGet(
    [STORAGE_KEYS.FIELD_VALUES],
    { [STORAGE_KEYS.FIELD_VALUES]: {} }
  );

  // If corrupted into a non-object, recover to an empty object rather than
  // letting a bad value break every field in the popup.
  const isValidObject = fieldValues && typeof fieldValues === "object" && !Array.isArray(fieldValues);
  return isValidObject ? fieldValues : {};
}

/**
 * Saves ONE field's value (used e.g. for quick inline edits).
 */
async function saveFieldValue(fieldId, value) {
  const current = await getFieldValues();
  current[fieldId] = value;
  return safeSet({ [STORAGE_KEYS.FIELD_VALUES]: current });
}

/**
 * Saves MANY field values at once — this is what the "Edit Details" form
 * (Step 5) will call on submit, so it's a single storage write instead of
 * one write per field.
 */
async function saveAllFieldValues(valuesObj) {
  const current = await getFieldValues();
  const merged = { ...current, ...valuesObj };
  return safeSet({ [STORAGE_KEYS.FIELD_VALUES]: merged });
}

/**
 * Adds a brand-new custom field (the "+ Add Field" button).
 * Generates a safe unique id from the label, e.g. "Scholarship ID" -> "custom_scholarship_id".
 * If that id somehow collides, a numeric suffix is appended.
 */
async function addCustomField({ label, group, type, keywords = [] }) {
  const { [STORAGE_KEYS.CUSTOM_FIELDS]: customFields } = await safeGet(
    [STORAGE_KEYS.CUSTOM_FIELDS],
    { [STORAGE_KEYS.CUSTOM_FIELDS]: [] }
  );
  const existingIds = new Set([...DEFAULT_FIELDS, ...customFields].map((f) => f.id));

  let baseId = "custom_" + label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!baseId || baseId === "custom_") baseId = "custom_field";

  let finalId = baseId;
  let suffix = 2;
  while (existingIds.has(finalId)) {
    finalId = `${baseId}_${suffix}`;
    suffix += 1;
  }

  const newField = {
    id: finalId,
    label: label.trim(),
    group: group || "Custom Fields",
    type: type || FIELD_TYPES.TEXT,
    keywords: keywords.map((k) => k.toLowerCase().trim()).filter(Boolean),
    isCustom: true,
  };

  const updated = [...customFields, newField];
  const success = await safeSet({ [STORAGE_KEYS.CUSTOM_FIELDS]: updated });
  return success ? newField : null;
}

/**
 * Removes a custom field definition AND its saved value.
 * Default fields (from constants.js) can never be deleted this way —
 * only fields with isCustom: true.
 */
async function deleteCustomField(fieldId) {
  const { [STORAGE_KEYS.CUSTOM_FIELDS]: customFields } = await safeGet(
    [STORAGE_KEYS.CUSTOM_FIELDS],
    { [STORAGE_KEYS.CUSTOM_FIELDS]: [] }
  );
  const updatedFields = customFields.filter((f) => f.id !== fieldId);

  const fieldValues = await getFieldValues();
  delete fieldValues[fieldId];

  const success1 = await safeSet({ [STORAGE_KEYS.CUSTOM_FIELDS]: updatedFields });
  const success2 = await safeSet({ [STORAGE_KEYS.FIELD_VALUES]: fieldValues });
  return success1 && success2;
}

/**
 * Wipes everything and re-initializes to an empty state.
 * The popup MUST show a confirmation dialog before calling this —
 * storage.js itself does not ask for confirmation, it just executes.
 */
async function resetAllData() {
  return initializeStorage();
}

if (typeof module !== "undefined") {
  module.exports = {
    isInitialized,
    initializeStorage,
    getFieldDefinitions,
    getFieldValues,
    saveFieldValue,
    saveAllFieldValues,
    addCustomField,
    deleteCustomField,
    resetAllData,
  };
}
