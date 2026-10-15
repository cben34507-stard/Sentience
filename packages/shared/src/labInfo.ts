/**
 * Plain-English notes for each LAB_TESTS preset: what the test measures, what
 * high and low results usually mean, and the UK range it is judged against.
 * Written for the person whose results they are, not for clinicians.
 */
export interface LabInfo {
  /** What it measures and why it's checked. 1–2 short sentences. */
  what: string;
  /** What a high result commonly means (most common causes first). 1–2 sentences. Omit if high isn't meaningful. */
  high?: string;
  /** Same for low. Omit if low isn't meaningful. */
  low?: string;
  /** The UK range or thresholds in words, with the source, e.g. "Under 42 mmol/mol is normal, 42–47 is a higher risk of diabetes, 48 or more suggests diabetes (NICE)." */
  uk: string;
  /** Optional practical note: things that skew the result (fasting, exercise, time of day, biotin, recent illness), or unit conversions. One sentence. */
  tip?: string;
}

const LAB_RANGE_NOTE = "labs differ, so the range printed on your report takes priority";
const TAPE_UK = "No reference range; track the trend.";

export const LAB_INFO: Record<string, LabInfo> = {
  /* ---------------------------- Diabetes & glucose ---------------------------- */
  hba1c: {
    what: "Your average blood sugar over the past 2–3 months, measured by how much sugar has stuck to your red blood cells. It is the main test used to check for and monitor diabetes.",
    high: "Commonly means blood sugar has been running high, as in prediabetes or type 2 diabetes. Iron deficiency and some kidney problems can also push it up a little.",
    low: "Rarely a concern. It can read low when red cells are replaced faster than usual, for example after bleeding, a transfusion or with some blood conditions.",
    uk: "Under 42 mmol/mol is normal, 42–47 is a higher risk of diabetes (often called prediabetes), and 48 or more suggests diabetes, usually confirmed with a repeat test (NICE).",
    tip: "No fasting needed; results can be misleading in pregnancy, anaemia, after recent blood loss or with an inherited haemoglobin variant, and older reports may use % (48 mmol/mol is about 6.5%).",
  },
  glucose_fasting: {
    what: "The sugar level in your blood after not eating for at least 8 hours. It is used to check for diabetes and to see how well it is controlled.",
    high: "Commonly due to prediabetes or diabetes. Illness, stress, steroid medicines or not fully fasting can also raise it.",
    low: "Uncommon in people without diabetes. In people on insulin or some tablets, below 4 mmol/L counts as a hypo and needs treating.",
    uk: `Typical NHS lab range is about 3.5–6.0 mmol/L; ${LAB_RANGE_NOTE}. 6.1–6.9 is called impaired fasting glucose and 7.0 or more suggests diabetes (WHO criteria used in the UK), usually confirmed with a repeat or an HbA1c.`,
    tip: "Have nothing but water for at least 8 hours beforehand; to convert from mg/dL, divide by 18.",
  },
  glucose_random: {
    what: "The sugar level in your blood at whatever time the sample was taken, regardless of when you last ate.",
    high: "Often just reflects a recent meal or sugary drink. Repeatedly high results can point to prediabetes or diabetes; illness, stress and steroid medicines also raise it.",
    low: "Uncommon in people without diabetes. In people on insulin or some tablets, below 4 mmol/L counts as a hypo and needs treating.",
    uk: `Typical NHS lab range is about 3.5–7.8 mmol/L; ${LAB_RANGE_NOTE}. A random glucose of 11.1 or more with symptoms such as thirst and passing a lot of urine suggests diabetes (WHO criteria used in the UK), usually confirmed with an HbA1c or fasting test.`,
    tip: "The result depends heavily on what and when you last ate, so note the time of your last meal.",
  },

  /* ---------------------------------- Lipids ---------------------------------- */
  chol_total: {
    what: "All the cholesterol in your blood, the 'bad' LDL and 'good' HDL together. It is used with other factors to estimate your risk of heart disease and stroke.",
    high: "Commonly linked to diet, weight, inactivity and family genes. An underactive thyroid, diabetes, kidney or liver problems can also raise it; a very high level can point to familial hypercholesterolaemia, an inherited condition.",
    low: "Rarely a concern, and usually due to cholesterol-lowering medicine. Occasionally seen with an overactive thyroid or poor nutrition.",
    uk: "Under 5 mmol/L is the healthy target for adults (NHS). NICE suggests considering familial hypercholesterolaemia if it is above 7.5, especially with a family history of early heart disease.",
    tip: "Fasting is not usually needed; treatment decisions are based on your overall heart risk score (QRISK3), not this number alone.",
  },
  ldl: {
    what: "LDL is often called 'bad' cholesterol because it can build up in artery walls. It is the main target of cholesterol-lowering treatment.",
    high: "Commonly due to diet high in saturated fat, family genes, weight and inactivity. An underactive thyroid, kidney or liver problems can also raise it.",
    low: "Not usually a concern; most often a sign that cholesterol-lowering medicine is working.",
    uk: "Under 3 mmol/L is the general healthy target (NHS). For people who have had a heart attack or stroke, NICE aims for 2.0 or less.",
    tip: "LDL is often calculated from the other lipid results rather than measured, which is less reliable when triglycerides are high.",
  },
  hdl: {
    what: "HDL is often called 'good' cholesterol because it carries cholesterol away from the arteries to the liver. Higher levels are linked to lower heart risk.",
    high: "Usually a good sign. Regular exercise and genes raise it; alcohol can too, which is not a reason to drink more.",
    low: "Commonly linked to inactivity, being overweight, smoking, type 2 diabetes and high triglycerides. Genes play a part too.",
    uk: "Above 1.0 mmol/L for men and above 1.2 mmol/L for women is the healthy target (NHS).",
    tip: "Fasting is not usually needed; regular aerobic exercise and stopping smoking are the most reliable ways to raise it.",
  },
  non_hdl: {
    what: "Total cholesterol minus HDL: all the cholesterol carried by particles that can clog arteries. NICE uses it as the main measure for judging and treating heart risk.",
    high: "Commonly due to diet, weight, inactivity and family genes. High triglycerides, diabetes, an underactive thyroid or kidney problems can also raise it.",
    low: "Not usually a concern; most often a sign that cholesterol-lowering medicine is working.",
    uk: "Under 4 mmol/L is the healthy target (NHS). On a statin, NICE aims for a fall of more than 40%, and 2.6 or less for people who have had a heart attack or stroke.",
    tip: "It does not need fasting and stays reliable after a meal, which is one reason NICE prefers it to LDL.",
  },
  triglycerides: {
    what: "A type of fat in the blood that the body uses for energy. High levels add to heart risk.",
    high: "Commonly due to a recent meal, alcohol, being overweight, diabetes or a diet high in sugar and refined carbohydrates. An underactive thyroid, kidney disease, some medicines and genes can also raise it. Very high levels (above 10 mmol/L) need prompt review because they can inflame the pancreas.",
    low: "Not usually a concern.",
    uk: "Under 1.7 mmol/L fasting or under 2.3 mmol/L non-fasting is healthy (NHS).",
    tip: "Food and alcohol in the previous day can raise it noticeably, so a fasting repeat is often requested if it is high.",
  },
  chol_hdl_ratio: {
    what: "Your total cholesterol divided by your HDL. It combines 'bad' and 'good' cholesterol into one number and is used in the QRISK3 heart risk calculator.",
    high: "Commonly reflects high total cholesterol, low HDL, or both. The usual lifestyle factors and family genes apply.",
    low: "A low ratio is a good sign.",
    uk: "There is no single national cut-off. Many UK labs and HEART UK treat 4 or below as ideal and above 6 as high.",
    tip: "Fasting is not usually needed.",
  },

  /* ----------------------------- Vitamins & iron ----------------------------- */
  vitd: {
    what: "The main stored form of vitamin D, which you mostly make from sunlight on your skin. It helps keep bones and muscles healthy.",
    high: "Almost always from high-dose supplements. Levels well above the range are worth discussing, as too much can raise calcium.",
    low: "Very common in the UK, especially in winter, with darker skin, covering up outdoors or spending little time outside. Long-term low levels can cause bone pain and soft bones.",
    uk: "Below 25 nmol/L is deficient, 25–50 may be inadequate for some people, and above 50 is sufficient (SACN and National Osteoporosis Society bands). The preset upper limit of 150 is a typical lab level above which there is no added benefit.",
    tip: "Levels are lowest in late winter and highest in late summer; to convert from ng/mL multiply by 2.5.",
  },
  b12: {
    what: "Vitamin B12 is needed to make red blood cells and keep nerves healthy. It is checked when someone is tired, anaemic, has large red cells or numbness and tingling.",
    high: "Most often from supplements or injections. Less commonly seen with liver disease or some blood conditions.",
    low: "Common causes are a vegan or low-animal-food diet, pernicious anaemia (an autoimmune condition that stops B12 being absorbed), long-term metformin or stomach-acid medicines, and stomach or bowel surgery or disease.",
    uk: `Typical NHS lab range is about 200–900 ng/L; ${LAB_RANGE_NOTE}. Results just either side of the lower limit are a grey area, and a further test such as active B12 may be done if you have symptoms.`,
    tip: "Reports use ng/L or pmol/L (1 ng/L is about 0.74 pmol/L, so 200 ng/L is about 148 pmol/L); levels also fall naturally in pregnancy.",
  },
  folate: {
    what: "Folate (vitamin B9) is needed to make red blood cells and is especially important around pregnancy. It is usually checked alongside B12.",
    high: "Usually from supplements or fortified foods and not harmful in itself.",
    low: "Commonly due to a diet low in green vegetables, pulses and fortified foods, regular heavy drinking, coeliac disease, pregnancy or some medicines such as methotrexate and some epilepsy medicines.",
    uk: `Typical NHS lab range is about 3–20 µg/L; ${LAB_RANGE_NOTE}.`,
    tip: "Serum folate reflects recent eating, so a few days of good or poor diet can shift it; 1 µg/L is about 2.27 nmol/L.",
  },
  ferritin: {
    what: "A protein that stores iron; the blood level reflects how much iron your body has in reserve. It is the most useful single test for iron deficiency.",
    high: "Most often due to inflammation or infection, regular alcohol, fatty liver or being overweight, because ferritin rises with all of these. Less often it reflects iron overload such as haemochromatosis, which is checked with transferrin saturation.",
    low: "Means iron stores are low, commonly from heavy periods, pregnancy, a low-iron diet, or blood loss from the gut. Iron deficiency in men and in women after the menopause is usually investigated.",
    uk: "Below 30 µg/L confirms iron deficiency (NICE). Typical upper limits are about 400 µg/L for men and 200 µg/L for women, though labs differ.",
    tip: "Any infection or inflammation raises ferritin, so it can look normal even when iron is low; NICE notes that with inflammation a level up to 100 can still fit iron deficiency.",
  },
  iron: {
    what: "The amount of iron circulating in your blood at that moment. It varies a lot from hour to hour, so ferritin and transferrin saturation are more useful for judging iron stores.",
    high: "Commonly due to recent iron tablets or an iron-rich meal. Persistently high levels with high ferritin and transferrin saturation can point to iron overload.",
    low: "Can mean iron deficiency, but infection or inflammation also lowers it even when stores are fine.",
    uk: `Typical NHS lab range is about 10–30 µmol/L; ${LAB_RANGE_NOTE}.`,
    tip: "Levels are higher in the morning and after iron tablets, so a fasting morning sample without that day's iron dose is most comparable.",
  },
  tsat: {
    what: "How much of the iron-carrying protein in your blood (transferrin) is filled with iron. It helps tell iron deficiency from iron overload.",
    high: "Can be due to recent iron tablets. Persistently high results, especially with high ferritin, can point to haemochromatosis, an inherited iron overload condition that is common in people of Northern European descent.",
    low: "Commonly means iron deficiency. Inflammation or long-term illness can also lower it.",
    uk: `Typical NHS lab range is about 20–50%; ${LAB_RANGE_NOTE}.`,
    tip: "Recent iron tablets or an iron-rich meal raise it, so a fasting morning sample is often preferred when checking for overload.",
  },

  /* ----------------------------- Full blood count ----------------------------- */
  hb: {
    what: "Haemoglobin is the protein in red blood cells that carries oxygen. A low level is called anaemia.",
    high: "Commonly due to smoking, dehydration, testosterone treatment, living at altitude, or lung conditions and sleep apnoea. Rarely it is due to a bone marrow condition.",
    low: "Anaemia; iron deficiency is the most common cause, followed by low B12 or folate, blood loss, long-term illness and kidney disease. A very low level or a sudden fall, especially with breathlessness, chest pain or dizziness, needs prompt medical advice.",
    uk: "Men 130–180 g/L and women 115–165 g/L (Pathology Harmony).",
    tip: "Some reports use g/dL: 130 g/L is 13.0 g/dL; dehydration can make it read higher.",
  },
  rbc: {
    what: "The number of red blood cells in a given volume of blood. It is read alongside haemoglobin and cell size (MCV).",
    high: "Commonly due to dehydration, smoking, testosterone treatment or living at altitude. A high count with small cells is typical of thalassaemia trait, which is usually harmless.",
    low: "Usually goes with anaemia, from iron deficiency, low B12 or folate, blood loss or long-term illness.",
    uk: `Typical NHS lab range is about 4.5–6.5 ×10¹²/L for men and 3.8–5.8 for women; ${LAB_RANGE_NOTE}.`,
    tip: "Dehydration can make it read higher.",
  },
  hct: {
    what: "Haematocrit is the share of your blood made up of red cells. It is closely linked to haemoglobin.",
    high: "Commonly due to dehydration, smoking or testosterone treatment; on testosterone, a haematocrit above 0.54 usually prompts a review of the dose. Lung conditions, sleep apnoea and rarely a bone marrow condition can also raise it.",
    low: "Usually goes with anaemia, from iron deficiency, low B12 or folate, blood loss or long-term illness.",
    uk: `Typical NHS lab range is about 0.40–0.52 L/L for men and 0.37–0.47 L/L for women; ${LAB_RANGE_NOTE}.`,
    tip: "Some reports show it as a percentage: 0.45 L/L is 45%.",
  },
  wbc: {
    what: "The total number of white blood cells, which fight infection. The breakdown into types (neutrophils, lymphocytes and so on) is usually more informative.",
    high: "Commonly due to infection, inflammation, smoking, steroid medicines, pregnancy, or recent stress or hard exercise. Rarely it is due to a blood condition.",
    low: "Commonly seen during or after a viral infection or with some medicines. Many people of Black African, African-Caribbean or Middle Eastern descent naturally have lower counts, which is harmless.",
    uk: "4.0–11.0 ×10⁹/L (Pathology Harmony).",
  },
  platelets: {
    what: "Platelets are small cells that help blood clot. The count is checked as part of a full blood count.",
    high: "Commonly a reaction to infection, inflammation, iron deficiency, recent surgery or bleeding. Rarely it is due to a bone marrow condition.",
    low: "Can follow a viral infection, regular heavy drinking, liver disease or some medicines, or be due to the immune system clearing platelets. Easy bruising, nosebleeds or tiny red spots on the skin with a low count need prompt medical advice.",
    uk: "150–400 ×10⁹/L (Pathology Harmony).",
    tip: "Platelets sometimes clump in the sample tube and read falsely low, so a surprising result is usually repeated.",
  },
  mcv: {
    what: "Mean cell volume: the average size of your red blood cells. It helps point to the cause of anaemia.",
    high: "Commonly linked to alcohol, low B12 or folate, liver disease, an underactive thyroid or some medicines.",
    low: "Commonly due to iron deficiency or thalassaemia trait, an inherited and usually harmless condition.",
    uk: "80–100 fL (Pathology Harmony).",
  },
  mch: {
    what: "Mean cell haemoglobin: the average amount of haemoglobin in each red blood cell. It usually moves with MCV.",
    high: "Usually goes with large red cells, as with low B12 or folate, alcohol or liver disease.",
    low: "Commonly due to iron deficiency or thalassaemia trait.",
    uk: "27–32 pg (Pathology Harmony).",
  },
  mchc: {
    what: "Mean cell haemoglobin concentration: how concentrated the haemoglobin is inside your red cells.",
    high: "Uncommon; can be due to hereditary spherocytosis, or to a problem with the sample such as clumping when cold or very fatty blood.",
    low: "Commonly due to iron deficiency or thalassaemia trait.",
    uk: `Typical NHS lab range is about 320–360 g/L; ${LAB_RANGE_NOTE}.`,
    tip: "Some reports use g/dL: 330 g/L is 33 g/dL.",
  },
  rdw: {
    what: "Red cell distribution width: how much your red cells vary in size. It helps tell different types of anaemia apart.",
    high: "Means a mix of cell sizes, often from early iron deficiency, low B12 or folate, or recent blood loss or a transfusion.",
    uk: `Typical NHS lab range is about 11.5–15%; ${LAB_RANGE_NOTE}.`,
  },
  neutrophils: {
    what: "The most common white blood cell, the first line of defence against bacterial infection.",
    high: "Commonly due to bacterial infection, inflammation, steroid medicines, smoking, stress, pregnancy or recent hard exercise.",
    low: "Commonly seen after viral infections or with some medicines. Many people of Black African, African-Caribbean or Middle Eastern descent naturally have lower counts, which is harmless. A very low count with a fever needs urgent medical advice.",
    uk: `Typical NHS lab range is about 2.0–7.5 ×10⁹/L; ${LAB_RANGE_NOTE}.`,
  },
  lymphocytes: {
    what: "White blood cells that fight viruses and make antibodies.",
    high: "Commonly due to viral infections such as glandular fever. A count that stays raised in an older adult is usually looked into further.",
    low: "Commonly seen during illness, after steroid medicines, with stress or after hard exercise. Some medicines and immune conditions also lower it.",
    uk: `Typical NHS lab range is about 1.0–4.0 ×10⁹/L; ${LAB_RANGE_NOTE}.`,
  },
  monocytes: {
    what: "White blood cells that clear up debris and help fight longer-lasting infections.",
    high: "Commonly seen while recovering from an infection, or with long-term infections and inflammatory conditions.",
    low: "Rarely significant on its own; steroid medicines can lower it.",
    uk: `Typical NHS lab range is about 0.2–0.8 ×10⁹/L; ${LAB_RANGE_NOTE}.`,
  },
  eosinophils: {
    what: "White blood cells involved in allergies and fighting parasites.",
    high: "Commonly due to allergies, asthma, eczema or hay fever. Some medicines and parasite infections (especially after travel) can also raise it.",
    uk: `Typical NHS lab range is about 0–0.4 ×10⁹/L; ${LAB_RANGE_NOTE}.`,
  },
  basophils: {
    what: "The least common white blood cell, involved in allergic reactions.",
    high: "Uncommon; can be seen with allergic or inflammatory conditions or an underactive thyroid, and rarely with a blood condition.",
    uk: `Typical NHS lab range is about 0–0.1 ×10⁹/L; ${LAB_RANGE_NOTE}.`,
  },

  /* ---------------------------------- Thyroid --------------------------------- */
  tsh: {
    what: "Thyroid stimulating hormone, made by the pituitary gland to tell the thyroid how hard to work. It is the first test for thyroid problems.",
    high: "Commonly means an underactive thyroid, often from Hashimoto's thyroiditis, or that a levothyroxine dose is too low. It can rise briefly while recovering from an illness.",
    low: "Commonly means an overactive thyroid or too high a levothyroxine dose. Recent illness, steroids and early pregnancy can also lower it.",
    uk: `Typical NHS lab range is about 0.27–4.2 mU/L; ${LAB_RANGE_NOTE}. NICE suggests considering treatment for a mildly underactive thyroid when TSH is 10 or more on two tests 3 months apart.`,
    tip: "Biotin supplements can distort thyroid results, so stop them for at least 2 days before the test unless your doctor says otherwise; TSH is a little higher in the early morning.",
  },
  ft4: {
    what: "The main hormone made by the thyroid, measured in its active, unbound form. It is read together with TSH.",
    high: "Commonly due to an overactive thyroid or too high a levothyroxine dose. Some medicines, such as amiodarone, can also raise it.",
    low: "Commonly due to an underactive thyroid. Low FT4 without a high TSH can rarely point to a pituitary problem.",
    uk: `Typical NHS lab range is about 12–22 pmol/L; ${LAB_RANGE_NOTE}.`,
    tip: "Biotin supplements can distort the result, and taking levothyroxine shortly before the test can raise it slightly.",
  },
  ft3: {
    what: "The most active thyroid hormone, in its unbound form. It is mainly checked when TSH is low, to look for an overactive thyroid.",
    high: "Commonly due to an overactive thyroid or taking T3 (liothyronine).",
    low: "Often seen during illness or calorie restriction, when the body lowers T3 to save energy. It is not a reliable test for an underactive thyroid on its own.",
    uk: `Typical NHS lab range is about 3.1–6.8 pmol/L; ${LAB_RANGE_NOTE}.`,
    tip: "Biotin supplements can distort the result.",
  },

  /* ----------------------------------- Liver ---------------------------------- */
  alt: {
    what: "An enzyme mostly found in the liver; it leaks into the blood when liver cells are irritated or damaged. It is the main liver test on a routine panel.",
    high: "Most commonly due to fatty liver, alcohol, or some medicines and supplements. Viral hepatitis, coeliac disease and muscle strain can also raise it; a level many times the upper limit needs prompt review.",
    uk: "Upper limits vary between UK labs, roughly 30–50 U/L (British Society of Gastroenterology); Sentience uses 40 unless your report gives its own range.",
    tip: "Hard exercise in the previous few days (especially weight training), alcohol and some supplements can raise ALT, so mention them if a repeat is planned.",
  },
  ast: {
    what: "An enzyme found in the liver, muscles and heart. It is read alongside ALT and is used in the FIB-4 liver score.",
    high: "Commonly due to fatty liver, alcohol or muscle strain from exercise. AST higher than ALT can point to alcohol-related liver disease or more advanced scarring.",
    uk: `Typical NHS lab range is up to about 40 U/L; ${LAB_RANGE_NOTE}.`,
    tip: "Hard exercise and a damaged (haemolysed) sample can raise AST.",
  },
  alp: {
    what: "An enzyme found mainly in the liver, bile ducts and bones. It helps show whether a problem is in the liver's drainage system or in bone.",
    high: "Can come from bone (growth in teenagers, a healing fracture, low vitamin D, Paget's disease) or from the liver and bile ducts. It rises normally in pregnancy; a raised GGT points to the liver.",
    low: "Uncommon; can be due to low zinc or magnesium, or rarely an inherited condition called hypophosphatasia.",
    uk: "30–130 U/L (Pathology Harmony).",
  },
  ggt: {
    what: "A liver enzyme that is sensitive to alcohol and to blockage of the bile ducts. It helps tell whether a raised ALP comes from the liver.",
    high: "Commonly due to alcohol, fatty liver, or medicines such as some epilepsy medicines. Bile duct problems also raise it.",
    uk: `Typical NHS lab range is up to about 55 U/L; some labs use a lower limit for women, and ${LAB_RANGE_NOTE}.`,
    tip: "It can stay raised for several weeks after regular drinking stops.",
  },
  bilirubin: {
    what: "A yellow pigment made when old red blood cells are broken down; the liver clears it into bile.",
    high: "Most commonly due to Gilbert's syndrome, a common and harmless inherited trait. Red cell breakdown and liver or bile duct problems can also raise it; yellow skin or eyes with dark urine or pale stools needs prompt medical advice.",
    uk: "Under 21 µmol/L (Pathology Harmony).",
    tip: "In Gilbert's syndrome, fasting, illness and stress push it up, so it may vary between tests.",
  },
  albumin: {
    what: "The main protein in blood, made by the liver. It reflects overall health, nutrition and liver and kidney function.",
    high: "Usually means dehydration, or the tourniquet was on for a while.",
    low: "Commonly due to illness or inflammation. Liver disease, protein loss through the kidneys or gut, and poor nutrition can also lower it.",
    uk: "35–50 g/L (Pathology Harmony).",
    tip: "Dehydration and a tight tourniquet can make it read slightly high.",
  },
  total_protein: {
    what: "All the protein in your blood: mainly albumin plus globulins (including antibodies).",
    high: "Commonly due to dehydration or long-term inflammation or infection. A persistently high level is sometimes checked with a further protein test.",
    low: "Commonly goes with low albumin, from illness, liver disease, protein loss or poor nutrition.",
    uk: "60–80 g/L (Pathology Harmony).",
  },
  globulin: {
    what: "Total protein minus albumin: mostly antibodies and other immune and carrier proteins. It is usually calculated rather than measured.",
    high: "Commonly due to inflammation, long-term infection, liver disease or autoimmune conditions. A persistently raised level is often followed up with a test called serum protein electrophoresis.",
    low: "Uncommon; can be due to some medicines, protein loss, or occasionally the body making too few antibodies.",
    uk: `Typical NHS lab range is about 20–35 g/L; ${LAB_RANGE_NOTE}.`,
  },
  fib4: {
    what: "A score worked out from your age, AST, ALT and platelet count. It estimates the chance of advanced scarring (fibrosis) in the liver, mainly in fatty liver disease.",
    high: "Does not diagnose scarring, but means further testing is worthwhile, usually an ELF blood test or a liver scan (FibroScan).",
    uk: "Below 1.30 is low risk of advanced fibrosis, 1.30–2.67 is indeterminate and usually followed by an ELF test, and above 2.67 is high risk (British Society of Gastroenterology). If you are 65 or over, 2.0 is used as the lower cut-off.",
    tip: "The score is less reliable under 35 and rises with age; a recent spike in ALT or AST from exercise or illness can shift it.",
  },

  /* --------------------------- Kidney & electrolytes -------------------------- */
  creatinine: {
    what: "A waste product from muscle that the kidneys filter out. It is used to calculate eGFR, the main measure of kidney function.",
    high: "Commonly due to a muscular build, creatine supplements, a recent meat meal or dehydration. It also rises when the kidneys are working less well and with some medicines.",
    low: "Usually reflects lower muscle mass; it is also lower in pregnancy.",
    uk: `Typical NHS lab range is about 59–104 µmol/L for men and 45–84 µmol/L for women; ${LAB_RANGE_NOTE}.`,
    tip: "NICE advises not eating meat in the 12 hours before the test; creatine supplements and muscle mass also raise it.",
  },
  egfr: {
    what: "Estimated glomerular filtration rate: how well your kidneys are filtering, calculated from creatinine, age and sex.",
    low: "Can be due to age, dehydration or kidney disease. It can read falsely low in muscular people or those taking creatine; a sudden fall needs prompt review.",
    uk: "60 or above is normal if there are no other signs of kidney damage. NICE stages are G1 90+, G2 60–89, G3a 45–59, G3b 30–44, G4 15–29 and G5 below 15; chronic kidney disease is only diagnosed if it stays below 60 for 3 months or there are other signs such as protein in the urine.",
    tip: "Because it is based on creatinine, a meat meal, creatine supplements or a muscular build can lower it; a cystatin C test can give a clearer picture.",
  },
  urea: {
    what: "A waste product from breaking down protein, cleared by the kidneys. It is read alongside creatinine.",
    high: "Commonly due to dehydration or a high-protein diet. Kidney problems, steroid medicines and bleeding in the stomach can also raise it.",
    low: "Commonly due to a low-protein diet, pregnancy or drinking a lot of fluid; rarely liver disease.",
    uk: `Typical NHS lab range is about 2.5–7.8 mmol/L; ${LAB_RANGE_NOTE}.`,
  },
  sodium: {
    what: "A salt that controls the balance of water in your body and helps nerves and muscles work.",
    high: "Usually due to dehydration, from not drinking enough or losing fluid.",
    low: "Commonly due to medicines such as water tablets (thiazides) and some antidepressants, drinking large amounts of water (including during endurance events), or heart, liver or kidney conditions. Large changes, especially with confusion, drowsiness or headache, need prompt medical advice.",
    uk: "133–146 mmol/L (Pathology Harmony).",
  },
  potassium: {
    what: "A salt that is vital for heart rhythm and muscle function. It is checked routinely, especially on blood pressure and kidney medicines.",
    high: "Often a false reading from blood cells breaking down in the sample. True rises are due to kidney problems or medicines such as ACE inhibitors, ARBs and spironolactone; a level of 6.0 or more usually needs same-day medical attention and a quick repeat.",
    low: "Commonly due to water tablets, vomiting or diarrhoea, or laxatives. Very low levels can affect heart rhythm and need prompt attention.",
    uk: "3.5–5.3 mmol/L (Pathology Harmony).",
    tip: "Delays getting the sample to the lab, a cold sample, a tight tourniquet or clenching your fist can all make it read falsely high.",
  },
  calcium_adj: {
    what: "Calcium adjusted for your albumin level, which gives a truer picture than total calcium. Calcium is vital for bones, nerves and muscles.",
    high: "Most often due to an overactive parathyroid gland. Too much vitamin D or calcium supplement, dehydration and some other conditions can also raise it; above 3.0 mmol/L needs prompt medical advice.",
    low: "Commonly due to low vitamin D, low magnesium or kidney disease, or after neck surgery affecting the parathyroid glands.",
    uk: "2.2–2.6 mmol/L (Pathology Harmony).",
  },
  magnesium: {
    what: "A mineral needed for muscles, nerves and heart rhythm. Low magnesium can make low potassium and calcium hard to correct.",
    high: "Uncommon; usually from kidney problems or magnesium-containing laxatives, antacids or supplements.",
    low: "Commonly due to long-term stomach-acid medicines (such as omeprazole), water tablets, alcohol, diarrhoea or poorly controlled diabetes.",
    uk: "0.7–1.0 mmol/L (Pathology Harmony).",
  },
  calcium: {
    what: "All the calcium in your blood, including the part bound to albumin. Adjusted calcium is usually the figure doctors go by.",
    high: "Can reflect a truly high calcium (most often an overactive parathyroid gland) or simply a high albumin from dehydration.",
    low: "Often just reflects a low albumin; check the adjusted calcium. True low calcium is commonly due to low vitamin D or magnesium.",
    uk: `Typical NHS lab range is about 2.2–2.6 mmol/L; ${LAB_RANGE_NOTE}. The adjusted calcium is the result that is usually interpreted.`,
  },
  phosphate: {
    what: "A mineral that works with calcium to build bones and is used in energy production. It is often checked with calcium.",
    high: "Commonly due to kidney disease, or a delay in processing the sample. Rarely due to an underactive parathyroid gland.",
    low: "Can be due to low vitamin D, an overactive parathyroid gland, alcohol, or refeeding after poor nutrition. It also dips briefly after a sugary meal.",
    uk: "0.8–1.5 mmol/L (Pathology Harmony).",
    tip: "A delay getting the sample to the lab can make it read falsely high.",
  },
  urate: {
    what: "Uric acid is a waste product from breaking down purines, found in the body and in foods. High levels can form crystals that cause gout or kidney stones.",
    high: "Commonly due to alcohol (especially beer), red meat, offal, seafood, sugary drinks, being overweight, reduced kidney function or water tablets. Most people with a high level never get gout.",
    low: "Rarely significant; often due to urate-lowering medicine.",
    uk: `Typical NHS lab range is about 200–430 µmol/L for men and 140–360 µmol/L for women; ${LAB_RANGE_NOTE}. For people treated for gout, NICE aims for below 360, or below 300 if attacks continue.`,
    tip: "Levels can fall during a gout attack, so NICE suggests repeating the test about 2 weeks after it settles.",
  },

  /* --------------------------- Inflammation & hormones ------------------------ */
  crp: {
    what: "C-reactive protein, made by the liver in response to infection or inflammation. It shows that something is going on, not where.",
    high: "Commonly due to an infection, injury, recent surgery or an inflammatory condition such as arthritis. Very high values often need prompt review alongside how you feel.",
    uk: `Typical NHS lab range is under 5 mg/L; ${LAB_RANGE_NOTE}.`,
    tip: "It rises within hours and falls within days, so a minor cold or very hard exercise in the past few days can raise it.",
  },
  esr: {
    what: "Erythrocyte sedimentation rate: how quickly red cells settle in a tube. It is a slower, general marker of inflammation.",
    high: "Commonly due to infection, inflammation, anaemia, pregnancy or older age. It is used to monitor conditions such as polymyalgia rheumatica.",
    uk: `Typical NHS lab range is up to about 20 mm/hr; ${LAB_RANGE_NOTE}. ESR rises with age and is higher in women; a rough upper limit is age ÷ 2 for men and (age + 10) ÷ 2 for women.`,
  },
  testosterone: {
    what: "The main male sex hormone, also made in smaller amounts in women. In men it is checked for low energy, low sex drive, erection problems or loss of muscle.",
    high: "In men, usually from testosterone treatment or anabolic steroids. In women, commonly due to polycystic ovary syndrome; a very high level or rapid changes such as a deepening voice need prompt review.",
    low: "In men, commonly linked to being overweight, type 2 diabetes, poor sleep, recent illness or opioid medicines; less often a problem with the testes or pituitary gland. Low levels after stopping anabolic steroids are common.",
    uk: "For men, below 8 nmol/L is low, 8–12 is borderline so free testosterone should be checked, and above 12 is normal (British Society for Sexual Medicine). For women, a typical NHS lab range is about 0.29–1.67 nmol/L; labs differ, so the range on your report takes priority.",
    tip: "Have blood taken between 7 and 11am, fasting, and repeat a low result on another day before drawing conclusions; illness, poor sleep and heavy training lower it.",
  },
  free_testosterone: {
    what: "The part of testosterone that is not bound to SHBG and is available to the body. It is calculated from total testosterone, SHBG and albumin.",
    high: "In men, usually from testosterone treatment or anabolic steroids. In women, commonly due to polycystic ovary syndrome.",
    low: "Supports testosterone deficiency in men, especially when total testosterone is borderline. Causes are the same as for low total testosterone.",
    uk: "For men, a calculated free testosterone below 0.225 nmol/L supports deficiency (British Society for Sexual Medicine); the upper limit of 0.62 is a typical lab value. This range is for men; women's levels are much lower.",
    tip: "Use a 7–11am fasting sample, as for total testosterone.",
  },
  shbg: {
    what: "Sex hormone binding globulin, a protein that carries testosterone and oestrogen in the blood. It affects how much testosterone is free to work.",
    high: "Commonly due to ageing in men, an overactive thyroid, liver disease, alcohol, low body weight, oestrogen (including the contraceptive pill) or some epilepsy medicines.",
    low: "Commonly due to being overweight, insulin resistance or type 2 diabetes, an underactive thyroid, polycystic ovary syndrome or anabolic steroids.",
    uk: `Typical NHS lab range is about 18–54 nmol/L for men and 26–110 nmol/L for women; ${LAB_RANGE_NOTE}.`,
  },
  lh: {
    what: "Luteinising hormone, made by the pituitary gland. In men it tells the testes to make testosterone; in women it triggers ovulation.",
    high: "In men, commonly means the testes are not responding fully. In women, it rises after the menopause and is often relatively high in polycystic ovary syndrome.",
    low: "With low testosterone, can point to a problem with the pituitary or hypothalamus; testosterone treatment, anabolic steroids, being overweight and opioids also lower it.",
    uk: `Typical NHS lab range for men is about 1.7–8.6 IU/L; ${LAB_RANGE_NOTE}. In women it varies through the cycle and rises after the menopause, so it is judged against the cycle day.`,
  },
  fsh: {
    what: "Follicle stimulating hormone, made by the pituitary gland. In men it supports sperm production; in women it drives egg development.",
    high: "In men, commonly means reduced sperm production or a problem with the testes. In women, it rises around and after the menopause.",
    low: "Can be due to testosterone treatment or anabolic steroids, hormonal contraception, pregnancy, or rarely a pituitary problem.",
    uk: `Typical NHS lab range for men is about 1.5–12.4 IU/L; ${LAB_RANGE_NOTE}. In women it varies through the cycle and rises after the menopause.`,
    tip: "NICE advises that an FSH test is not needed to diagnose the menopause in women over 45 with typical symptoms.",
  },
  prolactin: {
    what: "A hormone from the pituitary gland that triggers breast milk production. It is checked for irregular periods, fertility problems, low sex drive or breast discharge.",
    high: "Commonly due to stress, the blood test itself, pregnancy or breastfeeding, an underactive thyroid, or medicines such as some antipsychotics, antidepressants, metoclopramide and domperidone. Less often a small, usually benign pituitary growth (prolactinoma).",
    low: "Rarely significant.",
    uk: `Typical NHS lab range is about 86–324 mU/L for men and 102–496 mU/L for women; ${LAB_RANGE_NOTE}.`,
    tip: "Stress, the needle, exercise and sleep can raise it, so a mildly high result is usually repeated, sometimes after resting first; tell your doctor about any medicines.",
  },
  cortisol_am: {
    what: "The body's main stress hormone, which peaks in the early morning. A morning level is checked when the adrenal glands may not be making enough.",
    high: "Commonly due to stress, illness, poor sleep, pregnancy or oestrogen (the pill or HRT). A single morning level cannot diagnose too much cortisol; other tests are used for that.",
    low: "Commonly due to steroid medicines (tablets, and sometimes high-dose inhalers or creams), which switch off your own production. Rarely the adrenal glands are not working (Addison's disease); borderline results are usually followed by a stimulation (Synacthen) test.",
    uk: "No preset range: the meaning depends on the time of day and the test method, so labs give their own cut-offs for a morning sample.",
    tip: "Have blood taken at about 8–9am and tell the lab about any steroid tablets, inhalers, creams or injections, the contraceptive pill or HRT.",
  },
  psa: {
    what: "Prostate specific antigen, a protein made by the prostate gland. It can be raised by many prostate conditions, not just cancer.",
    high: "Commonly due to an enlarged prostate, a prostate or urine infection, recent ejaculation or vigorous exercise such as cycling. Prostate cancer is one possible cause, but about 3 in 4 men with a raised PSA do not have cancer (NHS).",
    uk: "NICE (NG12) uses age-specific thresholds for referral: above 2.5 µg/L at 40–49, above 3.5 at 50–59, above 4.5 at 60–69 and above 6.5 at 70–79. The Prostate Cancer Risk Management Programme uses 3.0 for men aged 50–69, which this preset follows.",
    tip: "Avoid ejaculation and vigorous exercise for 48 hours before the test, and wait several weeks after a urine infection; finasteride and dutasteride roughly halve PSA, so tell your doctor if you take them.",
  },

  /* ---------------------------- Clinic measurements --------------------------- */
  bp_sys: {
    what: "The top number in a blood pressure reading: the pressure in your arteries when your heart beats. High blood pressure raises the risk of heart attack, stroke and kidney disease.",
    high: "Commonly linked to age, weight, salt, alcohol, inactivity and family history. One high reading is not a diagnosis; 180 or above needs prompt medical advice, and urgent help if you have chest pain, a severe headache, confusion or vision changes.",
    low: "Usually only a concern if you feel dizzy or faint, especially on standing; it can be due to dehydration or blood pressure medicines.",
    uk: "In a clinic, 140/90 or above is high; ideal is between 90/60 and 120/80, and readings between 120/80 and 140/90 suggest you could be at risk (NHS).",
    tip: "Sit quietly for 5 minutes with your arm supported at heart level, and avoid caffeine, smoking and exercise for 30 minutes before; clinic readings are often higher than at home.",
  },
  bp_dia: {
    what: "The bottom number in a blood pressure reading: the pressure in your arteries when your heart rests between beats.",
    high: "Commonly linked to weight, salt, alcohol, inactivity and family history; it is often raised in younger adults before the top number. A single high reading is not a diagnosis.",
    low: "Usually only a concern if you feel dizzy or faint; it can be due to dehydration or blood pressure medicines.",
    uk: "In a clinic, 90 or above is high and ideal is 60–80 (NHS).",
    tip: "Sit quietly for 5 minutes with your arm supported at heart level, and avoid caffeine, smoking and exercise for 30 minutes before.",
  },
  bp_sys_home: {
    what: "The average top number from a week of home readings. Home averages are often more reliable than a single clinic reading and are used to confirm high blood pressure.",
    high: "An average of 135 or above confirms high blood pressure. Lifestyle changes and, depending on your overall risk, medicine are usually discussed.",
    uk: "A home average of 135/85 or above is high (NICE, NHS).",
    tip: "NICE suggests two readings a minute apart, morning and evening, for at least 4 days (ideally 7); ignore the first day and average the rest.",
  },
  bp_dia_home: {
    what: "The average bottom number from a week of home readings, used with the top number to confirm or monitor high blood pressure.",
    high: "An average of 85 or above confirms high blood pressure, even if the top number is fine.",
    uk: "A home average of 135/85 or above is high (NICE, NHS).",
    tip: "NICE suggests two readings a minute apart, morning and evening, for at least 4 days (ideally 7); ignore the first day and average the rest.",
  },
  spo2: {
    what: "How much of the haemoglobin in your blood is carrying oxygen, measured with a clip on your finger.",
    low: "Can be due to a chest infection, asthma, COPD or other lung or heart conditions, or a poor reading. A level of 92% or below, or feeling very breathless, needs urgent medical help.",
    uk: "95% or above is normal for most people (NHS). If you have a long-term lung condition, your team may give you a lower personal target.",
    tip: "Cold hands, nail varnish and moving can give false readings, and finger oximeters can overestimate oxygen levels in people with darker skin.",
  },
  temp: {
    what: "Your body temperature. It is checked when you feel unwell, mainly to look for a fever.",
    high: "A fever is usually a sign the body is fighting an infection. A high temperature with a stiff neck, a rash that does not fade under a glass, confusion or difficulty breathing needs urgent help.",
    low: "Below 35°C is hypothermia and needs urgent help, especially in older people and babies.",
    uk: "Normal is about 36–37°C, and 38°C or above is a fever (NHS), which is what Sentience flags.",
    tip: "Readings vary by site (armpit is lower than mouth or ear) and are slightly lower in the morning; wait 30 minutes after hot or cold drinks or exercise.",
  },
  pulse: {
    what: "Your heart rate at rest, in beats per minute. A lower resting rate often goes with better fitness.",
    high: "Commonly due to caffeine, stress, fever, dehydration, recent activity or some medicines; less often an overactive thyroid, anaemia or a heart rhythm problem.",
    low: "Common and healthy in fit people. It can also be due to beta-blockers or other medicines; a slow pulse with dizziness, fainting or breathlessness needs medical advice.",
    uk: "60–100 bpm is normal for adults at rest (NHS).",
    tip: "Measure after sitting still for 5 minutes, ideally at the same time each day; an irregular pulse is worth mentioning to a GP.",
  },

  /* ---------------------------- Body measurements ----------------------------- */
  height: {
    what: "Needed to work out BMI and waist-to-height ratio. Measure without shoes, heels against a wall, looking straight ahead; a noticeable loss of height in later life is worth mentioning to a GP as it can be a sign of spinal fractures from osteoporosis.",
    uk: TAPE_UK,
    tip: "You are slightly taller in the morning than the evening, so measure at the same time of day.",
  },
  weight: {
    what: "Tracking weight shows long-term trends in body size. Weigh at the same time each day, ideally after waking and using the toilet, before eating, on the same scales on a hard floor; losing weight without trying is worth mentioning to a GP.",
    uk: "No reference range on its own; it is judged through BMI and waist-to-height ratio. Track the trend.",
    tip: "Day-to-day changes of 1–2 kg are usually water, salt and food, so compare weekly averages.",
  },
  bmi: {
    what: "Body mass index: weight in kg divided by height in metres squared. It is a quick screen for whether weight is in a healthy range for your height.",
    high: "Being overweight raises the risk of type 2 diabetes, heart disease, high blood pressure and joint problems.",
    low: "Being underweight can be linked to poor nutrition, an overactive thyroid or other illness, and raises the risk of weak bones.",
    uk: "Below 18.5 is underweight, 18.5–24.9 healthy, 25–29.9 overweight, 30–39.9 obese and 40 or above severely obese (NHS). For people of South Asian, Chinese, other Asian, Middle Eastern, Black African or African-Caribbean background, NICE uses lower thresholds: 23 for overweight and 27.5 for obesity.",
    tip: "BMI does not tell muscle from fat, so muscular people can read high; waist-to-height ratio adds useful context.",
  },
  body_fat: {
    what: "The share of your body weight that is fat. Tracking it helps show whether changes in weight are fat or muscle.",
    uk: "There is no NHS range. Commonly cited healthy ranges (Gallagher et al., 2000) are roughly 8–20% for men and 21–33% for women under 40, a few points higher with age; home devices differ by several percent, so treat them as a guide.",
    tip: "Bioimpedance scales are thrown by hydration, food and exercise, so measure under the same conditions, ideally first thing in the morning.",
  },
  waist: {
    what: "Waist size reflects fat around the organs, which is linked to type 2 diabetes and heart disease even at a healthy BMI. Measure halfway between the bottom of your ribs and the top of your hip bone, breathing out naturally, tape level and snug.",
    high: "A larger waist commonly means more fat around the organs, which raises the risk of type 2 diabetes, high blood pressure and heart disease.",
    uk: "A waist less than half your height (waist-to-height ratio under 0.5) is healthy (NICE, NHS). Risk is raised from 94 cm for men and 80 cm for women, and high from 102 cm for men and 88 cm for women.",
    tip: "Measure on bare skin at the same time of day, ideally in the morning before eating.",
  },

  /* ------------------------------ Tape-measure sites -------------------------- */
  neck: {
    what: "Tracking neck size helps follow changes in body shape; a larger neck is also one of the things checked when screening for sleep apnoea. Measure just below the Adam's apple, tape level and snug, looking straight ahead.",
    uk: TAPE_UK,
  },
  shoulders: {
    what: "Shoulder width shows changes in upper-body size from training or weight change. Measure around the widest point of the shoulders, standing relaxed with arms by your sides.",
    uk: TAPE_UK,
    tip: "Having someone else hold the tape makes it much more consistent.",
  },
  chest: {
    what: "Chest size tracks upper-body changes from training or weight change. Measure around the fullest part, under the armpits, after a normal breath out with arms relaxed.",
    uk: TAPE_UK,
  },
  hips: {
    what: "Hip size tracks lower-body changes and, with your waist, gives the waist-to-hip ratio. Measure around the widest part of the buttocks, standing with feet together.",
    uk: TAPE_UK,
  },
  bicep_l: {
    what: "Upper-arm size tracks muscle gain or loss. Measure midway between shoulder and elbow, and choose either relaxed or flexed and stick with it.",
    uk: TAPE_UK,
    tip: "A small difference between arms is normal, usually larger on your dominant side.",
  },
  bicep_r: {
    what: "Upper-arm size tracks muscle gain or loss. Measure midway between shoulder and elbow, and choose either relaxed or flexed and stick with it.",
    uk: TAPE_UK,
    tip: "A small difference between arms is normal, usually larger on your dominant side.",
  },
  forearm: {
    what: "Forearm size tracks muscle gain or loss. Measure around the widest part with the arm straight and hand relaxed, using the same arm each time.",
    uk: TAPE_UK,
  },
  thigh_l: {
    what: "Thigh size tracks lower-body muscle and fat changes. Measure at the fullest part just below the buttock crease, or a fixed distance above the kneecap, standing with weight on both legs.",
    uk: TAPE_UK,
    tip: "Use the same point each time; noting the distance above the kneecap helps.",
  },
  thigh_r: {
    what: "Thigh size tracks lower-body muscle and fat changes. Measure at the fullest part just below the buttock crease, or a fixed distance above the kneecap, standing with weight on both legs.",
    uk: TAPE_UK,
    tip: "Use the same point each time; noting the distance above the kneecap helps.",
  },
  calf_l: {
    what: "Calf size tracks lower-leg muscle and can show swelling. Measure around the widest part, standing with weight on both feet; sudden swelling of one calf with pain, warmth or redness needs urgent medical advice.",
    uk: TAPE_UK,
    tip: "Legs swell a little through the day, so measure at the same time, ideally in the morning.",
  },
  calf_r: {
    what: "Calf size tracks lower-leg muscle and can show swelling. Measure around the widest part, standing with weight on both feet; sudden swelling of one calf with pain, warmth or redness needs urgent medical advice.",
    uk: TAPE_UK,
    tip: "Legs swell a little through the day, so measure at the same time, ideally in the morning.",
  },

  /* ------------------------------- Lung function ------------------------------ */
  fev1: {
    what: "Forced expiratory volume in 1 second: how much air you can blow out in the first second of a hard breath out. It is a key spirometry measure for asthma and COPD.",
    low: "Can be due to narrowed airways, as in asthma or COPD, or to smaller or stiffer lungs. It is judged against the value predicted for you.",
    uk: "No single range; it is judged as a percentage of the value predicted for your age, height and sex (see FEV1 % predicted). An improvement of 12% or more and at least 200 mL after a reliever inhaler suggests reversible narrowing, as in asthma (BTS/NICE).",
    tip: "Results depend on effort and technique, so the best of at least three good blows is used; you may be asked not to use your reliever for a few hours beforehand.",
  },
  fvc: {
    what: "Forced vital capacity: the total amount of air you can blow out after a full breath in. Together with FEV1 it shows the pattern of any breathing problem.",
    low: "Can be due to stiff or smaller lungs, chest wall or weight restricting breathing, or air trapped by narrowed airways. Full lung function tests can tell these apart.",
    uk: "No single range; it is judged as a percentage of the value predicted for your age, height and sex (see FVC % predicted).",
    tip: "Blowing out for long enough matters; stopping early makes it read low.",
  },
  peak_flow: {
    what: "The fastest speed you can blow air out, measured with a simple meter. It is used to diagnose and monitor asthma by comparing readings over time.",
    low: "Compared with your personal best, a drop can mean asthma is worsening. Below 50% of your best is a sign of a severe attack and needs urgent help (BTS).",
    uk: "No single range; it is compared with your personal best or a predicted value for your age, height and sex. A day-to-day variation of more than 20% supports a diagnosis of asthma (BTS/NICE).",
    tip: "Take the best of three blows, standing, using the same meter, ideally morning and evening.",
  },
  fev1_fvc: {
    what: "FEV1 divided by FVC: the share of your total breath that comes out in the first second. It is the main test for narrowed airways.",
    high: "Usually normal; a high ratio with a low FVC can suggest stiff or restricted lungs.",
    low: "Below 0.7 suggests the airways are narrowed (obstruction), as in asthma or COPD.",
    uk: "Below 0.7 (70%) suggests obstruction (BTS/NICE). Some services use the lower limit of normal for your age instead, as the ratio falls naturally with age.",
    tip: "Some reports show it as a percentage: 0.7 is 70%.",
  },
  fev1_pct: {
    what: "Your FEV1 as a percentage of the value predicted for someone of your age, height and sex. It shows how much airflow is reduced.",
    low: "Below 80% suggests reduced airflow. When airways are narrowed it is used to grade severity.",
    uk: "80% or above is normal. With confirmed obstruction, NICE grades severity as mild at 80% or above, moderate at 50–79%, severe at 30–49% and very severe below 30%.",
    tip: "Different prediction equations give slightly different percentages, so compare results from the same service where possible.",
  },
  fvc_pct: {
    what: "Your FVC as a percentage of the value predicted for someone of your age, height and sex.",
    low: "Below 80% can suggest restricted lungs or air trapping; further lung function tests can tell which.",
    uk: "80% or above is normal.",
    tip: "Different prediction equations give slightly different percentages, so compare results from the same service where possible.",
  },
  lung_age: {
    what: "The age of an average healthy non-smoker whose FEV1 matches yours. It is a simple way to show how your lungs compare with your real age.",
    high: "A lung age well above your real age suggests reduced lung function, commonly from smoking.",
    uk: "No reference range; compare it with your actual age.",
    tip: "Stopping smoking slows the decline in lung function at any age.",
  },
  act_score: {
    what: "The Asthma Control Test: five questions about your asthma over the past 4 weeks, scored 5 to 25. Higher scores mean better control.",
    low: "A score below 20 suggests asthma is not well controlled and is worth a review of your treatment and inhaler technique.",
    uk: "20–25 is well controlled, 16–19 not well controlled and 15 or below poorly controlled (standard ACT scoring, as used in BTS/NICE asthma care).",
    tip: "Answer about the past 4 weeks, not just today, and take the score to your asthma review.",
  },
};
