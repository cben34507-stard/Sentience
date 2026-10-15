/**
 * Importer for the "medical record export" XML that Patient Access (EMIS)
 * produces. Only <TestResults> is read: the <Source>/<User> block (name, date
 * of birth, NHS number) is skipped on purpose and never stored or returned.
 *
 * Shape:
 *   <TestResult><Created>01 Jan 2026</Created><Title>Some panel</Title>
 *     <TestResultLines><TestResultLine>
 *       <Description>Serum sodium</Description><Result>140 mmol/L </Result>
 *       <NormalRange>133 - 146 </NormalRange>
 *
 * Descriptions are EMIS/SNOMED wording; MAP turns the common ones into LAB_TESTS
 * keys so they line up with results entered by hand. Anything numeric we don't
 * recognise is still imported under its own name.
 */
import sax from "sax";
import { LAB_TEST_BY_KEY, labFlag, presetRange, type LabFlag, type LabResultInput } from "@sentience/shared";
import { zonedStartOfDay } from "../lib/time.js";

export interface ImportRow extends LabResultInput {
  /** Original wording, for the preview. */
  source: string;
  flag: LabFlag;
  /** Where refLow/refHigh came from. */
  rangeFrom: "report" | "preset" | "none";
}
export interface ParsedImport {
  rows: ImportRow[];
  skipped: { date: string; description: string; reason: string }[];
  reports: number;
  from: string | null;
  to: string | null;
}

type Line = { date: string; title: string; description: string; result: string; range: string };

/** Description (lower-cased) → preset key, optional value conversion. */
const MAP: [RegExp, string, ((v: number) => number)?][] = [
  // Liver
  [/^serum alt level$|^alt\b/, "alt"],
  [/^ast serum level$|^serum ast\b/, "ast"],
  [/^serum alkaline phosphatase/, "alp"],
  [/^serum gamma.?glutamyl|^serum ggt|^gamma gt/, "ggt"],
  [/^serum total bilirubin/, "bilirubin"],
  [/^serum albumin/, "albumin"],
  [/^serum globulin/, "globulin"],
  [/^serum total protein/, "total_protein"],
  [/^fibrosis-4 index/, "fib4"],
  // Lipids
  [/^serum cholesterol\/hdl ratio|^cholesterol\/hdl ratio/, "chol_hdl_ratio"],
  [/^serum (total )?cholesterol( level)?$/, "chol_total"],
  [/^serum hdl cholesterol/, "hdl"],
  [/^serum ldl cholesterol|^ldl cholesterol/, "ldl"],
  [/non hdl cholesterol/, "non_hdl"],
  [/^serum triglycerides?/, "triglycerides"],
  // Full blood count
  [/^haemoglobin estimation|^haemoglobin conc/, "hb"],
  [/^haematocrit/, "hct"],
  [/^red blood cell \(rbc\) count|^red blood cell count/, "rbc"],
  [/^mean corpuscular volume|\(mcv\)/, "mcv"],
  [/\(mchc\)/, "mchc"],
  [/\(mch\)/, "mch"],
  [/^red blood cell distribut/, "rdw"],
  [/^total white cell count|^white blood cell count/, "wbc"],
  [/^platelet count/, "platelets"],
  [/^neutrophil count/, "neutrophils"],
  [/^lymphocyte count/, "lymphocytes"],
  [/^monocyte count/, "monocytes"],
  [/^eosinophil count/, "eosinophils"],
  [/^basophil count/, "basophils"],
  // Kidney, bone
  [/^serum sodium/, "sodium"],
  [/^serum potassium/, "potassium"],
  [/^serum creatinine/, "creatinine"],
  [/^serum urea/, "urea"],
  [/^egfr/, "egfr"],
  [/^calcium adjusted|^serum adjusted calcium|^corrected calcium/, "calcium_adj"],
  [/^serum calcium$/, "calcium"],
  [/^serum (inorganic )?phosphate/, "phosphate"],
  [/^serum magnesium/, "magnesium"],
  [/^serum (uric acid|urate)/, "urate"],
  // Vitamins, iron, inflammation
  [/^serum ferritin/, "ferritin"],
  [/^serum folate/, "folate"],
  [/^serum vitamin b12/, "b12"],
  [/vit d2 \+ d3|^serum 25-?oh vitamin d|vitamin d level/, "vitd"],
  [/^serum iron/, "iron"],
  [/^serum c reactive protein|^c reactive protein/, "crp"],
  [/^erythrocyte sedimentation rate/, "esr"],
  // Diabetes, thyroid, hormones
  [/^hba1c/, "hba1c"],
  [/^fasting (blood|plasma) glucose/, "glucose_fasting"],
  [/^(random )?(blood|plasma|serum) glucose/, "glucose_random"],
  [/^serum tsh/, "tsh"],
  [/^serum free t4|^free t4/, "ft4"],
  [/^serum free t3|^free t3/, "ft3"],
  [/^se calculate?d free testosterone|^calculated free testosterone/, "free_testosterone"],
  [/^serum testosterone/, "testosterone"],
  [/^serum sex hormo?ne binding glob/, "shbg"],
  [/^serum fsh/, "fsh"],
  [/^serum lh/, "lh"],
  [/^serum prolactin/, "prolactin"],
  [/prostate specific a(g|ntigen)/, "psa"],
  // Clinic measurements
  [/^average home systolic/, "bp_sys_home"],
  [/^average home diastolic/, "bp_dia_home"],
  [/^(sitting |standing |lying )?systolic (arterial|blood) pressure/, "bp_sys"],
  [/^(sitting |standing |lying )?diastolic (arterial|blood) pressure/, "bp_dia"],
  [/^pulse rate|^heart rate/, "pulse"],
  [/^blood oxygen saturation|^oxygen saturation/, "spo2"],
  [/temperature$/, "temp"],
  [/^body weight/, "weight"],
  [/^body mass index$/, "bmi"],
  [/^(standing )?height$/, "height"],
  [/^waist circumference/, "waist"],
  // Lung function (pre-bronchodilator values go to the presets; post ones keep their own names)
  [/^forced expired volume in 1 second$|^fev1 before bronchodilation/, "fev1"],
  [/^forced vital capacity$/, "fvc"],
  [/^peak flow rate before bronchodilation|^peak expiratory flow rate$/, "peak_flow"],
  [/^percent predicted fev1$/, "fev1_pct"],
  [/^fev1\/fvc ratio( before bronchodilator)?$/, "fev1_fvc"],
  [/^fev1\/fvc percent$/, "fev1_fvc", (v) => Math.round(v * 10) / 1000],
  [/^fvc\/expected fvc percent$/, "fvc_pct"],
  [/^spirometric lung age/, "lung_age"],
  [/^asthma control test score/, "act_score"],
];

/** Lines that are headings, admin or empty placeholders rather than results. */
const NOISE = /^(notice|comments?|other|ukas status|lung function testing done|forced expired volume|urine sent for culture|finding of body mass index|fev1\/fvc > 70% of predicted)$/;

const UNIT: [RegExp, string][] = [
  [/^10\*9\/l$/i, "×10⁹/L"],
  [/^10\*12\/l$/i, "×10¹²/L"],
  [/^umol\/l$/i, "µmol/L"],
  [/^ug\/l$/i, "µg/L"],
  [/^mu\/l$/i, "mU/L"],
  [/^miu\/l$/i, "mU/L"],
  [/^kg\/m2$/i, "kg/m²"],
  [/^litres?$/i, "L"],
  [/^fl$/i, "fL"],
  [/^beats\/min$/i, "bpm"],
  [/^degrees c$/i, "°C"],
  [/^ml\/min$/i, "mL/min/1.73m²"],
];

function normUnit(u: string, key: string | null): string {
  const t = u.trim();
  if (/^iu\/l$/i.test(t)) return key === "fsh" || key === "lh" ? "IU/L" : "U/L";
  for (const [re, out] of UNIT) if (re.test(t)) return out;
  return t;
}

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
/** "01 Jan 2026" → "2026-01-01" */
export function emisDate(s: string): string | null {
  const m = /^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/.exec(s.trim());
  if (!m || !MONTHS[m[2].toLowerCase()]) return null;
  return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
}

/** Results only carry a date; pin them to local noon so they land on the right day. */
function noonOn(date: string, tz: string): string {
  return new Date(Date.parse(zonedStartOfDay(date, tz)) + 12 * 3600_000).toISOString();
}

function parseRange(s: string): { low: number | null; high: number | null } | null {
  const t = s.trim();
  if (!t || /^n\/?a$/i.test(t)) return null;
  const num = (x: string) => Number(x.startsWith(".") ? `0${x}` : x);
  let m = /^(-?\d*\.?\d+)\s*-\s*(-?\d*\.?\d+)$/.exec(t);
  if (m) return { low: num(m[1]), high: num(m[2]) };
  m = /^(<=?|less than)\s*(\d*\.?\d+)$/i.exec(t);
  if (m) return { low: null, high: num(m[2]) };
  m = /^(>=?|greater than)\s*(\d*\.?\d+)$/i.exec(t);
  if (m) return { low: num(m[2]), high: null };
  return null;
}

/** "40 IU/L", "0.8", "60 mL/min >", "< 0.5 mmol/L", "18 /25" */
function parseResult(s: string): { value: number; unit: string; qualifier: string } | null {
  const t = s.replace(/\s+/g, " ").trim();
  const m = /^([<>]=?)?\s*(-?\d*\.?\d+)\s*(.*?)\s*([<>])?$/.exec(t);
  if (!m) return null;
  const value = Number(m[2].startsWith(".") ? `0${m[2]}` : m[2]);
  if (!Number.isFinite(value)) return null;
  return { value, unit: m[3], qualifier: m[1] ?? (m[4] ? m[4] : "") };
}

/** Findings written into the description itself, e.g. "Urine nitrite negative". */
function textFinding(desc: string): { name: string; text: string; value?: number } | null {
  let m = /^(urine .+?)(?: test)?(?: =)? (negative|positive|trace|nil)$/i.exec(desc);
  if (m) return { name: `${cap(m[1])} (dipstick)`, text: m[2].toLowerCase() };
  m = /^urine ph = (\d+(?:\.\d+)?)$/i.exec(desc);
  if (m) return { name: "Urine pH (dipstick)", text: m[1], value: Number(m[1]) };
  m = /^urine looks (\w+)$/i.exec(desc);
  if (m) return { name: "Urine appearance", text: m[1].toLowerCase() };
  m = /^(.+?) (normal|abnormal)$/i.exec(desc);
  if (m) return { name: cap(m[1]), text: cap(m[2].toLowerCase()) };
  return null;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Patient Access writes encoding="utf-16" but the bytes are often UTF-8. Trust the bytes. */
export function decodeXml(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString("utf16le");
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(2)).swap16().toString("utf16le");
  if (buf.length > 3 && buf[1] === 0 && buf[3] === 0) return buf.toString("utf16le");
  let s = buf.toString("utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s;
}

function readLines(xml: string): { lines: Line[]; reports: number } {
  const parser = sax.parser(true, { trim: false });
  const stack: string[] = [];
  const lines: Line[] = [];
  let reports = 0;
  let inUser = false;
  let report = { date: "", title: "" };
  let line: Line | null = null;
  let text = "";
  parser.onopentag = (n) => {
    stack.push(n.name);
    text = "";
    if (n.name === "User") inUser = true;
    if (n.name === "TestResult") {
      reports++;
      report = { date: "", title: "" };
    }
    if (n.name === "TestResultLine") line = { date: report.date, title: report.title, description: "", result: "", range: "" };
  };
  parser.ontext = (t) => {
    if (!inUser) text += t;
  };
  parser.oncdata = (t) => {
    if (!inUser) text += t;
  };
  parser.onclosetag = (name) => {
    stack.pop();
    const parent = stack[stack.length - 1];
    if (name === "User") inUser = false;
    else if (parent === "TestResult" && name === "Created") report.date = text.trim();
    else if (parent === "TestResult" && name === "Title") report.title = text.trim();
    else if (line && parent === "TestResultLine") {
      if (name === "Description") line.description = text.trim();
      if (name === "Result") line.result = text;
      if (name === "NormalRange") line.range = text;
    } else if (name === "TestResultLine" && line) {
      lines.push(line);
      line = null;
    }
    text = "";
  };
  parser.write(xml).close();
  return { lines, reports };
}

export function parsePatientAccess(input: Buffer | string, tz: string, sex?: string | null): ParsedImport {
  const xml = typeof input === "string" ? input : decodeXml(input);
  if (!/<MedicalRecord[\s>]/.test(xml) || !/<TestResults?[\s>]/.test(xml)) {
    throw new Error("This doesn't look like a Patient Access medical record export (no <MedicalRecord>/<TestResults>).");
  }
  const { lines, reports } = readLines(xml.replace(/^\s*<\?xml[^>]*\?>/, ""));
  const rows: ImportRow[] = [];
  const skipped: ParsedImport["skipped"] = [];
  const seen = new Set<string>();
  let from: string | null = null;
  let to: string | null = null;

  for (const l of lines) {
    const date = emisDate(l.date);
    const desc = l.description.replace(/\s+/g, " ").trim();
    if (!date) {
      skipped.push({ date: l.date, description: desc, reason: "no date" });
      continue;
    }
    const lower = desc.toLowerCase();
    if (!desc || NOISE.test(lower)) continue;
    const takenAt = noonOn(date, tz);
    const reportNote = l.title && l.title.toLowerCase() !== lower ? `Patient Access: ${l.title}` : "Patient Access";

    let row: ImportRow | null = null;
    const res = l.result.trim() ? parseResult(l.result) : null;
    if (res) {
      const hit = MAP.find(([re]) => re.test(lower));
      const key = hit?.[1] ?? null;
      const preset = key ? LAB_TEST_BY_KEY[key] : undefined;
      let value = res.value;
      let unit = normUnit(res.unit, key);
      const range = parseRange(l.range);
      let refLow = range?.low ?? null;
      let refHigh = range?.high ?? null;
      if (hit?.[2]) {
        value = hit[2](value);
        unit = preset?.unit ?? unit;
        if (range) {
          refLow = range.low != null ? hit[2](range.low) : null;
          refHigh = range.high != null ? hit[2](range.high) : null;
        }
      }
      if (preset && (!unit || unit === "ratio" || /^\//.test(unit))) unit = preset.unit;
      let rangeFrom: ImportRow["rangeFrom"] = range ? "report" : "none";
      if (!range && preset) {
        const pr = presetRange(preset, sex);
        refLow = pr.refLow ?? null;
        refHigh = pr.refHigh ?? null;
        if (refLow != null || refHigh != null) rangeFrom = "preset";
      }
      // "90 mL/min >" and "< 0.5" are bounds, not exact values: keep the number for charts, show the bound.
      const valueText = res.qualifier ? `${res.qualifier}${value}` : null;
      row = {
        testKey: preset ? preset.key : "custom",
        name: preset ? preset.name : desc,
        panel: preset ? preset.panel : l.title || "Other",
        value,
        valueText: valueText,
        unit,
        refLow,
        refHigh,
        takenAt,
        lab: "GP record",
        notes: reportNote,
        source: desc,
        flag: "unknown",
        rangeFrom,
      };
    } else if (!l.result.trim()) {
      const f = textFinding(desc);
      if (!f) {
        skipped.push({ date, description: desc, reason: "no result value in the export" });
        continue;
      }
      row = {
        testKey: "custom",
        name: f.name,
        panel: /^urine/i.test(f.name) ? "Urine" : l.title || "Other",
        value: f.value ?? null,
        valueText: f.text,
        unit: f.value != null ? "pH" : "",
        refLow: null,
        refHigh: null,
        takenAt,
        lab: "GP record",
        notes: reportNote,
        source: desc,
        flag: "unknown",
        rangeFrom: "none",
      };
    } else {
      skipped.push({ date, description: desc, reason: `couldn't read "${l.result.trim()}"` });
      continue;
    }

    row.flag = labFlag(row);
    const k = `${row.testKey}|${row.name}|${row.takenAt}|${row.value ?? row.valueText}`;
    if (seen.has(k)) continue; // same reading listed under two headings (e.g. sitting BP and O/E BP)
    seen.add(k);
    rows.push(row);
    if (!from || date < from) from = date;
    if (!to || date > to) to = date;
  }
  rows.sort((a, b) => a.takenAt.localeCompare(b.takenAt) || (a.panel ?? "").localeCompare(b.panel ?? ""));
  return { rows, skipped, reports, from, to };
}

/** Strip preview-only fields before saving. */
export function toInputs(rows: ImportRow[]): LabResultInput[] {
  return rows.map(({ source: _s, flag: _f, rangeFrom: _r, ...rest }) => rest);
}
