/**
 * constants.js
 * ------------
 * Single source of truth for:
 *   1. The default set of fields (tailored to Indian college applications)
 *   2. How fields are grouped in the UI
 *   3. Keyword hints used by the autofill matcher to guess which
 *      on-page input corresponds to which saved field
 *
 * IMPORTANT: This file is shared between the popup and the content script,
 * so it must NOT use any browser-popup-only APIs (no DOM access here).
 */

// ---------------------------------------------------------------------------
// Field "types" — controls which input widget the popup renders for editing
// ---------------------------------------------------------------------------
const FIELD_TYPES = {
  TEXT: "text",
  TEXTAREA: "textarea",
  DATE: "date",
  SELECT: "select",
  NUMBER: "number",
};

// ---------------------------------------------------------------------------
// Section groups — purely for organizing the popup UI into collapsible cards
// ---------------------------------------------------------------------------
const FIELD_GROUPS = {
  PERSONAL: "Personal Details",
  ADDRESS: "Address",
  ACADEMIC_10: "Academic — 10th Standard",
  ACADEMIC_12: "Academic — 12th Standard",
  ENTRANCE: "Entrance Exams",
  FAMILY: "Family & Category Details",
  ESSAY: "Essays & Statements",
};

/**
 * DEFAULT_FIELDS
 * --------------
 * Every field below represents something Indian college / university
 * application forms commonly ask for. `id` must be unique and stable —
 * it's the key used in chrome.storage.local, so don't rename existing ids
 * later without a migration step.
 *
 * keywords: lowercase strings the autofill engine will look for inside a
 * page input's name/id/placeholder/aria-label/associated <label> text.
 */
const DEFAULT_FIELDS = [
  // ---------------- Personal Details ----------------
  { id: "full_name", label: "Full Name", group: FIELD_GROUPS.PERSONAL, type: FIELD_TYPES.TEXT,
    keywords: ["full name", "fullname", "candidate name", "applicant name", "student name", "name"] },

  { id: "email", label: "Email Address", group: FIELD_GROUPS.PERSONAL, type: FIELD_TYPES.TEXT,
    keywords: ["email", "e-mail", "mail id", "email address"] },

  { id: "phone", label: "Mobile Number", group: FIELD_GROUPS.PERSONAL, type: FIELD_TYPES.TEXT,
    keywords: ["phone", "mobile", "contact number", "mobile number", "cell"] },

  { id: "alt_phone", label: "Alternate Mobile Number", group: FIELD_GROUPS.PERSONAL, type: FIELD_TYPES.TEXT,
    keywords: ["alternate mobile", "alternate phone", "secondary contact", "guardian mobile"] },

  { id: "dob", label: "Date of Birth", group: FIELD_GROUPS.PERSONAL, type: FIELD_TYPES.DATE,
    keywords: ["dob", "date of birth", "birth date", "birthdate"] },

  { id: "gender", label: "Gender", group: FIELD_GROUPS.PERSONAL, type: FIELD_TYPES.SELECT,
    options: ["Female", "Male", "Other", "Prefer not to say"],
    keywords: ["gender", "sex"] },

  { id: "nationality", label: "Nationality", group: FIELD_GROUPS.PERSONAL, type: FIELD_TYPES.TEXT,
    keywords: ["nationality", "citizenship"] },

  { id: "aadhaar", label: "Aadhaar Number", group: FIELD_GROUPS.PERSONAL, type: FIELD_TYPES.TEXT,
    keywords: ["aadhaar", "aadhar", "uidai"] },

  { id: "blood_group", label: "Blood Group", group: FIELD_GROUPS.PERSONAL, type: FIELD_TYPES.TEXT,
    keywords: ["blood group"] },

  // ---------------- Address ----------------
  { id: "address_permanent", label: "Permanent Address", group: FIELD_GROUPS.ADDRESS, type: FIELD_TYPES.TEXTAREA,
    keywords: ["permanent address", "home address"] },

  { id: "address_correspondence", label: "Correspondence Address", group: FIELD_GROUPS.ADDRESS, type: FIELD_TYPES.TEXTAREA,
    keywords: ["correspondence address", "mailing address", "current address"] },

  { id: "city", label: "City", group: FIELD_GROUPS.ADDRESS, type: FIELD_TYPES.TEXT,
    keywords: ["city", "town"] },

  { id: "state", label: "State", group: FIELD_GROUPS.ADDRESS, type: FIELD_TYPES.TEXT,
    keywords: ["state", "province"] },

  { id: "pincode", label: "PIN Code", group: FIELD_GROUPS.ADDRESS, type: FIELD_TYPES.TEXT,
    keywords: ["pin code", "pincode", "postal code", "zip"] },

  { id: "domicile_state", label: "Domicile State", group: FIELD_GROUPS.ADDRESS, type: FIELD_TYPES.TEXT,
    keywords: ["domicile", "domicile state"] },

  // ---------------- Academic: 10th ----------------
  { id: "tenth_board", label: "10th Board", group: FIELD_GROUPS.ACADEMIC_10, type: FIELD_TYPES.TEXT,
    keywords: ["10th board", "class 10 board", "ssc board", "board of 10th"] },

  { id: "tenth_school", label: "10th School Name", group: FIELD_GROUPS.ACADEMIC_10, type: FIELD_TYPES.TEXT,
    keywords: ["10th school", "school name", "ssc school"] },

  { id: "tenth_percentage", label: "10th Percentage / CGPA", group: FIELD_GROUPS.ACADEMIC_10, type: FIELD_TYPES.TEXT,
    keywords: ["10th percentage", "10th cgpa", "ssc percentage", "class 10 marks"] },

  { id: "tenth_year", label: "10th Passing Year", group: FIELD_GROUPS.ACADEMIC_10, type: FIELD_TYPES.TEXT,
    keywords: ["10th passing year", "ssc year", "year of passing 10th"] },

  // ---------------- Academic: 12th ----------------
  { id: "twelfth_board", label: "12th Board", group: FIELD_GROUPS.ACADEMIC_12, type: FIELD_TYPES.TEXT,
    keywords: ["12th board", "class 12 board", "hsc board", "board of 12th"] },

  { id: "twelfth_school", label: "12th School / Junior College", group: FIELD_GROUPS.ACADEMIC_12, type: FIELD_TYPES.TEXT,
    keywords: ["12th school", "junior college", "hsc school"] },

  { id: "twelfth_stream", label: "12th Stream", group: FIELD_GROUPS.ACADEMIC_12, type: FIELD_TYPES.SELECT,
    options: ["Science (PCM)", "Science (PCB)", "Commerce", "Arts/Humanities", "Other"],
    keywords: ["stream", "12th stream"] },

  { id: "twelfth_percentage", label: "12th Percentage / CGPA", group: FIELD_GROUPS.ACADEMIC_12, type: FIELD_TYPES.TEXT,
    keywords: ["12th percentage", "12th cgpa", "hsc percentage", "class 12 marks"] },

  { id: "twelfth_year", label: "12th Passing Year", group: FIELD_GROUPS.ACADEMIC_12, type: FIELD_TYPES.TEXT,
    keywords: ["12th passing year", "hsc year", "year of passing 12th"] },

  // ---------------- Entrance Exams ----------------
  { id: "entrance_exam", label: "Entrance Exam Name", group: FIELD_GROUPS.ENTRANCE, type: FIELD_TYPES.TEXT,
    keywords: ["entrance exam", "exam name", "jee", "cuet", "neet"] },

  { id: "entrance_roll", label: "Entrance Exam Roll Number", group: FIELD_GROUPS.ENTRANCE, type: FIELD_TYPES.TEXT,
    keywords: ["roll number", "application number", "registration number"] },

  { id: "entrance_rank", label: "Entrance Exam Rank / Score", group: FIELD_GROUPS.ENTRANCE, type: FIELD_TYPES.TEXT,
    keywords: ["rank", "score", "percentile", "air"] },

  // ---------------- Family & Category ----------------
  { id: "father_name", label: "Father's Name", group: FIELD_GROUPS.FAMILY, type: FIELD_TYPES.TEXT,
    keywords: ["father name", "father's name", "guardian name"] },

  { id: "mother_name", label: "Mother's Name", group: FIELD_GROUPS.FAMILY, type: FIELD_TYPES.TEXT,
    keywords: ["mother name", "mother's name"] },

  { id: "category", label: "Category", group: FIELD_GROUPS.FAMILY, type: FIELD_TYPES.SELECT,
    options: ["General", "OBC", "SC", "ST", "EWS", "Other"],
    keywords: ["category", "reservation category"] },

  { id: "annual_income", label: "Annual Family Income", group: FIELD_GROUPS.FAMILY, type: FIELD_TYPES.TEXT,
    keywords: ["annual income", "family income", "parent income"] },

  // ---------------- Essays ----------------
  { id: "essay_sop", label: "Statement of Purpose / Essay", group: FIELD_GROUPS.ESSAY, type: FIELD_TYPES.TEXTAREA,
    keywords: ["statement of purpose", "sop", "essay", "personal statement", "about yourself"] },
];

// Exported for use by popup.js, content-script.js, storage.js, etc.
// (Plain `var`/global assignment is used instead of ES modules because
// content scripts and popups load these as plain <script> tags, not modules.)
if (typeof module !== "undefined") {
  module.exports = { FIELD_TYPES, FIELD_GROUPS, DEFAULT_FIELDS };
}
