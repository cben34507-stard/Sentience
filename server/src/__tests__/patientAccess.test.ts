import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../lib/db.js";
import { parsePatientAccess, toInputs, emisDate } from "../services/patientAccess.js";
import { createLab, listLabs } from "../services/labs.js";

// Synthetic record: invented person, invented NHS number, invented results.
const XML = `<?xml version="1.0" encoding="utf-16"?>
<MedicalRecord xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Source>
    <System><Name>Patient Access</Name><Provider>EMIS</Provider></System>
    <User>
      <Name>Mx Test Person</Name>
      <DateOfBirth>01 Jan 1990</DateOfBirth>
      <Identifiers><PatientIdentifier><Type>NhsNumber</Type><Value>9990001112</Value></PatientIdentifier></Identifiers>
    </User>
  </Source>
  <TestResults>
    <TestResult>
      <Created>02 Mar 2026</Created><Title>Liver function test</Title><Type>TestResult</Type>
      <TestResultLines>
        <TestResultLine><Description>Serum ALT level</Description><Result>62 IU/L </Result><NormalRange>0 - 50 </NormalRange></TestResultLine>
        <TestResultLine><Description>Serum total bilirubin level</Description><Result>9 umol/L </Result><NormalRange>5 - 21 </NormalRange></TestResultLine>
      </TestResultLines>
    </TestResult>
    <TestResult>
      <Created>02 Mar 2026</Created><Title>Full blood count - FBC</Title><Type>TestResult</Type>
      <TestResultLines>
        <TestResultLine><Description>Basophil count</Description><Result>0.05 10*9/L </Result><NormalRange>0 - .1 </NormalRange></TestResultLine>
        <TestResultLine><Description>Haematocrit</Description><Result>0.43</Result><NormalRange>0.4 - .54 </NormalRange></TestResultLine>
      </TestResultLines>
    </TestResult>
    <TestResult>
      <Created>02 Mar 2026</Created><Title>Serum lipids</Title><Type>TestResult</Type>
      <TestResultLines>
        <TestResultLine><Description>Serum cholesterol</Description><Result>5.4 mmol/L </Result><NormalRange>&lt; 5.2 </NormalRange></TestResultLine>
        <TestResultLine><Description>Serum HDL cholesterol level</Description><Result>0.95 mmol/L </Result><NormalRange>N/A</NormalRange></TestResultLine>
      </TestResultLines>
    </TestResult>
    <TestResult>
      <Created>05 Mar 2026</Created><Title>O/E - blood pressure reading</Title><Type>Value</Type>
      <TestResultLines>
        <TestResultLine><Description>Systolic arterial pressure</Description><Result>132 mmHg</Result><NormalRange>N/A</NormalRange></TestResultLine>
        <TestResultLine><Description>Diastolic arterial pressure</Description><Result>82 mmHg</Result><NormalRange>N/A</NormalRange></TestResultLine>
      </TestResultLines>
    </TestResult>
    <TestResult>
      <Created>05 Mar 2026</Created><Title>Sitting diastolic blood pressure</Title><Type>Value</Type>
      <TestResultLines>
        <TestResultLine><Description>Sitting diastolic blood pressure</Description><Result>82 mmHg</Result><NormalRange>N/A</NormalRange></TestResultLine>
      </TestResultLines>
    </TestResult>
    <TestResult>
      <Created>05 Mar 2026</Created><Title>Renal profile</Title><Type>TestResult</Type>
      <TestResultLines>
        <TestResultLine><Description>eGFRcreat (CKD-EPI)/1.73 m*2</Description><Result>90 mL/min &gt;</Result><NormalRange>N/A</NormalRange></TestResultLine>
      </TestResultLines>
    </TestResult>
    <TestResult>
      <Created>06 Mar 2026</Created><Title>Lung function</Title><Type>Value</Type>
      <TestResultLines>
        <TestResultLine><Description>FEV1/FVC percent</Description><Result>76 %</Result><NormalRange>N/A</NormalRange></TestResultLine>
        <TestResultLine><Description>Expected FVC</Description><Result>5.1 L</Result><NormalRange>N/A</NormalRange></TestResultLine>
      </TestResultLines>
    </TestResult>
    <TestResult>
      <Created>06 Mar 2026</Created><Title>Urine nitrite negative</Title><Type>Observation</Type>
      <TestResultLines><TestResultLine><Description>Urine nitrite negative</Description><Result>  </Result><NormalRange>N/A</NormalRange></TestResultLine></TestResultLines>
    </TestResult>
    <TestResult>
      <Created>06 Mar 2026</Created><Title>MRI</Title><Type>Observation</Type>
      <TestResultLines><TestResultLine><Description>MRI</Description><Result> </Result><NormalRange>N/A</NormalRange></TestResultLine></TestResultLines>
    </TestResult>
    <TestResult>
      <Created>06 Mar 2026</Created><Title>NOTICE</Title><Type>TestResult</Type>
      <TestResultLines><TestResultLine><Description>NOTICE</Description><Result> </Result><NormalRange>N/A</NormalRange></TestResultLine></TestResultLines>
    </TestResult>
  </TestResults>
</MedicalRecord>`;

test("Patient Access export: maps results, keeps report ranges, never reads identity", () => {
  // Declared utf-16 but delivered as UTF-8, exactly like the real export.
  const p = parsePatientAccess(Buffer.from(XML, "utf8"), "Europe/London", "male");
  const json = JSON.stringify(p);
  assert.ok(!json.includes("Test Person") && !json.includes("9990001112") && !json.includes("1990"), "identity must not leak");

  const by = (k: string) => p.rows.filter((r) => r.testKey === k);
  const alt = by("alt")[0];
  assert.equal(alt.value, 62);
  assert.equal(alt.unit, "U/L");
  assert.equal(alt.refHigh, 50);
  assert.equal(alt.rangeFrom, "report");
  assert.equal(alt.flag, "high");
  assert.equal(alt.takenAt, "2026-03-02T12:00:00.000Z");

  assert.equal(by("basophils")[0].refHigh, 0.1);
  assert.equal(by("basophils")[0].unit, "×10⁹/L");
  assert.equal(by("hct")[0].unit, "L/L");
  assert.equal(by("chol_total")[0].refHigh, 5.2);
  assert.equal(by("chol_total")[0].flag, "high");
  // No range on the report: falls back to the UK preset.
  assert.equal(by("hdl")[0].rangeFrom, "preset");
  assert.equal(by("hdl")[0].flag, "low");
  // The same diastolic reading listed under two headings is kept once.
  assert.equal(by("bp_dia").length, 1);
  assert.equal(by("bp_sys")[0].value, 132);
  assert.equal(by("egfr")[0].valueText, ">90");
  // Percent converted to the ratio the preset uses.
  assert.equal(by("fev1_fvc")[0].value, 0.76);
  assert.ok(p.rows.some((r) => r.testKey === "custom" && r.name === "Expected FVC"));
  const urine = p.rows.find((r) => r.name === "Urine nitrite (dipstick)");
  assert.equal(urine?.valueText, "negative");
  assert.deepEqual(p.skipped.map((s) => s.description), ["MRI"]);
  assert.equal(p.from, "2026-03-02");
  assert.equal(p.to, "2026-03-06");

  // Importing twice adds nothing the second time.
  const db = openDatabase(":memory:");
  const first = toInputs(p.rows).map((i) => createLab(db, i));
  const second = toInputs(p.rows).map((i) => createLab(db, i));
  assert.equal(first.filter((r) => !r.duplicate).length, p.rows.length);
  assert.equal(second.filter((r) => !r.duplicate).length, 0);
  assert.equal(listLabs(db).length, p.rows.length);
});

test("Patient Access export: real UTF-16 files and junk", () => {
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(XML, "utf16le")]);
  assert.equal(parsePatientAccess(utf16, "Europe/London").rows.length, parsePatientAccess(XML, "Europe/London").rows.length);
  assert.throws(() => parsePatientAccess("<HealthData/>", "Europe/London"), /Patient Access/);
  assert.equal(emisDate("7 Sep 2026"), "2026-09-07");
  assert.equal(emisDate("nonsense"), null);
});
