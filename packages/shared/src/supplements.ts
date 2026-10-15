/**
 * What common supplements do, how strong the evidence is, and what to expect
 * over time if taken consistently. UK guidance (NHS, SACN, NICE, MHRA) where it
 * exists. General information, not advice for a specific person.
 *
 * Evidence grades are deliberately strict. For supplements whose main use is
 * correcting a shortfall (vitamin D, B12, iron, folic acid before pregnancy) the
 * overall grade describes that use; the summary says plainly when there is no
 * benefit for people who are not low.
 */
export type SupplementEvidence = "strong" | "moderate" | "weak";

export interface SupplementStep {
  /** e.g. "Days 1–7", "Weeks 2–4", "Month 3+" */
  when: string;
  /** What is happening in the body / what you might notice at that point. One or two sentences, honest about what you will NOT notice. */
  what: string;
}

export interface Supplement {
  /** snake_case, stable */
  key: string;
  /** Display name, e.g. "Vitamin D3" */
  name: string;
  /** Lowercase strings people might type: "vit d", "d3", "cholecalciferol". Brand-agnostic. */
  aliases: string[];
  category: "vitamin" | "mineral" | "fatty acid" | "amino acid" | "herbal" | "other";
  /** Overall evidence for its main claimed benefit, graded strictly. */
  evidence: SupplementEvidence;
  /** What it's for, 1–2 sentences. */
  summary: string;
  /** 2–5 items, each graded separately. */
  benefits: { text: string; evidence: SupplementEvidence }[];
  /** NHS/SACN advice, recommended intake, safe upper limit. */
  ukGuidance?: string;
  typicalDose: string;
  /** Timing, with/without food, what not to take it with. */
  howToTake: string;
  /** 3–5 steps describing what to expect with consistent daily use, realistically. */
  timeline: SupplementStep[];
  /** Interactions with medicines, who should avoid, overdose risks. */
  cautions: string[];
  /** Keys from LAB_TESTS worth checking. */
  relatedLabs?: string[];
}

export const SUPPLEMENTS: Supplement[] = [
  /* ---------------------------------------------------------------- */
  /* Vitamins                                                          */
  /* ---------------------------------------------------------------- */
  {
    key: "vitamin_d3",
    name: "Vitamin D3",
    aliases: [
      "vitamin d", "vitamin d3", "vit d", "vit d3", "d3", "cholecalciferol",
      "vitamin d2", "ergocalciferol", "sunshine vitamin",
    ],
    category: "vitamin",
    evidence: "strong",
    summary:
      "Keeps bones and muscles healthy by helping the body absorb calcium and phosphate. In the UK there is too little sunlight from October to March to make enough, so a small daily dose is recommended for everyone in those months.",
    benefits: [
      { text: "Prevents and corrects vitamin D deficiency, protecting against rickets and osteomalacia (soft, painful bones)", evidence: "strong" },
      { text: "With calcium, modestly reduces fractures and falls in older people who are low or housebound", evidence: "moderate" },
      { text: "Fewer fractures or falls in people whose levels are already adequate", evidence: "weak" },
      { text: "Fewer colds and chest infections", evidence: "weak" },
      { text: "Better mood, energy or prevention of depression in people who are not deficient", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: everyone aged 1 and over should consider 10 µg (400 IU) a day from October to March. People who get little sun (housebound, in care homes, who cover their skin outdoors) or have dark skin (African, African-Caribbean or South Asian background) should take it all year. Do not take more than 100 µg (4,000 IU) a day as an adult; 50 µg for children aged 1–10, 25 µg for babies. NICE treats a blood level below 25 nmol/L as deficient; your GP may prescribe a higher short treatment course.",
    typicalDose: "10 µg (400 IU) daily as a maintenance dose; 25–50 µg (1,000–2,000 IU) is common for people who are low. Higher treatment courses only on medical advice.",
    howToTake:
      "With a meal that contains some fat, as it is fat-soluble. Time of day does not matter; consistency does. D3 (cholecalciferol) raises blood levels a little more reliably than D2. Some capsules use arachis (peanut) oil, so check the label if you have a peanut allergy.",
    timeline: [
      { when: "Days 1–7", what: "Absorbed and stored in fat and liver. Blood level begins to rise slowly; you will not feel anything." },
      { when: "Weeks 2–6", what: "Blood 25-OH vitamin D climbs steadily. If you were deficient with bone pain or muscle weakness, these can start to ease, but most people notice no change." },
      { when: "Weeks 8–12", what: "Blood level reaches a plateau for the dose you are taking. This is the earliest sensible point to retest; testing sooner underestimates the effect." },
      { when: "Month 3+", what: "Level holds steady while you keep taking it. Do not expect more energy or better mood if you were not low to begin with." },
    ],
    cautions: [
      "Taking well above 100 µg (4,000 IU) a day for long periods can raise blood calcium (hypercalcaemia), causing thirst, nausea, confusion and kidney damage.",
      "Get medical advice before taking it if you have sarcoidosis or other granulomatous disease, hyperparathyroidism, kidney stones or kidney disease.",
      "With thiazide diuretics or digoxin, high doses raise the risk of high calcium; check with a pharmacist.",
      "Count all sources: multivitamins, fish liver oils and calcium-plus-D products also contain vitamin D.",
    ],
    relatedLabs: ["vitd", "calcium_adj", "phosphate", "alp"],
  },
  {
    key: "vitamin_k2",
    name: "Vitamin K2",
    aliases: ["vitamin k2", "vit k2", "k2", "menaquinone", "mk7", "mk 7", "mk4", "vitamin k", "vit k"],
    category: "vitamin",
    evidence: "weak",
    summary:
      "Needed for blood clotting and for proteins involved in bone and blood vessel calcium handling. Often sold with vitamin D, but deficiency is rare in healthy adults and there is no good evidence that extra K2 improves bones or arteries.",
    benefits: [
      { text: "Better bone density or fewer fractures", evidence: "weak" },
      { text: "Less calcium build-up in arteries", evidence: "weak" },
      { text: "Needed alongside vitamin D for vitamin D to work safely", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: adults need about 1 µg of vitamin K a day per kilogram of body weight, which a normal diet provides (green leafy vegetables, vegetable oils, some fermented foods). Taking 1 mg (1,000 µg) or less a day of vitamin K supplements is unlikely to cause harm. There is no separate UK recommendation for K2.",
    typicalDose: "45–200 µg MK-7 daily in supplements.",
    howToTake: "With a meal containing fat. Often combined with vitamin D in one product.",
    timeline: [
      { when: "Weeks 1–2", what: "MK-7 has a long half-life and reaches a steady blood level in about two weeks. Nothing to notice." },
      { when: "Months 1–3", what: "Markers of K2 activity in blood change, but these are research measures and you will not feel any different." },
      { when: "Year 1+", what: "Trials lasting 1–3 years show small or no change in bone density or artery calcification in most people." },
    ],
    cautions: [
      "Do not take it, or stop it, if you take warfarin (or acenocoumarol or phenindione) without talking to your anticoagulation clinic: it directly counteracts these medicines and changes your INR.",
      "It does not interfere with the newer anticoagulants (apixaban, rivaroxaban, edoxaban, dabigatran).",
    ],
  },
  {
    key: "vitamin_b12",
    name: "Vitamin B12",
    aliases: [
      "vitamin b12", "vit b12", "b12", "cobalamin", "cyanocobalamin", "methylcobalamin",
      "hydroxocobalamin", "adenosylcobalamin",
    ],
    category: "vitamin",
    evidence: "strong",
    summary:
      "Needed to make red blood cells and keep nerves healthy. Essential for vegans, and useful for people with low levels; it does not give extra energy to people who already have enough.",
    benefits: [
      { text: "Prevents deficiency on a vegan diet (B12 is found almost only in animal foods and fortified products)", evidence: "strong" },
      { text: "Corrects B12 deficiency anaemia and halts nerve damage when the cause is diet", evidence: "strong" },
      { text: "More energy, better memory or mood in people with normal levels", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: adults need about 1.5 µg a day. Taking 2 mg (2,000 µg) or less a day of supplements is unlikely to cause harm. NICE (2024) advises oral B12 for deficiency caused by diet; deficiency caused by poor absorption (such as autoimmune gastritis or pernicious anaemia) is usually treated with injections.",
    typicalDose:
      "Vegans: 10–50 µg daily or about 2,000 µg once a week. For diet-related deficiency doctors commonly use 50–150 µg daily, sometimes up to 1–2 mg.",
    howToTake:
      "Any time of day, with or without food. Cyanocobalamin is stable and well studied; methylcobalamin is not proven to be better. Ideally have a blood test before starting, because supplements quickly raise blood levels and can hide a deficiency that needs investigating.",
    timeline: [
      { when: "Days 1–7", what: "Blood B12 rises within days, so a test taken now no longer shows your starting point. If you were not deficient you will notice nothing." },
      { when: "Weeks 1–4", what: "If you had B12 anaemia, new red cells start forming within about a week and tiredness and breathlessness may begin to ease." },
      { when: "Weeks 6–8", what: "Haemoglobin and red cell size (MCV) usually return to normal in people who were anaemic." },
      { when: "Months 3–12", what: "Nerve symptoms such as tingling, numbness or poor memory improve slowly, often over many months, and may not resolve completely." },
    ],
    cautions: [
      "Do not use it to self-treat suspected deficiency without testing: numbness, tingling, a sore tongue or unexplained tiredness should be checked by a GP, as the cause matters.",
      "Metformin and long-term acid-reducing medicines (omeprazole, lansoprazole and similar) can lower B12 over time; ask about checking levels.",
      "A high blood B12 when you are not taking supplements can be a sign of other illness; tell your doctor if you are taking it so results are read correctly.",
    ],
    relatedLabs: ["b12", "hb", "mcv", "folate"],
  },
  {
    key: "folic_acid",
    name: "Folic acid",
    aliases: [
      "folic acid", "folate", "vitamin b9", "b9", "methylfolate", "5 mthf", "l methylfolate",
      "pregnancy vitamin", "prenatal vitamin", "prenatal", "conception vitamin",
    ],
    category: "vitamin",
    evidence: "strong",
    summary:
      "Taken before conception and in early pregnancy, it greatly reduces the risk of neural tube defects such as spina bifida. Outside pregnancy planning it only helps people with low folate.",
    benefits: [
      { text: "Reduces the risk of neural tube defects when taken before conception and up to 12 weeks of pregnancy", evidence: "strong" },
      { text: "Corrects folate deficiency anaemia", evidence: "strong" },
      { text: "Heart, brain or energy benefits in people with normal folate", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: 400 µg a day if you could get pregnant, ideally from before conception until 12 weeks of pregnancy. A higher 5 mg dose is prescribed for those at higher risk (for example diabetes, BMI 30 or over, a previous pregnancy affected by a neural tube defect, some epilepsy medicines, sickle cell disease). Adults otherwise need about 200 µg of folate a day from food. Taking 1 mg or less a day of folic acid is unlikely to cause harm. Folic acid is being added to non-wholemeal wheat flour in the UK from the end of 2026; this does not replace the pregnancy supplement.",
    typicalDose: "400 µg daily when planning pregnancy; 5 mg daily only on prescription.",
    howToTake:
      "Once a day at any time, with or without food. A pregnancy multivitamin containing 400 µg folic acid and 10 µg vitamin D is fine instead, as long as it does not contain vitamin A (retinol).",
    timeline: [
      { when: "Days 1–7", what: "Blood folate rises within days. Nothing to feel." },
      { when: "Weeks 4–12", what: "Folate builds up in red blood cells, which is what protects the developing baby. This is why starting before you stop contraception is advised." },
      { when: "Pregnancy weeks 0–12", what: "The neural tube closes about four weeks after conception, often before a pregnancy is known. Keep taking it daily until week 12; continuing after that is harmless." },
      { when: "Not planning pregnancy", what: "If your folate is normal you will notice no difference." },
    ],
    cautions: [
      "High doses can mask B12 deficiency by correcting the anaemia while nerve damage continues; check B12 if you are being treated for anaemia.",
      "Methotrexate users are often prescribed folic acid on specific days; do not change this without your prescriber.",
      "Some epilepsy medicines (for example phenytoin, carbamazepine, valproate) interact with folate; anyone taking them who could become pregnant should get advice about the 5 mg dose.",
    ],
    relatedLabs: ["folate", "b12", "mcv"],
  },
  {
    key: "b_complex",
    name: "Vitamin B complex",
    aliases: [
      "b complex", "vitamin b complex", "vit b complex", "b vitamins", "vitamin b", "vit b",
      "b50", "b100", "vitamin b6", "b6", "pyridoxine", "biotin", "vitamin b7", "thiamine",
      "thiamin", "vitamin b1", "b1", "riboflavin", "vitamin b2", "niacin", "vitamin b3",
      "nicotinamide",
    ],
    category: "vitamin",
    evidence: "weak",
    summary:
      "A mix of the eight B vitamins involved in turning food into energy. Unless you have a deficiency or a restricted diet, extra B vitamins do not give you more energy; the body excretes what it does not need.",
    benefits: [
      { text: "Covers shortfalls in people with poor diets, heavy alcohol use or some gut conditions", evidence: "moderate" },
      { text: "More energy or less stress in people who are not deficient", evidence: "weak" },
      { text: "Riboflavin (B2) at high dose to reduce migraine frequency", evidence: "weak" },
    ],
    ukGuidance:
      "NHS upper amounts from supplements: vitamin B6 10 mg or less a day unless a doctor advises more; biotin 0.9 mg or less; nicotinic acid 17 mg or less (nicotinamide 500 mg or less); riboflavin 40 mg or less; thiamin 100 mg or less. Many \"B50\" and \"B100\" products exceed the B6 limit.",
    typicalDose: "One tablet providing roughly 100% of the reference intakes; check the B6 content.",
    howToTake: "With breakfast or lunch. Some people find it mildly stimulating, so avoid taking it late in the evening if it bothers you.",
    timeline: [
      { when: "Hours", what: "Urine turns bright yellow from riboflavin. This is harmless and does not mean it is working." },
      { when: "Weeks 1–4", what: "If you were not deficient, you will not notice any change in energy or mood." },
      { when: "Months 3+", what: "Long-term use of more than about 10 mg a day of B6 can cause nerve damage (tingling, numbness in hands and feet). Stop and see a GP if this happens." },
    ],
    cautions: [
      "Vitamin B6 neuropathy can occur with long-term high doses; check the label and count B6 in all products you take.",
      "Biotin (common in B complex and hair, skin and nail products) can distort some blood tests, notably thyroid tests and troponin. Tell whoever takes your blood, and consider stopping it 2–3 days before a test.",
      "Nicotinic acid (niacin) can cause flushing and, at high doses, liver problems.",
      "B6 can reduce the effect of levodopa when levodopa is taken without carbidopa or benserazide.",
    ],
    relatedLabs: ["b12", "folate"],
  },
  {
    key: "vitamin_c",
    name: "Vitamin C",
    aliases: ["vitamin c", "vit c", "ascorbic acid", "ascorbate", "sodium ascorbate"],
    category: "vitamin",
    evidence: "weak",
    summary:
      "An antioxidant needed for skin, blood vessels and wound healing. Most people get enough from fruit and vegetables; regular supplements do not prevent colds for most people.",
    benefits: [
      { text: "Prevents scurvy in people with very poor diets", evidence: "strong" },
      { text: "Taken daily, slightly shortens colds (around 8% in adults); taking it once a cold starts does not help", evidence: "moderate" },
      { text: "Fewer colds, except in people under heavy physical stress such as marathon runners", evidence: "weak" },
      { text: "Helps absorb iron from plant foods when taken with the meal", evidence: "moderate" },
    ],
    ukGuidance:
      "NHS: adults need 40 mg a day, easily met by food. Taking less than 1,000 mg a day of supplements is unlikely to cause harm; more can cause stomach pain, diarrhoea and wind.",
    typicalDose: "40–200 mg daily is plenty; blood levels saturate at around 200 mg a day.",
    howToTake: "With food to reduce stomach upset. Large single doses are poorly absorbed, so more is not better.",
    timeline: [
      { when: "Days 1–14", what: "Blood and tissue levels top up and then plateau; the excess is passed in urine. Nothing to feel." },
      { when: "Weeks 2–12", what: "No change in energy, skin or immunity is expected if your diet already includes fruit and vegetables." },
      { when: "Over a winter", what: "If you take it every day, any colds you catch may be very slightly shorter. You will not notice fewer colds." },
    ],
    cautions: [
      "High doses (over 1 g a day) can cause diarrhoea and, in some men, raise the risk of kidney stones.",
      "Avoid high doses if you have haemochromatosis or other iron overload, because it increases iron absorption.",
      "High doses can interfere with some blood glucose meters and urine tests.",
    ],
  },
  {
    key: "multivitamin",
    name: "Multivitamin",
    aliases: [
      "multivitamin", "multivit", "multi vitamin", "multi", "multivitamin and mineral",
      "a to z", "a z multivitamin", "daily vitamin",
    ],
    category: "vitamin",
    evidence: "weak",
    summary:
      "A broad mix of vitamins and minerals at around reference intake levels. A reasonable safety net for restricted diets, but in well-fed adults large trials show little or no effect on heart disease, cancer or lifespan.",
    benefits: [
      { text: "Covers gaps in restricted diets (for example vegan, very low calorie, older people with small appetites)", evidence: "moderate" },
      { text: "Prevents heart disease, cancer or early death in well-nourished adults", evidence: "weak" },
      { text: "Slows age-related memory decline", evidence: "weak" },
    ],
    ukGuidance:
      "The NHS says most people should be able to get the vitamins and minerals they need from a balanced diet, apart from vitamin D in autumn and winter. Avoid taking several products together, which can push some nutrients over safe upper limits.",
    typicalDose: "One tablet a day providing roughly 100% of the reference intakes (NRV).",
    howToTake:
      "With a meal, as fat-soluble vitamins absorb better with food. If pregnant or trying, use a pregnancy formulation that contains folic acid and no vitamin A (retinol).",
    timeline: [
      { when: "Hours", what: "Bright yellow urine from riboflavin; harmless." },
      { when: "Weeks 1–8", what: "Levels of any nutrient you were short of start rising. If you were not short of anything, nothing changes that you can feel." },
      { when: "Months 3+", what: "Blood tests may show improvement in a specific shortfall such as vitamin D. General energy or health benefits are not expected." },
    ],
    cautions: [
      "Iron-containing multivitamins can be fatal to young children in overdose; store them out of reach.",
      "Products with iron, calcium, magnesium or zinc reduce absorption of levothyroxine and some antibiotics (tetracyclines, quinolones); separate by at least 4 hours.",
      "Pregnant women should avoid products containing vitamin A (retinol).",
      "Smokers should avoid products with high-dose beta-carotene.",
    ],
    relatedLabs: ["vitd", "b12", "folate", "ferritin"],
  },
  {
    key: "vitamin_a",
    name: "Vitamin A",
    aliases: ["vitamin a", "vit a", "retinol", "retinyl palmitate", "retinyl acetate", "beta carotene", "betacarotene"],
    category: "vitamin",
    evidence: "weak",
    summary:
      "Needed for vision in dim light, skin and the immune system. Deficiency is rare in the UK, so supplements rarely help adults, and too much is harmful, especially in pregnancy.",
    benefits: [
      { text: "Corrects deficiency (rare in the UK; mainly in severe malabsorption)", evidence: "strong" },
      { text: "Better skin, eyesight or immunity in people who are not deficient", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: men need 700 µg a day and women 600 µg. Keep total intake from food and supplements to 1.5 mg (1,500 µg) a day or less, and if you eat liver or pâté, have it no more than once a week. Pregnant women, or those trying, should not take supplements containing vitamin A (retinol) or eat liver, liver products or fish liver oils. Children aged 6 months to 5 years are advised to take drops with vitamins A, C and D. Taking 7 mg or less a day of beta-carotene is unlikely to harm, but smokers should avoid it.",
    typicalDose: "Rarely needed as a separate supplement. Multivitamins usually contain 400–800 µg.",
    howToTake: "With a meal containing fat. Check whether a product lists retinol (preformed vitamin A) or beta-carotene; the pregnancy and liver cautions apply to retinol.",
    timeline: [
      { when: "Weeks 1–4", what: "Stored in the liver, which can hold months of supply. Nothing to notice." },
      { when: "Months", what: "With regular high doses, excess builds up quietly. Early toxicity signs are headache, dry skin, hair loss and joint pain." },
      { when: "Years", what: "Long-term intakes above 1.5 mg a day are linked to weaker bones and more hip fractures in older people." },
    ],
    cautions: [
      "Pregnancy: high intakes of retinol can harm the unborn baby. Avoid retinol supplements, fish liver oils, liver and pâté.",
      "Do not take vitamin A supplements with retinoid medicines such as isotretinoin or acitretin.",
      "High doses can damage the liver and raise blood calcium.",
      "Beta-carotene supplements increased lung cancer in smokers and people exposed to asbestos in large trials.",
    ],
    relatedLabs: ["alt", "calcium_adj"],
  },
  {
    key: "vitamin_e",
    name: "Vitamin E",
    aliases: ["vitamin e", "vit e", "tocopherol", "alpha tocopherol", "d alpha tocopherol", "tocotrienol"],
    category: "vitamin",
    evidence: "weak",
    summary:
      "An antioxidant found in plant oils, nuts and seeds. Deficiency is very rare, and large trials of supplements have found no protection against heart disease or cancer, with some signs of harm at high doses.",
    benefits: [
      { text: "Corrects deficiency in rare fat-malabsorption conditions", evidence: "strong" },
      { text: "Prevents heart disease, cancer or dementia", evidence: "weak" },
      { text: "Better skin when taken by mouth", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: men need about 4 mg a day and women 3 mg, which diet provides. Taking 540 mg (800 IU) or less a day of supplements is unlikely to cause harm.",
    typicalDose: "Not usually needed. Multivitamins contain around 10–15 mg.",
    howToTake: "With a meal containing fat.",
    timeline: [
      { when: "Weeks 1–4", what: "Blood levels rise and level off. Nothing to notice." },
      { when: "Months 1–6", what: "No change in skin, energy or immunity is expected in people who eat a normal diet." },
      { when: "Years", what: "Long-term trials found no protection against heart disease or cancer, and some harms at 400 IU a day or more." },
    ],
    cautions: [
      "High doses may increase bleeding risk, particularly with warfarin, other anticoagulants or antiplatelet medicines.",
      "A large trial found 400 IU a day raised prostate cancer risk in men; meta-analyses suggest a small rise in haemorrhagic stroke with high doses.",
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Fatty acids                                                       */
  /* ---------------------------------------------------------------- */
  {
    key: "omega3_fish_oil",
    name: "Omega-3 fish oil",
    aliases: [
      "omega 3", "omega3", "omega-3", "fish oil", "omega 3 fish oil", "epa", "dha", "epa dha",
      "krill oil", "omega 3 6 9", "omega 369",
    ],
    category: "fatty acid",
    evidence: "weak",
    summary:
      "Supplies the long-chain omega-3 fats EPA and DHA found in oily fish. High doses lower triglycerides, but for most people there is little evidence that capsules prevent heart attacks or help the brain, mood or joints.",
    benefits: [
      { text: "Lowers raised triglycerides at 2–4 g of EPA and DHA a day", evidence: "strong" },
      { text: "Reduces heart attacks and strokes in the general population", evidence: "weak" },
      { text: "Better memory, mood or joint pain", evidence: "weak" },
      { text: "Provides EPA and DHA for people who never eat oily fish", evidence: "moderate" },
    ],
    ukGuidance:
      "SACN and NHS: eat at least two portions of fish a week, one of them oily, which provides roughly 450 mg of EPA and DHA a day. There is no UK recommendation to take fish oil supplements. NICE advises against offering omega-3 supplements to prevent heart disease; a prescription form (icosapent ethyl) is used for some people on statins with raised triglycerides.",
    typicalDose:
      "250–500 mg EPA plus DHA a day as a general top-up. Check the label: a \"1,000 mg fish oil\" capsule usually provides about 300 mg of EPA and DHA. Higher doses only with medical advice.",
    howToTake: "With a meal containing fat, which improves absorption and reduces fishy burps. Freezing capsules can help with aftertaste.",
    timeline: [
      { when: "Weeks 1–2", what: "Fishy aftertaste or burps are common at first. You will not feel any difference in heart, brain or joints." },
      { when: "Weeks 2–4", what: "At high doses, triglycerides start falling; this only shows on a blood test." },
      { when: "Months 3–4", what: "Omega-3 content of red blood cells (the omega-3 index) reaches a new steady level as old cells are replaced." },
      { when: "Month 4+", what: "No noticeable change in mood, focus or aches is expected for most people." },
    ],
    cautions: [
      "Doses of 1 g a day or more have been linked to a small increase in atrial fibrillation in people with heart disease.",
      "High doses may slightly add to bleeding risk with anticoagulants or antiplatelet medicines; tell your prescriber.",
      "Fish liver oils (such as cod liver oil) are different: they contain vitamin A and should be avoided in pregnancy.",
      "Avoid if you have a fish or shellfish allergy (krill oil is from shellfish).",
      "DHA-rich products can raise LDL cholesterol slightly in some people.",
    ],
    relatedLabs: ["triglycerides", "ldl"],
  },
  {
    key: "cod_liver_oil",
    name: "Cod liver oil",
    aliases: ["cod liver oil", "fish liver oil", "halibut liver oil"],
    category: "fatty acid",
    evidence: "weak",
    summary:
      "A fish liver oil that provides omega-3 fats plus vitamins A and D. Its vitamin A content makes it unsuitable in pregnancy and easy to overdo alongside other supplements.",
    benefits: [
      { text: "Supplies vitamin D in winter", evidence: "strong" },
      { text: "Provides EPA and DHA for people who never eat oily fish", evidence: "moderate" },
      { text: "Helps joints, skin or immunity", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: pregnant women should not take fish liver oil supplements. Keep total vitamin A from food and supplements to 1.5 mg a day or less, and vitamin D to 100 µg a day or less.",
    typicalDose: "As labelled; check the vitamin A and D per dose rather than the oil weight.",
    howToTake: "With a meal. Do not combine with a multivitamin or vitamin A product without adding up the vitamin A.",
    timeline: [
      { when: "Weeks 1–2", what: "Fishy aftertaste possible. Nothing else to notice." },
      { when: "Weeks 8–12", what: "Vitamin D blood level reaches a plateau for the dose." },
      { when: "Months 3–4", what: "Red cell omega-3 levels reach a steady state. No felt change in joints or skin is expected." },
    ],
    cautions: [
      "Avoid in pregnancy and when trying to conceive, because of vitamin A.",
      "Do not take with retinoid medicines (isotretinoin, acitretin).",
      "Long-term high vitamin A intake is linked to weaker bones in older people.",
      "High doses may add to bleeding risk with anticoagulants.",
    ],
    relatedLabs: ["vitd", "triglycerides"],
  },
  {
    key: "algae_omega3",
    name: "Algae omega-3",
    aliases: ["algae omega 3", "algae oil", "algal oil", "algal omega 3", "vegan omega 3", "vegan omega3", "plant omega 3", "algal dha", "algae dha"],
    category: "fatty acid",
    evidence: "weak",
    summary:
      "A plant-based source of DHA (and often some EPA) made from microalgae, which is where fish get it from. Mainly useful for vegans and people who do not eat fish; the same doubts about health benefits apply as for fish oil.",
    benefits: [
      { text: "Raises blood DHA and EPA in vegans and non-fish eaters, who cannot rely on converting ALA from flax or walnuts", evidence: "moderate" },
      { text: "Lowers triglycerides at high doses", evidence: "moderate" },
      { text: "Prevents heart disease or improves brain function", evidence: "weak" },
    ],
    ukGuidance:
      "There is no UK recommendation to supplement. SACN's advice to eat oily fish weekly is the reference point; algae oil is the usual alternative for people who do not.",
    typicalDose: "250–500 mg combined DHA and EPA a day.",
    howToTake: "With a meal containing fat.",
    timeline: [
      { when: "Weeks 1–2", what: "Usually no aftertaste. Nothing to feel." },
      { when: "Weeks 2–4", what: "Blood levels of DHA start rising; triglycerides may fall at higher doses." },
      { when: "Months 3–4", what: "Red cell omega-3 levels reach a steady state. You will not notice a change in mood or concentration." },
    ],
    cautions: [
      "High doses may slightly add to bleeding risk with anticoagulants or antiplatelet medicines.",
      "Some products contain added vitamins; check labels if you take other supplements.",
    ],
    relatedLabs: ["triglycerides"],
  },

  /* ---------------------------------------------------------------- */
  /* Minerals                                                          */
  /* ---------------------------------------------------------------- */
  {
    key: "magnesium",
    name: "Magnesium",
    aliases: [
      "magnesium", "mag", "magnesium glycinate", "magnesium bisglycinate", "magnesium citrate",
      "magnesium oxide", "magnesium threonate", "magnesium l threonate", "magnesium malate",
      "magnesium taurate", "epsom salt",
    ],
    category: "mineral",
    evidence: "weak",
    summary:
      "Involved in muscle, nerve and energy metabolism. Widely taken for sleep, cramps and stress, but good evidence only exists for correcting a low intake, migraine prevention and as a laxative.",
    benefits: [
      { text: "Corrects low magnesium (for example with long-term acid-reducing medicines, diuretics or heavy alcohol use)", evidence: "strong" },
      { text: "Reduces migraine frequency at around 400–600 mg a day", evidence: "moderate" },
      { text: "Relieves constipation (citrate and oxide forms)", evidence: "moderate" },
      { text: "Better sleep", evidence: "weak" },
      { text: "Prevents night-time leg cramps in older adults", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: men need 300 mg a day and women 270 mg, mostly from wholegrains, nuts, seeds and leafy greens. Taking 400 mg or less a day of supplements is unlikely to cause harm.",
    typicalDose:
      "100–300 mg of elemental magnesium a day. Labels often give the compound weight: 1,000 mg of magnesium glycinate provides only about 140 mg of magnesium.",
    howToTake:
      "Commonly taken in the evening, with food to reduce stomach upset. Glycinate is gentler on the gut; citrate is more likely to loosen stools. Keep at least 2–4 hours away from levothyroxine, tetracycline or quinolone antibiotics and bisphosphonates.",
    timeline: [
      { when: "Days 1–3", what: "Looser stools are the most common early effect, especially with citrate or oxide." },
      { when: "Weeks 1–2", what: "If it is going to help sleep or cramps, any effect usually shows by now. Many people notice nothing, particularly if their intake was already adequate." },
      { when: "Weeks 4–12", what: "Migraine trials measure attack frequency over about three months; give it that long if that is the reason for taking it." },
      { when: "Any time", what: "Blood magnesium rarely changes in people with healthy kidneys and does not reflect body stores well, so a normal test does not show whether it is helping." },
    ],
    cautions: [
      "Avoid unless advised if you have kidney disease, as magnesium can build up to dangerous levels.",
      "Reduces absorption of levothyroxine, tetracycline and quinolone antibiotics, and bisphosphonates; separate doses.",
      "Long-term omeprazole and similar medicines can cause low magnesium; this needs a doctor rather than self-treatment if you have symptoms.",
      "High doses cause diarrhoea and stomach cramps.",
    ],
    relatedLabs: ["magnesium", "egfr"],
  },
  {
    key: "zinc",
    name: "Zinc",
    aliases: ["zinc", "zinc gluconate", "zinc picolinate", "zinc citrate", "zinc acetate", "zinc bisglycinate", "zinc lozenge", "zinc lozenges"],
    category: "mineral",
    evidence: "weak",
    summary:
      "Needed for immunity, wound healing, taste and smell. Supplements help people who are low; zinc lozenges started early may shorten a cold slightly, but long-term high doses cause copper deficiency.",
    benefits: [
      { text: "Corrects zinc deficiency (more likely on vegan diets, in older people and with some gut conditions)", evidence: "strong" },
      { text: "Lozenges started within 24 hours of a cold may shorten it by a day or so", evidence: "weak" },
      { text: "Boosts immunity or testosterone in people who are not deficient", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: men need 9.5 mg a day and women 7 mg. Do not take more than 25 mg a day of zinc supplements unless advised by a doctor.",
    typicalDose: "7–15 mg daily if supplementing. Cold lozenges provide more than this and should only be used for a few days.",
    howToTake:
      "With food, as it often causes nausea on an empty stomach. Keep 2 hours away from iron supplements (they compete) and from tetracycline or quinolone antibiotics.",
    timeline: [
      { when: "Days 1–7", what: "Nausea or a metallic taste is the most common effect. Nothing else to notice." },
      { when: "Weeks 2–8", what: "If you were deficient, taste, skin and wound healing can improve. If you were not, you will notice no change." },
      { when: "Months 3+", what: "Doses above 25 mg a day, or 40 mg and more, taken for months can deplete copper, causing anaemia, low white cells and numbness. These develop quietly." },
    ],
    cautions: [
      "Long-term high doses cause copper deficiency, which can lead to anaemia and nerve damage.",
      "Reduces absorption of tetracycline and quinolone antibiotics and penicillamine; may reduce levothyroxine absorption. Separate doses.",
      "Zinc nasal sprays have caused permanent loss of smell; avoid them.",
    ],
    relatedLabs: ["hb", "neutrophils"],
  },
  {
    key: "iron",
    name: "Iron",
    aliases: [
      "iron", "ferrous sulfate", "ferrous sulphate", "ferrous fumarate", "ferrous gluconate",
      "iron bisglycinate", "ferrous bisglycinate", "iron tablets", "iron supplement",
    ],
    category: "mineral",
    evidence: "strong",
    summary:
      "Needed to make haemoglobin, which carries oxygen in the blood. Very effective for iron deficiency, but it should only be taken when a blood test shows you need it, and the cause of deficiency should be found.",
    benefits: [
      { text: "Corrects iron deficiency anaemia", evidence: "strong" },
      { text: "Reduces tiredness in women with low ferritin even before anaemia develops", evidence: "moderate" },
      { text: "More energy in people whose iron levels are normal", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: men need 8.7 mg a day and women aged 19–50 need 14.8 mg. If you are not deficient, taking 17 mg or less a day is unlikely to cause harm, but do not take iron without a reason. For deficiency, NICE and the British Society of Gastroenterology advise one tablet of ferrous sulfate 200 mg (65 mg of iron) a day, or every other day if side effects are a problem, continued for about three months after haemoglobin returns to normal. Unexplained deficiency in men and in women after the menopause needs investigation.",
    typicalDose: "For deficiency: one ferrous sulfate 200 mg tablet daily or on alternate days. Not otherwise recommended.",
    howToTake:
      "On an empty stomach if you can tolerate it, otherwise with a light meal. Take with water or orange juice; vitamin C helps absorption. Keep at least 2 hours away from tea, coffee, milk, calcium and antacids, and 4 hours from levothyroxine. Once a day or alternate days absorbs as well as twice a day.",
    timeline: [
      { when: "Days 1–14", what: "Black stools (harmless), constipation, nausea or stomach ache are common. New red cells start forming within about 7–10 days, but you will probably not feel different yet." },
      { when: "Weeks 2–4", what: "Haemoglobin should rise, typically around 20 g/L over 3–4 weeks. Tiredness and breathlessness from anaemia begin to ease. A GP will often recheck now; no rise means the plan needs reviewing." },
      { when: "Months 2–3", what: "Haemoglobin is usually back to normal. Ferritin (stored iron) is still low at this point." },
      { when: "Months 3–6", what: "Continuing for about three months after haemoglobin normalises refills ferritin. Hair shedding or restless legs linked to low iron improve slowly, if at all." },
    ],
    cautions: [
      "Iron overdose is dangerous, especially for children: an accidental overdose can be fatal. Keep tablets out of reach.",
      "Do not take iron without testing if you might have haemochromatosis (iron overload), which is common in people of Northern European and Irish descent.",
      "Reduces absorption of levothyroxine, tetracycline and quinolone antibiotics, levodopa and penicillamine; separate doses by at least 2–4 hours.",
      "Acid-reducing medicines and antacids reduce iron absorption.",
      "Iron deficiency can be caused by bleeding from the gut; do not self-treat without finding the cause.",
    ],
    relatedLabs: ["ferritin", "hb", "iron", "tsat", "mcv", "crp"],
  },
  {
    key: "calcium",
    name: "Calcium",
    aliases: [
      "calcium", "calcium carbonate", "calcium citrate", "calcium and vitamin d", "calcium vitamin d",
      "calcium and vitamin d3", "calcium d3", "calcium and d3", "calcium with vitamin d",
    ],
    category: "mineral",
    evidence: "weak",
    summary:
      "Builds and maintains bones and teeth. Supplements help people with low dietary intake or osteoporosis on treatment; for people who eat enough dairy or fortified foods, extra calcium does little for bones.",
    benefits: [
      { text: "With vitamin D, reduces fractures in older people in care homes or with low intake", evidence: "moderate" },
      { text: "Supports osteoporosis treatment when dietary calcium is low", evidence: "moderate" },
      { text: "Prevents fractures in people who already get enough from food", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: adults need 700 mg a day, which most people get from food (dairy, fortified plant milks, tinned fish with bones, bread made with fortified flour). Taking 1,500 mg or less a day of supplements is unlikely to cause harm. People on osteoporosis medicines are often prescribed calcium with vitamin D.",
    typicalDose: "500–1,000 mg a day to make up for a low diet, usually combined with vitamin D.",
    howToTake:
      "Calcium carbonate with meals (it needs stomach acid); calcium citrate at any time. Take no more than about 500 mg at once. Keep at least 4 hours away from levothyroxine and iron, and take bisphosphonates first, on an empty stomach, before any calcium.",
    timeline: [
      { when: "Days 1–14", what: "Constipation, wind or bloating are common. Nothing else to feel." },
      { when: "Months 1–12", what: "Bone builds and remodels slowly. There is no felt change." },
      { when: "Years 1–2", what: "Bone density scans may show a small difference (around 1–2%) in people who were low. In people with an adequate diet, little change is expected." },
    ],
    cautions: [
      "Reduces absorption of levothyroxine, iron, zinc, bisphosphonates, and tetracycline and quinolone antibiotics.",
      "With thiazide diuretics, high doses can raise blood calcium.",
      "Can raise the risk of kidney stones in supplement form; get advice if you have had them.",
      "Some studies have linked calcium supplements (not dietary calcium) to a small rise in heart attack risk; the evidence is debated. Food sources are preferred where possible.",
    ],
    relatedLabs: ["calcium_adj", "calcium", "vitd", "egfr"],
  },
  {
    key: "iodine",
    name: "Iodine",
    aliases: ["iodine", "potassium iodide", "kelp", "kelp tablets", "seaweed supplement"],
    category: "mineral",
    evidence: "weak",
    summary:
      "Needed to make thyroid hormones, and especially important in pregnancy for the baby's brain development. Useful if you eat little dairy or fish (the main UK sources); otherwise extra iodine does not improve thyroid function or energy.",
    benefits: [
      { text: "Meets needs on a diet with little milk, dairy or fish, such as vegan diets with unfortified plant milk", evidence: "moderate" },
      { text: "Supports the baby's brain development when intake in pregnancy is low", evidence: "moderate" },
      { text: "Boosts metabolism or energy in people with adequate intake", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: adults need 140 µg a day. Taking 0.5 mg (500 µg) or less a day of supplements is unlikely to cause harm. There is no routine UK recommendation to supplement in pregnancy, but needs rise and UK dietitians suggest a pregnancy supplement with about 150 µg if your diet is low in dairy and fish. Avoid kelp and seaweed supplements, which can contain very variable and excessive iodine.",
    typicalDose: "100–150 µg daily, often as part of a multivitamin.",
    howToTake: "Any time of day, with or without food. Choose potassium iodide over kelp.",
    timeline: [
      { when: "Weeks 1–4", what: "The thyroid takes up what it needs. Nothing to feel." },
      { when: "Weeks 4–12", what: "If you have a thyroid condition, extra iodine can shift thyroid tests; get them checked. Otherwise no change is expected." },
      { when: "Months+", what: "Steady intake supports normal thyroid function. You will not notice more energy or weight loss." },
    ],
    cautions: [
      "Too much iodine can cause both underactive and overactive thyroid, particularly in people with existing thyroid disease.",
      "Get medical advice first if you have thyroid disease, or take amiodarone or lithium.",
      "Kelp and seaweed products can contain many times the safe amount.",
    ],
    relatedLabs: ["tsh", "ft4"],
  },
  {
    key: "selenium",
    name: "Selenium",
    aliases: ["selenium", "selenomethionine", "sodium selenite", "selenium yeast", "brazil nut", "brazil nuts"],
    category: "mineral",
    evidence: "weak",
    summary:
      "Used in antioxidant enzymes and thyroid hormone metabolism. UK intakes are often a little below reference levels, but large trials have shown no benefit for cancer or heart disease, and possible harm at higher doses.",
    benefits: [
      { text: "Tops up a low intake (one or two Brazil nuts a day also does this)", evidence: "moderate" },
      { text: "Lowers thyroid antibodies in Hashimoto's thyroiditis; no proven effect on symptoms or need for medication", evidence: "weak" },
      { text: "Prevents cancer or heart disease", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: men need 75 µg a day and women 60 µg. Taking 350 µg or less a day of supplements is unlikely to cause harm.",
    typicalDose: "50–100 µg daily if supplementing.",
    howToTake: "With food, at any time of day.",
    timeline: [
      { when: "Weeks 1–4", what: "Blood selenium rises. Nothing to feel." },
      { when: "Months 1–6", what: "No noticeable change in health or energy is expected." },
      { when: "Months+", what: "Excess builds up with regular high doses; early signs of too much are garlic-smelling breath, brittle nails and hair loss." },
    ],
    cautions: [
      "Long-term intakes above the upper limit cause selenosis (hair and nail loss, skin rashes, nerve problems).",
      "A large trial found a possible increase in type 2 diabetes with 200 µg a day.",
      "Brazil nuts vary widely in selenium; do not eat large amounts daily alongside a supplement.",
    ],
  },
  {
    key: "electrolytes",
    name: "Electrolytes",
    aliases: [
      "electrolytes", "electrolyte", "electrolyte tablets", "electrolyte drink", "hydration tablets",
      "rehydration salts", "oral rehydration salts", "oral rehydration solution", "ors",
      "rehydration sachets", "salt tablets", "sodium tablets",
    ],
    category: "mineral",
    evidence: "weak",
    summary:
      "Sodium, potassium and other salts that the body loses through sweat, diarrhoea and vomiting. Oral rehydration sachets are a proven treatment for dehydration from illness; for everyday use with normal food and drink, they add nothing.",
    benefits: [
      { text: "Oral rehydration salts treat and prevent dehydration from diarrhoea and vomiting", evidence: "strong" },
      { text: "Replaces sodium during long (over 2 hours), hot, sweaty exercise and helps avoid low blood sodium", evidence: "moderate" },
      { text: "Better energy, focus or hydration in everyday life", evidence: "weak" },
    ],
    ukGuidance:
      "NHS: oral rehydration sachets from a pharmacy are recommended for dehydration from diarrhoea or vomiting, particularly for older people and those with other health conditions. Adults should aim for under 6 g of salt a day overall; many sports electrolyte products add to this.",
    typicalDose: "Rehydration sachets: as directed on the pack after each loose stool. Sports: around 300–600 mg sodium per hour during long, sweaty sessions.",
    howToTake:
      "Mix sachets with the exact volume of water stated; making them stronger or weaker reduces their effect. Sip rather than gulp if you feel sick.",
    timeline: [
      { when: "30–60 minutes", what: "Fluid and salts are absorbed faster than from plain water. Thirst and dizziness from dehydration ease." },
      { when: "Days 1–3 of illness", what: "Continue while diarrhoea or vomiting lasts; see a GP or call NHS 111 if you cannot keep fluids down." },
      { when: "Everyday use", what: "If you eat normally and are not sweating heavily, you will notice no difference compared with water." },
    ],
    cautions: [
      "Get advice before regular use if you have kidney disease, heart failure or high blood pressure, or follow a low-salt diet.",
      "Potassium-containing products can raise blood potassium with ACE inhibitors, ARBs, spironolactone or other potassium-sparing diuretics.",
      "If you take ACE inhibitors, ARBs, diuretics, metformin or SGLT2 inhibitors and become dehydrated, ask a pharmacist about pausing them (sick day rules).",
      "Drinking large volumes of plain water during endurance events without sodium can cause dangerously low blood sodium.",
    ],
    relatedLabs: ["sodium", "potassium", "egfr"],
  },

  /* ---------------------------------------------------------------- */
  /* Amino acids, protein and performance                              */
  /* ---------------------------------------------------------------- */
  {
    key: "creatine",
    name: "Creatine monohydrate",
    aliases: ["creatine", "creatine monohydrate", "creatine hcl", "creatine hydrochloride", "micronised creatine", "micronized creatine"],
    category: "amino acid",
    evidence: "strong",
    summary:
      "Increases the phosphocreatine stored in muscle, which fuels short, hard efforts. With resistance training it reliably adds strength and lean mass; it does nothing without the training.",
    benefits: [
      { text: "Greater gains in strength, power and lean mass when combined with resistance training", evidence: "strong" },
      { text: "Better repeated sprint and high-intensity performance", evidence: "strong" },
      { text: "Helps older adults keep muscle when combined with training", evidence: "moderate" },
      { text: "Better memory or thinking, mainly when sleep-deprived or on a vegetarian diet", evidence: "weak" },
    ],
    ukGuidance:
      "No NHS or SACN guidance. Creatine monohydrate is the form with almost all the research; other forms (HCl, buffered) are not shown to be better. If you compete in tested sport, choose a product that is batch-tested for banned substances.",
    typicalDose: "3–5 g daily. Optional loading: about 20 g a day split into four doses for 5–7 days, then 3–5 g daily.",
    howToTake:
      "Any time of day; timing around workouts matters little compared with taking it every day. Mixing with a meal or drink is fine. Splitting large doses reduces stomach upset.",
    timeline: [
      { when: "Days 1–7", what: "Muscles start storing more creatine. With a loading phase they are nearly full by the end of the week. You will not feel a boost; there is no stimulant effect." },
      { when: "Weeks 1–2", what: "Body weight often rises 1–2 kg, mostly water held inside muscle. This is expected, not fat." },
      { when: "Weeks 3–4", what: "Without loading, muscle stores reach saturation at 3–5 g a day. You may manage an extra rep or two on hard sets." },
      { when: "Weeks 8–12", what: "With consistent training, strength and lean mass gains are modestly larger than training alone (often around 1–2 kg more lean mass over several months). If you stop, stores fall back over 4–6 weeks." },
    ],
    cautions: [
      "Raises blood creatinine, which makes the calculated eGFR on a kidney test look lower than it really is. Tell whoever orders the test; a cystatin C test is unaffected.",
      "Avoid unless your doctor agrees if you have kidney disease or take medicines that strain the kidneys.",
      "Large single doses can cause stomach upset or diarrhoea.",
      "Claims that it causes hair loss rest on one small study that has not been repeated.",
    ],
    relatedLabs: ["creatinine", "egfr"],
  },
  {
    key: "protein_powder",
    name: "Protein powder",
    aliases: [
      "protein powder", "protein shake", "protein", "whey", "whey protein", "whey isolate",
      "casein", "pea protein", "soy protein", "soya protein", "vegan protein", "plant protein",
      "mass gainer",
    ],
    category: "amino acid",
    evidence: "strong",
    summary:
      "A convenient source of protein, usually from milk (whey, casein) or plants (pea, soya). It is food, not a special supplement: it helps you hit a protein target, and gives no advantage over the same protein from meals.",
    benefits: [
      { text: "Helps reach a daily protein target conveniently", evidence: "strong" },
      { text: "Supports muscle gain with resistance training when total protein would otherwise be low", evidence: "moderate" },
      { text: "Helps keep muscle during weight loss or in older age when protein intake is low", evidence: "moderate" },
      { text: "Extra muscle gain when you already eat enough protein", evidence: "weak" },
    ],
    ukGuidance:
      "The UK reference intake is 0.75 g of protein per kilogram of body weight a day. People doing regular resistance training benefit from up to about 1.6 g/kg a day; there is little extra gain above this.",
    typicalDose: "20–40 g of protein per serving, counted as part of your daily total.",
    howToTake:
      "Whenever it helps you reach your target; spreading protein over 3–4 meals is slightly better than one large dose. Whey isolate contains less lactose than whey concentrate if dairy upsets you.",
    timeline: [
      { when: "Days 1–7", what: "It is digested like any other protein. You will not feel stronger or recover noticeably faster." },
      { when: "Weeks 1–2", what: "Bloating or wind is possible, often from lactose or sweeteners." },
      { when: "Weeks 4–12", what: "With regular training, muscle gain reflects your training and total protein. If your diet was already high in protein, expect no extra difference." },
    ],
    cautions: [
      "Get advice from your kidney team before raising protein intake if you have chronic kidney disease.",
      "Avoid milk-based powders with a cows' milk allergy; whey concentrate contains lactose.",
      "Some products contain added caffeine, creatine or other ingredients, and sports products can be contaminated with banned substances; choose batch-tested products if you are tested.",
      "Some plant protein powders have been found to contain heavy metals; varying products and sources reduces exposure.",
    ],
    relatedLabs: ["urea", "egfr"],
  },
  {
    key: "collagen",
    name: "Collagen",
    aliases: ["collagen", "collagen peptides", "hydrolysed collagen", "hydrolyzed collagen", "marine collagen", "bovine collagen", "collagen protein", "collagen powder"],
    category: "amino acid",
    evidence: "weak",
    summary:
      "Hydrolysed collagen from animal skin, bones or fish scales. It is broken down into amino acids like any protein; claims for skin, hair and joints come mostly from small industry-funded trials.",
    benefits: [
      { text: "Improves skin hydration or elasticity; independent trials mostly find no effect", evidence: "weak" },
      { text: "Reduces joint pain", evidence: "weak" },
      { text: "Counts toward a protein target, though it is an incomplete protein and poor for building muscle", evidence: "moderate" },
    ],
    ukGuidance: "No NHS or SACN guidance.",
    typicalDose: "2.5–10 g daily in studies.",
    howToTake: "Mixed into a drink or food at any time of day.",
    timeline: [
      { when: "Days 1–7", what: "Digested into amino acids. Nothing to feel." },
      { when: "Weeks 8–12", what: "Trials measure skin and joint outcomes at this point. Most people see no visible change in skin, hair or nails." },
      { when: "Month 3+", what: "If you notice nothing by now, further use is unlikely to help." },
    ],
    cautions: [
      "Marine collagen can trigger fish allergy; bovine and porcine collagen are not suitable for some diets.",
      "Does not replace complete protein: it lacks tryptophan and is low in leucine.",
    ],
  },
  {
    key: "l_theanine",
    name: "L-theanine",
    aliases: ["l theanine", "theanine", "l-theanine"],
    category: "amino acid",
    evidence: "weak",
    summary:
      "An amino acid found in tea, taken to feel calmer or to smooth out caffeine. Small studies show modest effects on self-reported stress and alertness, but the evidence is limited.",
    benefits: [
      { text: "Reduces jitteriness and improves focus when combined with caffeine", evidence: "weak" },
      { text: "Reduces stress or anxiety", evidence: "weak" },
      { text: "Better sleep", evidence: "weak" },
    ],
    ukGuidance: "No NHS or SACN guidance.",
    typicalDose: "100–200 mg, sometimes in a 2:1 ratio with caffeine.",
    howToTake: "With or without food, about 30–60 minutes before you want the effect.",
    timeline: [
      { when: "30–60 minutes", what: "Any calming effect is subtle and short-lived. Many people notice nothing." },
      { when: "Weeks 1–4", what: "Effects do not build up with regular use; each dose works on its own." },
      { when: "Weeks 4+", what: "If you have not noticed a difference, it is unlikely to help you." },
    ],
    cautions: [
      "May slightly lower blood pressure; take care if you take blood pressure medicines.",
      "Little safety data in pregnancy or breastfeeding.",
      "May add to the effect of sedatives.",
    ],
  },
  {
    key: "caffeine",
    name: "Caffeine",
    aliases: ["caffeine", "caffeine tablets", "caffeine pills", "pre workout", "preworkout", "pre-workout", "guarana"],
    category: "other",
    evidence: "strong",
    summary:
      "A stimulant that reduces the feeling of tiredness and improves alertness, reaction time and exercise performance. Tolerance builds quickly with daily use, and it can disturb sleep many hours later.",
    benefits: [
      { text: "Improves alertness and reaction time, particularly when tired", evidence: "strong" },
      { text: "Improves endurance and high-intensity exercise performance at 3–6 mg/kg", evidence: "strong" },
      { text: "Better long-term energy with daily use (much of the effect becomes relief from withdrawal)", evidence: "weak" },
    ],
    ukGuidance:
      "Up to 400 mg a day is considered safe for most adults, with single doses up to about 200 mg. NHS: limit to 200 mg a day in pregnancy. Rough amounts: mug of instant coffee 100 mg, mug of filter coffee 140 mg, mug of tea 75 mg, can of cola 40 mg, 250 ml energy drink 80 mg. High-caffeine energy drinks are not for children.",
    typicalDose: "50–200 mg per dose; for sport, about 3 mg/kg about 60 minutes before.",
    howToTake:
      "About 30–60 minutes before you need it. Caffeine's half-life is around 5 hours (longer in pregnancy and with some medicines), so avoid it within about 8 hours of bedtime.",
    timeline: [
      { when: "15–60 minutes", what: "Peak blood level and peak alertness. Effects fade over several hours, but enough remains at bedtime to reduce deep sleep even if you fall asleep fine." },
      { when: "Days 1–14", what: "Tolerance builds with daily use, so the same dose feels weaker." },
      { when: "Weeks 2+", what: "With regular use, much of the morning lift is relief from overnight withdrawal rather than a true boost." },
      { when: "On stopping", what: "Headache, tiredness and low mood can start 12–24 hours after the last dose and last 2–9 days. Cutting down gradually helps." },
    ],
    cautions: [
      "Pure caffeine powders are dangerous: a teaspoon can be a fatal dose. Avoid them.",
      "Can cause anxiety, palpitations, raised blood pressure and worse acid reflux; take care with heart rhythm problems.",
      "Ciprofloxacin, fluvoxamine and some other medicines slow caffeine clearance; caffeine affects levels of lithium, clozapine and theophylline.",
      "Limit to 200 mg a day in pregnancy.",
    ],
    relatedLabs: ["bp_sys", "bp_dia", "pulse"],
  },

  /* ---------------------------------------------------------------- */
  /* Gut and fibre                                                     */
  /* ---------------------------------------------------------------- */
  {
    key: "psyllium",
    name: "Psyllium husk",
    aliases: [
      "psyllium", "psyllium husk", "psyllium husks", "ispaghula", "ispaghula husk", "fibre supplement",
      "fiber supplement", "fibre", "fiber", "soluble fibre", "soluble fiber", "bulk forming laxative",
    ],
    category: "other",
    evidence: "strong",
    summary:
      "A soluble fibre that forms a gel in the gut. It makes stools softer and more regular and lowers LDL cholesterol by a useful amount.",
    benefits: [
      { text: "Relieves constipation and makes bowel habit more regular (first-line bulk-forming laxative)", evidence: "strong" },
      { text: "Lowers LDL cholesterol by around 5–10% at about 10 g a day", evidence: "strong" },
      { text: "Eases IBS symptoms, particularly with constipation", evidence: "moderate" },
      { text: "Modestly lowers blood glucose after meals and HbA1c in type 2 diabetes", evidence: "moderate" },
    ],
    ukGuidance:
      "SACN recommends 30 g of fibre a day for adults; most people in the UK eat about 20 g. NICE recommends ispaghula as a first choice for IBS and constipation, and NHS advice lists bulk-forming laxatives as the usual first treatment for constipation.",
    typicalDose: "3.5 g (one sachet or about one heaped teaspoon of husk) once or twice a day, building up gradually; around 10 g a day for cholesterol.",
    howToTake:
      "Stir into at least 150–200 ml of water and drink straight away, then drink plenty of fluid through the day. Do not take it dry or just before lying down. Take other medicines at least an hour before or a few hours after.",
    timeline: [
      { when: "Days 1–3", what: "Bowel effect usually starts within 12–72 hours. Wind and bloating are common at first." },
      { when: "Weeks 1–2", what: "Wind usually settles as the gut adjusts; increase the dose gradually." },
      { when: "Weeks 4–6", what: "LDL cholesterol falls, visible on a blood test (often around 0.2–0.3 mmol/L). You will not feel this." },
      { when: "Month 2+", what: "Benefits last only while you keep taking it daily." },
    ],
    cautions: [
      "Always take with plenty of water: taken dry or with too little fluid it can swell and cause choking or blockage.",
      "Avoid with difficulty swallowing, a narrowed or blocked bowel, or faecal impaction.",
      "Can reduce absorption of other medicines; separate doses.",
      "If you take diabetes medicines, blood glucose may fall slightly; monitor.",
    ],
    relatedLabs: ["ldl", "chol_total", "non_hdl", "hba1c"],
  },
  {
    key: "probiotics",
    name: "Probiotics",
    aliases: [
      "probiotic", "probiotics", "live bacteria", "live cultures", "lactobacillus", "bifidobacterium",
      "saccharomyces boulardii", "s boulardii", "gut bacteria", "friendly bacteria",
    ],
    category: "other",
    evidence: "weak",
    summary:
      "Live bacteria or yeasts intended to benefit the gut. Effects depend on the specific strain and condition; for general wellbeing in healthy people there is little evidence of benefit.",
    benefits: [
      { text: "Reduces antibiotic-associated diarrhoea with certain strains (for example Lactobacillus rhamnosus GG, Saccharomyces boulardii)", evidence: "moderate" },
      { text: "Eases IBS symptoms in some people", evidence: "weak" },
      { text: "Better immunity, mood or general gut health in healthy people", evidence: "weak" },
    ],
    ukGuidance:
      "NICE (IBS): people who want to try probiotics should take one for at least four weeks at the dose recommended by the manufacturer, and stop if there is no improvement.",
    typicalDose: "As stated on the label for the specific strain; doses are in billions of colony-forming units (CFU).",
    howToTake:
      "Follow the label; many are best with or just before a meal. During antibiotics, take bacterial probiotics at least 2 hours apart from the antibiotic dose.",
    timeline: [
      { when: "Days 1–7", what: "Wind or bloating can increase at first." },
      { when: "Weeks 2–4", what: "If it is going to help IBS symptoms, you should notice by around four weeks." },
      { when: "Week 4+", what: "If nothing has changed, try a different strain or stop. Most strains do not settle permanently: they disappear within a week or two of stopping." },
    ],
    cautions: [
      "Avoid if you are severely immunocompromised, critically ill, have a central line or acute pancreatitis: rare but serious bloodstream infections have occurred.",
      "Saccharomyces boulardii is a yeast; avoid it with antifungal medicines.",
      "Products vary widely in strain and dose; benefits from one strain do not apply to others.",
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Sleep and hormones                                                */
  /* ---------------------------------------------------------------- */
  {
    key: "melatonin",
    name: "Melatonin",
    aliases: ["melatonin", "melatonin gummies", "slow release melatonin", "prolonged release melatonin"],
    category: "other",
    evidence: "weak",
    summary:
      "A hormone that signals night-time to the body clock. In the UK it is a prescription-only medicine. It shifts the timing of sleep more than it acts as a sleeping pill, and its effect on general insomnia is small.",
    benefits: [
      { text: "Reduces jet lag when crossing five or more time zones", evidence: "moderate" },
      { text: "Helps body-clock sleep disorders (for example delayed sleep phase) and sleep problems in some children with neurodevelopmental conditions, under specialist care", evidence: "moderate" },
      { text: "Helps you fall asleep faster in general insomnia (on average only a few minutes sooner)", evidence: "weak" },
    ],
    ukGuidance:
      "Prescription-only in the UK; it cannot legally be sold as a food supplement. A 2 mg prolonged-release form is licensed for short-term treatment of insomnia in people aged 55 and over (usually up to 13 weeks), and it is prescribed in some other situations such as jet lag and for some children. NICE advises cognitive behavioural therapy for insomnia (CBT-I) as the first treatment for long-term insomnia. Products bought online are unregulated and their content often differs widely from the label.",
    typicalDose: "Prolonged-release 2 mg 1–2 hours before bed when prescribed. For jet lag, 0.5–5 mg at local bedtime on arrival.",
    howToTake:
      "After food, 1–2 hours before bedtime, at the same time each night. Do not drink alcohol with it. For shifting body clock timing, smaller doses earlier in the evening are used under specialist advice.",
    timeline: [
      { when: "Night 1", what: "Some people feel drowsy within an hour or two; many notice little. It does not knock you out like a sleeping tablet." },
      { when: "Weeks 1–3", what: "With the prolonged-release form, any benefit builds over this time; prescribers usually review at about three weeks." },
      { when: "Weeks 3–13", what: "If it helps, you may fall asleep slightly sooner. Sleep quality otherwise changes little, and it does not treat the causes of insomnia." },
    ],
    cautions: [
      "Prescription-only in the UK; unlicensed products bought online may contain much more or less melatonin than stated, or other substances.",
      "Can cause next-day drowsiness; do not drive if affected.",
      "Fluvoxamine greatly raises melatonin levels. It can also interact with warfarin, sedatives, alcohol and some blood pressure and diabetes medicines.",
      "Not advised in pregnancy or breastfeeding, or with autoimmune disease, without medical advice.",
    ],
  },
  {
    key: "valerian",
    name: "Valerian",
    aliases: ["valerian", "valerian root", "valeriana"],
    category: "herbal",
    evidence: "weak",
    summary:
      "A herbal remedy sold for sleep and mild anxiety. Trials are small and inconsistent and, overall, do not show a clear benefit over placebo.",
    benefits: [
      { text: "Better sleep", evidence: "weak" },
      { text: "Reduces mild anxiety", evidence: "weak" },
    ],
    ukGuidance:
      "Sold in the UK as a traditional herbal registration (THR) product, which means quality and safety standards are met, but approval is based on traditional use rather than evidence that it works.",
    typicalDose: "As labelled; typically 300–600 mg of extract 30 minutes to 2 hours before bed.",
    howToTake: "In the evening. Do not combine with alcohol or other sleep aids.",
    timeline: [
      { when: "Night 1", what: "Mild drowsiness is possible but often not noticeable." },
      { when: "Weeks 2–4", what: "Trials that found any benefit usually measured it after a few weeks of nightly use. Many people notice no difference." },
      { when: "Week 4+", what: "If you have not noticed an improvement, it is unlikely to help." },
    ],
    cautions: [
      "Can cause morning grogginess; do not drive if affected.",
      "May add to the effects of alcohol, sedatives, sleeping tablets and antihistamines that cause drowsiness.",
      "Rare cases of liver injury have been reported.",
      "Avoid in pregnancy and breastfeeding, and in children unless advised.",
    ],
  },
  {
    key: "ashwagandha",
    name: "Ashwagandha",
    aliases: ["ashwagandha", "withania", "withania somnifera", "indian ginseng"],
    category: "herbal",
    evidence: "weak",
    summary:
      "An Ayurvedic herb marketed for stress, sleep and testosterone. The trials are small, short and often industry-funded, and recent safety reviews have raised concerns about liver injury and thyroid effects.",
    benefits: [
      { text: "Lower self-reported stress or anxiety scores over 6–8 weeks", evidence: "weak" },
      { text: "Better sleep", evidence: "weak" },
      { text: "Higher testosterone or strength gains", evidence: "weak" },
    ],
    ukGuidance:
      "In 2024 the UK Committee on Toxicity, which advises the Food Standards Agency, reviewed ashwagandha and raised concerns about liver injury, effects on thyroid hormones and use in pregnancy. Denmark has banned it from food supplements and other European regulators have issued warnings.",
    typicalDose: "300–600 mg of root extract a day in trials.",
    howToTake: "With food. If you choose to take it, keep courses short and stop at the first sign of liver or thyroid symptoms.",
    timeline: [
      { when: "Weeks 1–2", what: "Mild drowsiness or stomach upset is possible. Little else is noticeable." },
      { when: "Weeks 2–12", what: "This is when reported liver injury usually appears: yellow skin or eyes, dark urine, pale stools, itching or abdominal pain mean stop and see a doctor." },
      { when: "Weeks 6–8", what: "Trials report small falls in stress scores at this point; many people notice no difference." },
    ],
    cautions: [
      "Possible liver injury, sometimes severe; avoid with liver disease or alongside other substances that affect the liver, including heavy alcohol use.",
      "Can raise thyroid hormone levels; avoid with an overactive thyroid, and take care with thyroid medicines or an underactive thyroid.",
      "Avoid in pregnancy and breastfeeding.",
      "May add to sedatives, and may lower blood glucose and blood pressure; take care with diabetes and blood pressure medicines.",
      "Avoid with autoimmune conditions or immunosuppressants, and stop two weeks before surgery.",
    ],
    relatedLabs: ["alt", "ggt", "bilirubin", "tsh", "ft4"],
  },
  {
    key: "st_johns_wort",
    name: "St John's wort",
    aliases: ["st johns wort", "st john wort", "saint johns wort", "hypericum", "hypericum perforatum"],
    category: "herbal",
    evidence: "moderate",
    summary:
      "A herbal remedy for low mood. It does help mild to moderate depression in trials, but it interacts with many common medicines, including the contraceptive pill, which makes it risky to use without advice.",
    benefits: [
      { text: "Improves mild to moderate depression compared with placebo", evidence: "moderate" },
      { text: "Helps anxiety or menopausal symptoms", evidence: "weak" },
    ],
    ukGuidance:
      "Sold in the UK as a traditional herbal registration (THR) product for low mood and mild anxiety. NICE advises that doctors do not prescribe or recommend it for depression because product strength varies and it has serious interactions. Talk to a GP about low mood.",
    typicalDose: "As labelled on a THR product.",
    howToTake: "With food. Tell your GP and pharmacist you take it, and check every new medicine with a pharmacist.",
    timeline: [
      { when: "Weeks 1–2", what: "No mood change yet. Its effects on liver enzymes begin, which is when interactions with other medicines start." },
      { when: "Weeks 2–6", what: "As with antidepressants, any improvement in mood usually takes several weeks." },
      { when: "After stopping", what: "Interactions can last about two weeks after the last dose." },
    ],
    cautions: [
      "Makes hormonal contraception (combined pill, progestogen-only pill, implant) less effective; use another method during and for 28 days after.",
      "Reduces the effect of warfarin, ciclosporin, tacrolimus, digoxin, some HIV and cancer medicines, some epilepsy medicines and many others.",
      "Risk of serotonin syndrome with SSRIs, SNRIs, triptans, tramadol and other serotonergic medicines.",
      "Increases sensitivity to sunlight.",
      "Avoid in pregnancy and breastfeeding, and with bipolar disorder.",
    ],
  },
  {
    key: "echinacea",
    name: "Echinacea",
    aliases: ["echinacea", "echinacea purpurea", "purple coneflower"],
    category: "herbal",
    evidence: "weak",
    summary:
      "A herbal remedy taken for colds. Overall, reviews find it does not meaningfully shorten colds, with at most a small, uncertain effect on preventing them.",
    benefits: [
      { text: "Shortens colds once they start", evidence: "weak" },
      { text: "Prevents colds", evidence: "weak" },
    ],
    ukGuidance:
      "Sold in the UK as a traditional herbal registration (THR) product for cold and flu symptoms. The MHRA advises that oral echinacea should not be given to children under 12.",
    typicalDose: "As labelled; THR products are usually for up to 10 days.",
    howToTake: "Started at the first sign of a cold, for short courses only.",
    timeline: [
      { when: "Days 1–3", what: "Allergic reactions such as rash, if they happen, usually appear early." },
      { when: "Days 3–10", what: "Colds normally clear in 7–10 days regardless; any difference from echinacea is small or absent." },
      { when: "Long-term", what: "Not intended for continuous use." },
    ],
    cautions: [
      "Allergic reactions, particularly in people allergic to the daisy family (ragweed, chrysanthemums, marigolds) or with asthma or eczema.",
      "Not for children under 12.",
      "Avoid with autoimmune conditions or immunosuppressant medicines.",
    ],
  },
  {
    key: "turmeric",
    name: "Turmeric (curcumin)",
    aliases: ["turmeric", "curcumin", "turmeric curcumin", "turmeric and black pepper", "curcuminoids"],
    category: "herbal",
    evidence: "weak",
    summary:
      "Curcumin, the active compound in turmeric, is sold for joint pain and inflammation. It is poorly absorbed, trials are mostly small and of low quality, and concentrated products have been linked to liver injury.",
    benefits: [
      { text: "Reduces knee osteoarthritis pain", evidence: "weak" },
      { text: "Lowers inflammation or improves general health", evidence: "weak" },
    ],
    ukGuidance:
      "No NHS or SACN guidance. Turmeric used as a spice in food is safe; concentrated supplements are different.",
    typicalDose: "500–1,000 mg of curcumin extract a day in trials.",
    howToTake: "With a meal containing fat. Products with black pepper extract (piperine) are absorbed much better, which also increases liver and interaction risks.",
    timeline: [
      { when: "Weeks 1–2", what: "Stomach upset or loose stools are possible. Nothing else to notice." },
      { when: "Weeks 4–8", what: "Trials measuring joint pain report at this point; any effect is modest and many people notice none." },
      { when: "Weeks 8–12", what: "If there is no improvement by now, stop. Watch for liver warning signs (yellow skin, dark urine, itching) throughout." },
    ],
    cautions: [
      "Liver injury has been reported with concentrated supplements, especially those combined with black pepper extract.",
      "May increase bleeding with warfarin, other anticoagulants and antiplatelets.",
      "Avoid with gallstones or bile duct problems.",
      "May lower blood glucose with diabetes medicines.",
      "Avoid high-dose supplements in pregnancy.",
    ],
    relatedLabs: ["alt", "bilirubin"],
  },
  {
    key: "coq10",
    name: "Coenzyme Q10",
    aliases: ["coq10", "co q10", "coenzyme q10", "ubiquinol", "ubiquinone", "ubidecarenone"],
    category: "other",
    evidence: "weak",
    summary:
      "A compound the body makes that is involved in energy production in cells. Often taken for statin muscle aches, heart health or migraine, but the evidence is mixed and mostly weak.",
    benefits: [
      { text: "Relieves muscle aches caused by statins (trials conflict)", evidence: "weak" },
      { text: "Reduces migraine frequency", evidence: "weak" },
      { text: "Adds benefit to standard heart failure treatment (mainly one trial)", evidence: "weak" },
      { text: "More energy in healthy people", evidence: "weak" },
    ],
    ukGuidance: "No NHS or SACN guidance. If you have muscle pain on a statin, talk to your GP; options include a different statin or dose.",
    typicalDose: "100–300 mg a day.",
    howToTake: "With a meal containing fat, as it is fat-soluble.",
    timeline: [
      { when: "Weeks 1–4", what: "Blood levels rise over several weeks. You will not feel more energetic." },
      { when: "Weeks 8–12", what: "Trials for migraine and statin aches measure at around three months. Many people notice no change." },
      { when: "Month 3+", what: "If there is no benefit by now, further use is unlikely to help." },
    ],
    cautions: [
      "May reduce the effect of warfarin; tell your anticoagulation clinic.",
      "May slightly lower blood pressure and blood glucose.",
      "Mild stomach upset and insomnia are reported.",
    ],
  },
  {
    key: "glucosamine",
    name: "Glucosamine",
    aliases: ["glucosamine", "glucosamine sulfate", "glucosamine sulphate", "glucosamine hcl", "chondroitin", "glucosamine and chondroitin"],
    category: "other",
    evidence: "weak",
    summary:
      "Taken for joint pain, especially osteoarthritis. Good-quality trials show little or no benefit over placebo, and NICE does not recommend it.",
    benefits: [
      { text: "Reduces osteoarthritis pain or slows joint damage", evidence: "weak" },
      { text: "Protects joints in healthy people", evidence: "weak" },
    ],
    ukGuidance:
      "NICE (osteoarthritis) recommends against offering glucosamine. Exercise, weight management and appropriate pain relief are the recommended treatments.",
    typicalDose: "1,500 mg of glucosamine sulfate once a day in trials.",
    howToTake: "With food to reduce stomach upset.",
    timeline: [
      { when: "Weeks 1–4", what: "No noticeable effect. Stomach upset is possible." },
      { when: "Months 1–3", what: "Trials measure pain at this point; any difference from placebo is small at best." },
      { when: "Month 3+", what: "If your joints feel no better, stop." },
    ],
    cautions: [
      "Can increase the effect of warfarin and raise INR; avoid unless your anticoagulation clinic agrees.",
      "Usually made from shellfish; avoid with shellfish allergy unless the product is shellfish-free.",
      "May affect blood glucose control in diabetes.",
    ],
  },
  {
    key: "berberine",
    name: "Berberine",
    aliases: ["berberine", "berberine hcl", "berberine hydrochloride", "dihydroberberine"],
    category: "herbal",
    evidence: "weak",
    summary:
      "A plant compound promoted for blood sugar, cholesterol and weight loss. It does lower blood glucose in type 2 diabetes in small trials, but weight-loss claims are not supported, and it interacts with many medicines.",
    benefits: [
      { text: "Lowers blood glucose and HbA1c in type 2 diabetes (many small trials of variable quality)", evidence: "moderate" },
      { text: "Lowers LDL cholesterol and triglycerides", evidence: "weak" },
      { text: "Weight loss", evidence: "weak" },
    ],
    ukGuidance: "No NHS or NICE guidance; it is not a recommended treatment for diabetes or high cholesterol in the UK.",
    typicalDose: "500 mg two or three times a day with meals in trials.",
    howToTake: "With meals, split through the day to reduce stomach side effects.",
    timeline: [
      { when: "Days 1–7", what: "Constipation, diarrhoea, wind or cramps are common at first." },
      { when: "Weeks 1–2", what: "Blood glucose readings may start to fall if you have diabetes. If you take diabetes medicines, watch for hypos." },
      { when: "Months 2–3", what: "HbA1c and cholesterol changes show on blood tests at around three months. Weight usually changes little." },
    ],
    cautions: [
      "Can cause low blood sugar with insulin, sulfonylureas (such as gliclazide) and other diabetes medicines.",
      "Affects liver enzymes that clear many drugs: raises levels of ciclosporin and tacrolimus and may affect statins, some antidepressants and anticoagulants. Check with a pharmacist.",
      "Do not use in pregnancy, breastfeeding or for children: it can cause dangerous jaundice in newborns.",
    ],
    relatedLabs: ["hba1c", "glucose_fasting", "ldl", "triglycerides", "alt"],
  },
];

/* ------------------------------------------------------------------ */
/* Matching free text to a supplement                                  */
/* ------------------------------------------------------------------ */

/** Dose amounts, counts and bare units: "4000iu", "15mg", "2x", "x2", "mg". */
const DOSE_TOKEN = /^(?:x?\d+(?:\.\d+)?(?:mg|g|mcg|ug|iu|ml|kiu|k|x|caps?|tabs?)?|mg|g|mcg|ug|iu|ml|x)$/;
const FILLER = new Set(["and", "with", "plus"]);

/** Lowercase, strip doses and punctuation, and join split names like "omega 3", "b 12". */
function tokenise(text: string): string[] {
  const s = text
    .toLowerCase()
    .replace(/[µμ]/g, "u")
    .replace(/['’`]/g, "")
    .replace(/\bi\.u\.?/g, "iu")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/([a-z])-(?=\d)/g, "$1")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/\bomega ?(3|6|9)\b/g, "omega$1")
    .replace(/\bco ?q ?10\b/g, "coq10")
    .replace(/\bb (12|1|2|3|5|6|7|9)\b/g, "b$1")
    .replace(/\bd (2|3)\b/g, "d$1")
    .replace(/\bk (1|2)\b/g, "k$1");
  return s
    .split(/\s+/)
    .filter((t) => t && !DOSE_TOKEN.test(t) && !FILLER.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

interface Phrase {
  tokens: string[];
  score: number;
  supplement: Supplement;
}

let phraseIndex: Phrase[] | undefined;

function phrases(): Phrase[] {
  if (phraseIndex) return phraseIndex;
  const out: Phrase[] = [];
  for (const supplement of SUPPLEMENTS) {
    const seen = new Set<string>();
    for (const p of [supplement.name, ...supplement.aliases]) {
      const tokens = tokenise(p);
      const joined = tokens.join(" ");
      if (!joined || seen.has(joined)) continue;
      seen.add(joined);
      out.push({ tokens, score: joined.length, supplement });
    }
  }
  phraseIndex = out;
  return out;
}

function containsRun(words: string[], run: string[]): boolean {
  outer: for (let i = 0; i + run.length <= words.length; i++) {
    for (let j = 0; j < run.length; j++) {
      if (words[i + j] !== run[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Best match for free text such as a reminder title ("Vit D 4000iu", "fish oil"). */
export function findSupplement(text: string): Supplement | undefined {
  const words = tokenise(text);
  if (words.length === 0) return undefined;
  let best: Phrase | undefined;
  for (const p of phrases()) {
    if ((!best || p.score > best.score) && containsRun(words, p.tokens)) best = p;
  }
  return best?.supplement;
}
