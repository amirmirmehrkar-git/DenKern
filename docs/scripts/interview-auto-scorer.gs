// ============================================================
// DenkKern — Interview Auto-Scorer
// Google Apps Script — Code.gs
//
// SETUP:
//   1. Replace PASTE_GOOGLE_SHEET_ID_HERE with your Sheet ID
//      (from the URL: /spreadsheets/d/<ID>/edit)
//   2. Confirm RESPONSE_SHEET_NAME matches your tab name
//   3. Run autoScoreDenkKern() once manually to verify
//   4. Add installable trigger: onFormSubmitTrigger → On form submit
// ============================================================

const SHEET_ID            = "PASTE_GOOGLE_SHEET_ID_HERE";  // ← REPLACE THIS
const RESPONSE_SHEET_NAME = "Form Responses 1";             // ← confirm tab name

// ── Scoring column groups ─────────────────────────────────────────────────────
// Must match header names in the sheet exactly (case-sensitive).
// Columns not found are skipped silently.

const SCORING_COLUMNS = [
  "Cost of Delay Visibility",
  "Decision Complexity",
  "Frequency of Disruptions",
  "Actionability",
  "Economic Value",
  "Pilot Feasibility",
  "Executive Interest",
  "Buyer Engagement",
];

const ICP_COLUMNS = [
  "Manufacturing Dependency",
  "Supply Chain Complexity",
  "Cost of Delay Exposure",
  "Operational Decision Intensity",
  "Pilot Accessibility",
];

const PILOT_COLUMNS = [
  "Data Availability",
  "Internal Sponsor",
  "Problem Urgency",
  "Operational Ownership",
  "Implementation Feasibility",
];

const OUTPUT_HEADERS = [
  "Interview Scoring Total",
  "ICP Fit Total",
  "Pilot Readiness Total",
  "Go / No-Go Recommendation",
];

// ============================================================
// Main entry point
// ============================================================

function autoScoreDenkKern() {
  if (SHEET_ID === "PASTE_GOOGLE_SHEET_ID_HERE") {
    throw new Error(
      "Setup required: replace PASTE_GOOGLE_SHEET_ID_HERE with your actual Sheet ID."
    );
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  if (!ss) throw new Error(`Could not open spreadsheet with ID: ${SHEET_ID}`);

  const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
  if (!sheet) {
    throw new Error(
      `Sheet tab not found: "${RESPONSE_SHEET_NAME}". ` +
      `Available tabs: ${ss.getSheets().map(s => s.getName()).join(", ")}`
    );
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("No response rows yet — nothing to score.");
    return;
  }

  // Add output headers if missing
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  OUTPUT_HEADERS.forEach(header => {
    if (!headers.includes(header)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      headers.push(header);
    }
  });

  const scoringTotalCol   = headers.indexOf("Interview Scoring Total")   + 1;
  const icpTotalCol       = headers.indexOf("ICP Fit Total")             + 1;
  const pilotTotalCol     = headers.indexOf("Pilot Readiness Total")     + 1;
  const recommendationCol = headers.indexOf("Go / No-Go Recommendation") + 1;

  const allRows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  allRows.forEach((rowValues, idx) => {
    const rowNum         = idx + 2;
    const scoringTotal   = sumByHeaders(rowValues, headers, SCORING_COLUMNS);
    const icpTotal       = sumByHeaders(rowValues, headers, ICP_COLUMNS);
    const pilotTotal     = sumByHeaders(rowValues, headers, PILOT_COLUMNS);
    const recommendation = getRecommendation(icpTotal, pilotTotal);

    sheet.getRange(rowNum, scoringTotalCol).setValue(scoringTotal);
    sheet.getRange(rowNum, icpTotalCol).setValue(icpTotal);
    sheet.getRange(rowNum, pilotTotalCol).setValue(pilotTotal);
    sheet.getRange(rowNum, recommendationCol).setValue(recommendation);
  });

  Logger.log(`Scored ${allRows.length} row(s) successfully.`);
}

// ============================================================
// Helper: sum values from named columns; skip any not found
// ============================================================

function sumByHeaders(rowValues, headers, columnNames) {
  return columnNames.reduce((sum, name) => {
    const index = headers.indexOf(name);
    if (index === -1) return sum;
    const value = Number(rowValues[index]);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);
}

// ============================================================
// Helper: recommendation
// ICP max 25 (5 cols × 5 pts) — GO ≥ 21, CONDITIONAL GO ≥ 16
// Pilot max 25 (5 cols × 5 pts) — same thresholds
// ============================================================

function getRecommendation(icpTotal, pilotTotal) {
  if (icpTotal >= 21 && pilotTotal >= 21) return "GO";
  if (icpTotal >= 16 && pilotTotal >= 16) return "CONDITIONAL GO";
  return "NO-GO";
}

// ============================================================
// Trigger entry point — wire to: On form submit
// ============================================================

function onFormSubmitTrigger(e) {
  autoScoreDenkKern();
}
