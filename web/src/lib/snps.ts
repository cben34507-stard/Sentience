/**
 * Curated, well-studied SNPs worth pulling out of a 23andMe raw export.
 *
 * Genotypes are read exactly as 23andMe reports them: forward (plus) strand
 * on build 37. Many papers name alleles on the gene's own strand instead,
 * which is why a "C677T" result shows up as G/A in the raw file. The `calls`
 * below are written against the raw-file letters so nothing needs flipping.
 *
 * These are associations from population studies, not diagnoses. Small
 * effects, mixed replication and lifestyle all matter more for most of them.
 */
export interface SnpDef {
  rsid: string;
  gene: string;
  /** Short subtitle: the trait or system the marker relates to. */
  about: string;
  /** Everyday-language explanation of what the gene does and what a variant tends to change. */
  plain: string;
  /** One practical sentence on what, if anything, to do with the result. */
  takeaway?: string;
  /**
   * Raw-file genotype (letters sorted) → plain reading. The technical label
   * from the literature sits in brackets at the end where there is one.
   */
  calls?: Record<string, string>;
  /** Marker sits on the X chromosome: one letter is expected in males. */
  xLinked?: boolean;
  evidence?: "strong" | "moderate" | "weak";
}

export const CURATED_SNPS: SnpDef[] = [
  // Methylation / B vitamins
  {
    rsid: "rs1801133", gene: "MTHFR C677T", about: "Folate metabolism", evidence: "strong",
    plain: "MTHFR makes an enzyme (a protein that speeds up a chemical reaction) that turns folate, vitamin B9 from leafy greens, pulses and fortified foods, into the active form your body uses. That active folate is needed to keep homocysteine, a substance in the blood, at a healthy level. The common 'slower' version of this gene makes an enzyme that works less well, which mainly matters when folate intake is low.",
    takeaway: "If you have two copies of the slower version (AA here, 677TT), make sure you get enough folate from greens, pulses or a folic-acid supplement; there's no need for 'methylfolate' unless a doctor advises it.",
    calls: {
      GG: "You have two copies of the usual version, so this enzyme works at its normal speed. (677CC)",
      AG: "You have one copy of the slower version. Your enzyme works at about two-thirds of the usual speed, which rarely matters if you eat enough folate. (677CT)",
      AA: "You have two copies of the slower version. Your enzyme works at roughly 30% of the usual speed, which can let homocysteine (a blood marker) rise when folate intake is low. (677TT)",
    },
  },
  {
    rsid: "rs1801131", gene: "MTHFR A1298C", about: "Folate metabolism", evidence: "moderate",
    plain: "This is a second common change in the same folate-processing gene (MTHFR) as the 677 marker. Its effect on how well the enzyme works is smaller, and on its own it doesn't usually change blood test results.",
    takeaway: "Little to act on by itself; eating enough folate (greens, pulses, fortified foods) covers this and the 677 marker alike.",
    calls: {
      TT: "You have two copies of the usual version: typical enzyme activity. (1298AA)",
      GT: "You have one copy of the changed version: a small effect at most. (1298AC)",
      GG: "You have two copies of the changed version, so the enzyme works modestly less well. On its own (if your 677 result is the usual 677CC) homocysteine, a blood marker, is usually normal. (1298CC)",
    },
  },
  {
    rsid: "rs602662", gene: "FUT2", about: "B12 levels, gut microbiome", evidence: "moderate",
    plain: "FUT2 decides whether your body puts blood-group sugars (the A, B or O markers) into saliva, mucus and the gut lining, which shapes which gut bacteria thrive there. This marker in the same gene has been linked to vitamin B12 levels in large studies, and is usually inherited together with the main 'secretor' marker, rs601338.",
    takeaway: "Read your secretor status on the rs601338 card; there's nothing extra to act on here.",
    calls: {
      GG: "This marker is usually inherited together with rs601338, the main FUT2 marker, so read your secretor status on that card.",
      AG: "This marker is usually inherited together with rs601338, the main FUT2 marker, so read your secretor status on that card.",
      AA: "This marker is usually inherited together with rs601338, the main FUT2 marker, so read your secretor status on that card.",
    },
  },
  {
    rsid: "rs601338", gene: "FUT2 W143X", about: "Secretor status", evidence: "strong",
    plain: "FUT2 decides whether your body puts blood-group sugars (the same A, B or O markers found on red blood cells) into saliva, mucus and the gut lining. People who do are called 'secretors'. About one in five Europeans are 'non-secretors' because both their copies of the gene are switched off, which changes which gut bacteria and viruses can latch on and slightly raises vitamin B12 levels.",
    takeaway: "Nothing you need to do; it's mostly an interesting trait rather than a health problem.",
    calls: {
      GG: "Both copies work: you are a 'secretor', so blood-group sugars appear in your saliva and gut lining. (Secretor)",
      AG: "One working copy is enough: you are a 'secretor'. You also carry one switched-off copy, which you could pass on to children. (Secretor, carrier of the non-secretor allele)",
      AA: "Both copies are switched off: you are a 'non-secretor', like about 20% of Europeans. Blood-group sugars don't appear in your saliva or gut lining, vitamin B12 tends to run higher on average, and you're resistant to the most common norovirus (winter vomiting bug) strains. (Non-secretor)",
    },
  },

  // Caffeine
  {
    rsid: "rs762551", gene: "CYP1A2", about: "Caffeine metabolism speed", evidence: "strong",
    plain: "CYP1A2 is the main liver enzyme that breaks down caffeine. This marker affects how much the liver steps up production of that enzyme, especially in people who drink a lot of coffee or smoke. If you break caffeine down more slowly, each cup stays in your system for longer.",
    takeaway: "If caffeine affects your sleep, keeping it to the morning is the simple fix; how you actually feel is a better guide than this marker.",
    calls: {
      AA: "Two copies of the 'fast' version: your liver clears caffeine quickly, and gets faster still with regular coffee or smoking. (*1F/*1F, fast inducible metaboliser)",
      AC: "One copy of the slower version: you clear caffeine somewhat more slowly. (slower metaboliser, one C)",
      CC: "Two copies of the slower version: caffeine lingers in your body for longer. (slow metaboliser)",
    },
  },
  {
    rsid: "rs5751876", gene: "ADORA2A", about: "Caffeine-induced anxiety / sleep disruption", evidence: "moderate",
    plain: "Caffeine keeps you alert by blocking adenosine, a chemical that builds up while you're awake and makes you feel sleepy. ADORA2A makes one of the receptors (docking points on brain cells) that adenosine works through. Variants here change how strongly people feel caffeine's side effects, such as jitteriness and lighter sleep.",
    takeaway: "If caffeine makes you anxious or disturbs your sleep, cutting back or having it earlier in the day is the obvious lever, whatever your result.",
    calls: {
      CC: "Two copies of the less sensitive version: you're less likely to feel anxious after caffeine.",
      CT: "One copy of each version: somewhere in between.",
      TT: "Two copies of the more sensitive version: caffeine is more likely to make you anxious or disrupt your sleep.",
    },
  },
  {
    rsid: "rs2472297", gene: "CYP1A1/2 region", about: "Caffeine consumption tendency", evidence: "strong",
    plain: "This marker sits between two genes that help break down caffeine. In very large studies, people with the T version tend to drink a little more coffee, probably because they clear caffeine faster and so feel each cup for less time.",
    takeaway: "Nothing to act on; the difference is small, about a fraction of a cup a day on average.",
    calls: {
      CC: "No copies of the T version: a typical tendency for how much caffeine you drink.",
      CT: "One T: people with this tend to drink slightly more caffeine.",
      TT: "Two T: people with this tend to drink more caffeine.",
    },
  },

  // Brain & mood
  {
    rsid: "rs4680", gene: "COMT Val158Met", about: "Dopamine clearance in the prefrontal cortex", evidence: "strong",
    plain: "COMT makes an enzyme that clears away dopamine, a chemical messenger involved in focus and motivation, in the front of the brain (the part used for planning and holding things in mind). The 'Met' version of the enzyme works more slowly, so dopamine hangs around longer. The effect on actual personality or thinking is small and depends a lot on circumstances.",
    takeaway: "Nothing to act on; the 'warrior' and 'worrier' nicknames are popular shorthand, and real-world effects are small.",
    calls: {
      GG: "Two copies of the faster version: dopamine is cleared quickly. Sometimes nicknamed 'warrior'. (Val/Val)",
      AG: "One copy of each: in between. (Val/Met)",
      AA: "Two copies of the slower version: dopamine is cleared more slowly. Linked with better working memory when calm but more sensitivity to stress; sometimes nicknamed 'worrier'. (Met/Met)",
    },
  },
  {
    rsid: "rs6265", gene: "BDNF Val66Met", about: "Neuroplasticity, mood, exercise response", evidence: "strong",
    plain: "BDNF is a growth factor: a protein that helps brain cells grow, form connections and adapt, which underpins learning and memory. The 'Met' version is released less readily when brain cells are active. It has been linked in some studies to memory and mood, but the effects are modest.",
    takeaway: "Nothing specific to act on; regular exercise raises BDNF whichever version you have.",
    calls: {
      CC: "Two copies of the usual version: typical BDNF release when brain cells are active. (Val/Val)",
      CT: "One copy of the 'Met' version: somewhat reduced BDNF release. (Val/Met)",
      TT: "Two copies of the 'Met' version: reduced BDNF release. (Met/Met)",
    },
  },
  {
    rsid: "rs1800497", gene: "DRD2/ANKK1 Taq1A", about: "Dopamine D2 receptor density", evidence: "moderate",
    plain: "Dopamine is the brain's reward and motivation messenger, and D2 receptors are one of the docking points it acts on. The 'A1' version of this marker (which sits just next to the receptor gene) has been linked in some studies to having fewer D2 receptors, and through that to reward-seeking behaviour, but findings are inconsistent.",
    takeaway: "Nothing to act on; links to behaviour are small and not reliably replicated.",
    calls: {
      GG: "No copies of A1: a typical number of dopamine D2 receptors. (A2/A2)",
      AG: "One copy of A1: some studies find fewer D2 receptors, linked to more reward-seeking. (A1/A2)",
      AA: "Two copies of A1: linked to fewer dopamine D2 receptors. (A1/A1)",
    },
  },
  {
    rsid: "rs53576", gene: "OXTR", about: "Oxytocin receptor; social sensitivity", evidence: "weak",
    plain: "Oxytocin is a hormone involved in bonding, trust and social behaviour, and this gene makes the receptor it acts on. Early studies linked this marker to empathy and how people handle stress, but larger studies have mostly not confirmed it.",
    takeaway: "Nothing to act on; treat it as a curiosity.",
    calls: {
      GG: "Two G: linked to higher empathy in some studies. (GG)",
      AG: "One of each: in between. (AG)",
      AA: "Two A: evidence for any effect is mixed. (AA)",
    },
  },
  {
    rsid: "rs6295", gene: "HTR1A C-1019G", about: "Serotonin receptor; mood/anxiety", evidence: "weak",
    plain: "This gene makes a receptor for serotonin, a chemical messenger involved in mood and anxiety. The marker affects how much of the receptor is made, and has been studied in depression and in how people respond to antidepressants, with conflicting results.",
    takeaway: "Nothing to act on; the evidence is mixed.",
    calls: {
      CG: "One copy of each version; evidence for any effect on mood is mixed. (heterozygous)",
      CC: "Two copies of the C version; evidence for any effect on mood is mixed. (homozygous)",
      GG: "Two copies of the G version; evidence for any effect on mood is mixed. (homozygous)",
    },
  },
  {
    rsid: "rs6323", gene: "MAOA", about: "Monoamine breakdown", xLinked: true, evidence: "weak",
    plain: "MAOA makes an enzyme that breaks down serotonin, dopamine and noradrenaline, chemical messengers that affect mood and alertness. The gene is on the X chromosome, so men have one copy and women two. This particular marker doesn't change the protein's building blocks and has only weak, mixed links to mood or behaviour.",
    takeaway: "Nothing to act on; evidence is weak.",
  },
  {
    rsid: "rs324420", gene: "FAAH C385A", about: "Anandamide breakdown; anxiety/pain", evidence: "moderate",
    plain: "Anandamide is one of the body's own cannabis-like chemicals, involved in mood, stress, pain and appetite. FAAH is the enzyme that breaks it down. The A version makes less working FAAH, so anandamide levels run a little higher, which some studies link to lower anxiety.",
    takeaway: "Nothing to act on; effects are modest.",
    calls: {
      CC: "Two copies of the usual version: typical amounts of the FAAH enzyme. (Pro/Pro)",
      AC: "One A: a bit less FAAH, so slightly higher anandamide. (Pro/Thr)",
      AA: "Two A: less FAAH; linked to lower anxiety. (Thr/Thr)",
    },
  },
  {
    rsid: "rs1799971", gene: "OPRM1 A118G", about: "Opioid receptor; pain & reward", evidence: "moderate",
    plain: "This gene makes the mu-opioid receptor, the main docking point for the body's own painkillers (endorphins) and for opioid medicines such as morphine. The G version has been linked to needing more opioid pain relief and, in some studies, to finding alcohol more rewarding, but the effects are modest and vary between populations.",
    takeaway: "It isn't routinely used to guide prescribing, but mention it to a doctor or pharmacist if you're prescribed opioid painkillers.",
    calls: {
      AA: "Two copies of the usual version: typical. (Asn/Asn)",
      AG: "One G: you may need more opioid pain relief, and some studies find alcohol feels more rewarding. (Asn/Asp40)",
      GG: "Two G: two copies of the version linked to needing more opioid pain relief. (Asp40/Asp40)",
    },
  },
  {
    rsid: "rs1360780", gene: "FKBP5", about: "Cortisol feedback; stress resilience", evidence: "moderate",
    plain: "FKBP5 helps set how quickly your body switches off its stress-hormone (cortisol) response after something stressful. The T version makes that switch-off slower, so cortisol stays up for longer. In studies this mattered mainly for people who went through serious stress in childhood.",
    takeaway: "Nothing to act on; on its own it predicts very little.",
    calls: {
      CC: "No T: your stress hormones settle back down at a typical pace.",
      CT: "One T: one copy of the version linked to a slower stress-hormone switch-off.",
      TT: "Two T: a stronger, longer-lasting cortisol (stress hormone) response, mainly seen in people who had serious stress early in life.",
    },
  },
  {
    rsid: "rs3813929", gene: "HTR2C -759C/T", about: "Serotonin receptor; appetite / antipsychotic weight gain", xLinked: true, evidence: "moderate",
    plain: "This gene makes a serotonin receptor that helps control appetite and feeling full. The T version has been linked to putting on less weight when taking some antipsychotic medicines, which commonly increase appetite. The gene is on the X chromosome, so men show one letter here and women two.",
    takeaway: "Mention it to a doctor or pharmacist if you're prescribed an antipsychotic; otherwise there's nothing to act on.",
    calls: {
      C: "You have one copy of this gene (it's on the X chromosome) and it's the usual version: typical. (C)",
      T: "You have one copy of this gene (it's on the X chromosome) and it's the T version: linked to less weight gain on some antipsychotic medicines. (T)",
      CC: "Two copies of the usual version: typical. (CC)",
      CT: "One T: one copy of the version linked to less weight gain on some antipsychotic medicines. (CT)",
      TT: "Two T: two copies of the version linked to less weight gain on some antipsychotic medicines. (TT)",
    },
  },

  // Sleep & circadian
  {
    rsid: "rs1801260", gene: "CLOCK 3111T/C", about: "Circadian rhythm / chronotype", evidence: "weak",
    plain: "CLOCK is one of the core genes of your body clock, the roughly 24-hour cycle that sets when you feel sleepy and alert. This marker has been linked in some studies to being more of an 'evening person', but large studies haven't confirmed it, and hundreds of genes each nudge this trait a tiny amount.",
    takeaway: "Nothing to act on; your actual sleep habits tell you far more than this marker.",
    calls: {
      AA: "No copies of the C version: typical. (3111TT)",
      AG: "One copy of the C version: linked to being more of an evening person in some studies. (3111TC)",
      GG: "Two copies of the C version: linked to being more of an evening person in some studies. (3111CC)",
    },
  },
  {
    rsid: "rs73598374", gene: "ADA G22A", about: "Deep sleep / sleep pressure", evidence: "moderate",
    plain: "ADA makes an enzyme that breaks down adenosine, the chemical that builds 'sleep pressure' the longer you're awake. The T version breaks it down more slowly, so adenosine builds up more; in small studies that meant more deep sleep and feeling worse after a short night.",
    takeaway: "Nothing to act on; the studies are small, though if you carry T and handle short nights badly, it fits.",
    calls: {
      CC: "Two copies of the usual version: adenosine is broken down at a typical rate.",
      CT: "One T: more deep sleep, and more affected by losing sleep.",
      TT: "Two T: two copies of the version linked to more deep sleep and being more affected by sleep loss.",
    },
  },
  {
    rsid: "rs10830963", gene: "MTNR1B", about: "Melatonin receptor; fasting glucose", evidence: "strong",
    plain: "MTNR1B makes a receptor for melatonin, the hormone that rises at night, including on the cells in the pancreas that release insulin. The G version makes this receptor more active, so melatonin holds back insulin a little more. It's linked to slightly higher fasting blood sugar and a small rise in type 2 diabetes risk.",
    takeaway: "If you carry G, there's some evidence that large meals late in the evening are harder on your blood sugar, so earlier dinners are a reasonable, low-cost experiment.",
    calls: {
      CC: "No G: typical.",
      CG: "One G: slightly higher fasting blood sugar, and eating late in the evening may affect how well you handle sugar more than usual.",
      GG: "Two G: as for one G but stronger: slightly higher fasting blood sugar, and late-evening eating may hit your blood-sugar control harder.",
    },
  },

  // Metabolism & weight
  {
    rsid: "rs9939609", gene: "FTO", about: "Appetite & obesity risk", evidence: "strong",
    plain: "FTO is the gene with the best-known link to body weight. The A version is common and seems to work mainly through appetite and food choices rather than a slower metabolism. The effect is real but small next to diet, activity and sleep.",
    takeaway: "Nothing specific to act on; studies show being physically active noticeably weakens the effect.",
    calls: {
      TT: "No copies of the A version that's linked to higher weight.",
      AT: "One A: about 1 kg heavier on average, with slightly more appetite. Exercise weakens the effect.",
      AA: "Two A: about 3 kg heavier on average.",
    },
  },
  {
    rsid: "rs7903146", gene: "TCF7L2", about: "Type 2 diabetes risk", evidence: "strong",
    plain: "TCF7L2 helps control how much insulin your pancreas releases after you eat. The T version is the strongest single common genetic risk factor for type 2 diabetes found so far, mainly because it blunts that insulin release. The risk figures in your reading are relative (compared with people without it), so the real-world change depends on your other risk factors.",
    takeaway: "If you carry T, it's sensible to keep weight, activity and diet in check and ask for an HbA1c (average blood sugar) test at routine check-ups.",
    calls: {
      CC: "No T: typical type 2 diabetes risk from this marker.",
      CT: "One T: about 1.4 times the usual (relative) risk of type 2 diabetes.",
      TT: "Two T: roughly 1.8 to 2 times the usual (relative) risk of type 2 diabetes. Weight, activity and diet still matter more; worth keeping your HbA1c (average blood sugar) checked.",
    },
  },
  {
    rsid: "rs1801282", gene: "PPARG Pro12Ala", about: "Insulin sensitivity", evidence: "strong",
    plain: "PPARG is a master switch in fat cells that affects how fat is stored and how well the body responds to insulin, the hormone that moves sugar out of the blood. The less common 'Ala' version is linked to slightly better insulin response and a modestly lower risk of type 2 diabetes.",
    takeaway: "Nothing to act on.",
    calls: {
      CC: "Two copies of the usual version, the most common result. (Pro/Pro)",
      CG: "One copy of the 'Ala' version, which is modestly protective against type 2 diabetes. (Pro/Ala)",
      GG: "Two copies of the 'Ala' version, which is modestly protective against type 2 diabetes. (Ala/Ala)",
    },
  },
  {
    rsid: "rs1137101", gene: "LEPR Gln223Arg", about: "Leptin receptor; satiety", evidence: "weak",
    plain: "Leptin is a hormone made by body fat that tells the brain how much energy you have stored, which helps turn hunger down. This gene makes the receptor leptin acts on. This common variant has only weak and inconsistent links to appetite and weight.",
    takeaway: "Nothing to act on; evidence is weak.",
    calls: {
      AA: "Two copies of the 'Gln' version. (Gln/Gln)",
      AG: "One copy of each version. (Gln/Arg)",
      GG: "Two copies of the 'Arg' version: weak, inconsistent links to appetite. (Arg/Arg)",
    },
  },
  {
    rsid: "rs4994", gene: "ADRB3 Trp64Arg", about: "Fat metabolism / weight regain", evidence: "weak",
    plain: "ADRB3 makes a receptor on fat cells that responds to adrenaline and helps release stored fat to be burned for energy. The 'Arg' version has been linked in some studies to weight gain and regaining weight after dieting, but results are inconsistent.",
    takeaway: "Nothing to act on; evidence is weak.",
    calls: {
      AA: "Two copies of the usual version, the most common result. (Trp/Trp)",
      AG: "One copy of the 'Arg' version. (Trp/Arg)",
      GG: "Two copies of the 'Arg' version. (Arg/Arg)",
    },
  },
  {
    rsid: "rs5082", gene: "APOA2 -265T/C", about: "Saturated fat response", evidence: "moderate",
    plain: "APOA2 makes a protein that carries fats around in the blood. In several studies, people with two C copies who ate a lot of saturated fat (fatty meat, butter, cheese) had a higher BMI than those who ate less; this pattern wasn't seen in people with other results.",
    takeaway: "If you're GG here (-265CC), it's a reasonable nudge to go easier on saturated fat; otherwise there's nothing to act on.",
    calls: {
      AA: "No copies of the C version. (-265TT)",
      AG: "One C: not in the group whose weight seems sensitive to saturated fat. (-265TC)",
      GG: "Two C: eating more saturated fat is linked to a higher BMI (weight for height). (-265CC)",
    },
  },
  {
    rsid: "rs662799", gene: "APOA5 -1131T/C", about: "Triglyceride response to fat", evidence: "strong",
    plain: "APOA5 helps clear triglycerides, a type of fat that circulates in the blood after meals. The C version leads to less APOA5 and higher triglyceride levels, and higher triglycerides are in turn linked to heart disease risk.",
    takeaway: "If you carry C, it's worth looking at triglycerides on a routine cholesterol (lipid) test; they respond well to less sugar, refined carbs and alcohol, and more oily fish.",
    calls: {
      AA: "No C: typical triglyceride (blood fat) levels. (-1131TT)",
      AG: "One C: higher triglycerides (blood fats) on average. (-1131TC)",
      GG: "Two C: higher triglycerides (blood fats) on average. (-1131CC)",
    },
  },
  {
    rsid: "rs174537", gene: "FADS1", about: "Omega-3/6 conversion", evidence: "strong",
    plain: "FADS1 makes an enzyme that turns the omega-3 and omega-6 fats in plant foods (such as flax, walnuts and vegetable oils) into the longer forms the brain, eyes and heart use (such as EPA and DHA). The T version does this conversion less efficiently, so blood levels of those longer forms run lower.",
    takeaway: "If you're TT, getting EPA and DHA directly from oily fish (or algae oil if you don't eat fish) matters more than relying on plant sources.",
    calls: {
      GG: "Two copies of the efficient version: you convert plant omega-3 and omega-6 into the longer forms well.",
      GT: "One copy of each: in-between conversion.",
      TT: "Two copies of the less efficient version: lower conversion, so EPA and DHA straight from oily fish or algae oil matter more than plant omega-3 (ALA).",
    },
  },
  {
    rsid: "rs1799883", gene: "FABP2 Ala54Thr", about: "Fat absorption", evidence: "weak",
    plain: "FABP2 makes a protein in the gut lining that helps absorb fats from food. The 'Thr' version grips fats more tightly and has been linked in some studies to higher blood fats and poorer insulin response, but results are inconsistent.",
    takeaway: "Nothing to act on; evidence is weak.",
  },
  {
    rsid: "rs4988235", gene: "LCT/MCM6 -13910", about: "Lactase persistence", evidence: "strong",
    plain: "Babies make lactase, the enzyme that digests the sugar in milk, but in most of the world it switches off after childhood. This marker controls whether it stays on in adulthood, mainly in people of European descent; other populations have different 'stay on' variants this marker doesn't capture. Even without it, many people handle small amounts of dairy fine.",
    takeaway: "Your gut is the better guide: if dairy doesn't bother you, there's no reason to avoid it whatever this says.",
    calls: {
      AA: "Two copies of the 'stay on' version: you're very likely to digest milk sugar well as an adult. (lactase persistent)",
      AG: "One copy of the 'stay on' version, and one is enough: you're very likely to digest milk sugar as an adult. (lactase persistent)",
      GG: "No copies of the 'stay on' version: you're likely to be lactose intolerant as an adult. (lactase non-persistent)",
    },
  },

  // Lipids & heart
  {
    rsid: "rs429358", gene: "APOE (ε4 site)", about: "APOE type, read with rs7412", evidence: "strong",
    plain: "APOE makes a protein that carries cholesterol and other fats in the blood and brain. It comes in three common types, ε2, ε3 and ε4, worked out by reading this marker together with rs7412; the combined result is shown on the APOE card above. ε4 is linked to higher LDL ('bad') cholesterol and a higher risk of Alzheimer's disease.",
    takeaway: "Read the combined APOE type rather than this marker alone; if an ε4 result worries you, a GP or genetic counsellor can put it in context.",
  },
  {
    rsid: "rs7412", gene: "APOE (ε2 site)", about: "APOE type, read with rs429358", evidence: "strong",
    plain: "APOE makes a protein that carries cholesterol and other fats in the blood and brain. It comes in three common types, ε2, ε3 and ε4, worked out by reading this marker together with rs429358; the combined result is shown on the APOE card above. ε2 is linked to a lower risk of Alzheimer's disease but can raise some blood fats.",
    takeaway: "Read the combined APOE type rather than this marker alone.",
  },

  // Exercise
  {
    rsid: "rs1815739", gene: "ACTN3 R577X", about: "Fast-twitch muscle protein", evidence: "strong",
    plain: "ACTN3 makes alpha-actinin-3, a protein found only in fast-twitch muscle fibres, the ones used for sprinting and explosive power. About 18% of Europeans have two 'X' copies and make none of it; that's perfectly healthy, but it's rare among elite sprinters.",
    takeaway: "Nothing to act on; for anyone who isn't an elite athlete, training matters far more than this.",
    calls: {
      CC: "Two working copies: you make the full amount of this fast-twitch muscle protein, a power and sprint profile. (RR)",
      CT: "One working copy and one 'X' copy: a mixed profile. (RX)",
      TT: "Two 'X' copies: you make none of this protein, like about 18% of Europeans; a profile that leans towards endurance. (XX)",
    },
  },
  {
    rsid: "rs8192678", gene: "PPARGC1A Gly482Ser", about: "Mitochondrial response to training", evidence: "moderate",
    plain: "PPARGC1A (often called PGC-1α) is a master switch that tells muscle cells to build more mitochondria, the parts of a cell that produce energy, especially in response to endurance training. The 'Ser' version has been linked in some studies to smaller fitness gains from training, though results vary.",
    takeaway: "Nothing to act on; everyone gets fitter with training, and this marker explains only a small part of how much.",
    calls: {
      CC: "Two copies of the usual version, the most common result. (Gly/Gly)",
      CT: "One copy of the 'Ser' version. (Gly/Ser)",
      TT: "Two copies of the 'Ser' version: smaller gains from endurance training in some studies. (Ser/Ser)",
    },
  },
  {
    rsid: "rs1042713", gene: "ADRB2 Arg16Gly", about: "Adrenergic receptor; exercise response", evidence: "weak",
    plain: "ADRB2 makes the receptor that adrenaline acts on to relax the airways and open up blood vessels in muscles; it's also what asthma reliever inhalers such as salbutamol target. This marker has been studied for exercise performance and inhaler response, with mixed results.",
    takeaway: "Nothing to act on; it isn't routinely used to guide treatment, though you could mention it to a doctor or pharmacist if you're prescribed asthma inhalers.",
    calls: {
      AA: "Two copies of the 'Arg16' version. (Arg16/Arg16)",
      AG: "One copy of each version. (Arg16/Gly16)",
      GG: "Two copies of the 'Gly16' version. (Gly16/Gly16)",
    },
  },
  {
    rsid: "rs1042714", gene: "ADRB2 Gln27Glu", about: "Adrenergic receptor", evidence: "weak",
    plain: "A second marker in the same adrenaline-receptor gene as Arg16Gly (the receptor that relaxes the airways and is targeted by asthma inhalers). It has been studied for weight, blood pressure and exercise response, with mixed results.",
    takeaway: "Nothing to act on; evidence is weak.",
    calls: {
      CC: "Two copies of the 'Gln27' version. (Gln27/Gln27)",
      CG: "One copy of each version. (Gln27/Glu27)",
      GG: "Two copies of the 'Glu27' version. (Glu27/Glu27)",
    },
  },
  {
    rsid: "rs1042522", gene: "TP53 Arg72Pro", about: "Cell cycle / stress response", evidence: "weak",
    plain: "TP53 makes p53, often called the 'guardian of the genome': a protein that pauses or shuts down cells whose DNA is damaged, which helps prevent cancer. This common variant slightly changes how p53 behaves and has been studied for cancer risk and ageing, with mixed, mostly small findings. It is not one of the rare TP53 faults that cause inherited cancer syndromes.",
    takeaway: "Nothing to act on; this is a common variant with small, uncertain effects.",
    calls: {
      CC: "Most likely two copies of the 'Arg' version, the most common result in Europeans. (likely Arg/Arg)",
      CG: "One copy of each version. (Arg/Pro)",
      GG: "Most likely two copies of the 'Pro' version. (likely Pro/Pro)",
    },
  },

  // Alcohol & nicotine
  {
    rsid: "rs671", gene: "ALDH2*2", about: "Alcohol flush reaction", evidence: "strong",
    plain: "When you drink, your body first turns alcohol into acetaldehyde, a toxic chemical that causes flushing, nausea and a racing heart; ALDH2 is the enzyme that clears it. The *2 version, common in East Asian people, barely works, so acetaldehyde builds up and causes the 'alcohol flush'. Because acetaldehyde damages DNA, carriers who drink regularly have a much higher risk of oesophageal (food pipe) cancer.",
    takeaway: "If you carry *2 (AG or AA here), drinking less or not at all meaningfully lowers that cancer risk; also mention it to a doctor or pharmacist if you're prescribed GTN (nitroglycerin) for chest pain, as it may work less well for you.",
    calls: {
      GG: "Two working copies: acetaldehyde is cleared normally, so no alcohol flush. (normal ALDH2)",
      AG: "One copy of the non-working version: alcohol makes you flush, and drinking raises your risk of oesophageal (food pipe) cancer. (one *2)",
      AA: "Two copies of the non-working version: a strong flush, and alcohol is poorly tolerated. (two *2)",
    },
  },
  {
    rsid: "rs1229984", gene: "ADH1B Arg48His", about: "Alcohol metabolism", evidence: "strong",
    plain: "ADH1B makes the enzyme that does the first step in breaking down alcohol, turning it into acetaldehyde (the chemical behind flushing and some hangover symptoms). The 'His' version works much faster, so acetaldehyde builds up quickly and heavy drinking feels less pleasant. It's one of the most consistent genetic protections against alcohol dependence.",
    takeaway: "Nothing to act on.",
    calls: {
      CC: "Two copies of the usual version: typical speed, as in most Europeans. (Arg/Arg)",
      CT: "One copy of the fast version: alcohol is turned into acetaldehyde faster. (one His)",
      TT: "Two copies of the fast version: fast conversion, which protects against heavy drinking. (His/His)",
    },
  },
  {
    rsid: "rs1051730", gene: "CHRNA3", about: "Nicotine dependence", evidence: "strong",
    plain: "CHRNA3 and its neighbour CHRNA5 make parts of the nicotine receptor, the docking point in the brain that nicotine acts on. The risk version is linked to smoking more cigarettes a day, finding it harder to quit and, through that, a higher lung cancer risk among smokers. It makes no difference if you don't smoke.",
    takeaway: "Only matters if you smoke; if you do, quitting with support (such as nicotine replacement or a stop-smoking service) works for people with these variants too.",
    calls: {
      GG: "No risk copies: typical.",
      AG: "One risk copy: if you smoke, you're likely to smoke more heavily and find it harder to quit.",
      AA: "Two risk copies: if you smoke, heavier use and difficulty quitting are more likely.",
    },
  },
  {
    rsid: "rs16969968", gene: "CHRNA5 D398N", about: "Nicotine dependence", evidence: "strong",
    plain: "CHRNA5 makes part of the brain's nicotine receptor. This change, usually inherited together with the CHRNA3 marker, makes the receptor respond less to nicotine, which may mean more is needed to feel the effect. It's linked to heavier smoking and higher lung cancer risk in smokers.",
    takeaway: "Only matters if you smoke; read it together with CHRNA3.",
    calls: {
      GG: "No risk copies: typical.",
      AG: "One risk copy (usually inherited together with the CHRNA3 marker).",
      AA: "Two risk copies: if you smoke, heavier use and difficulty quitting are more likely.",
    },
  },

  // Iron
  {
    rsid: "rs1800562", gene: "HFE C282Y", about: "Haemochromatosis / iron overload", evidence: "strong",
    plain: "HFE helps control how much iron your gut absorbs from food. The C282Y change switches that control off, so iron keeps being absorbed even when the body has plenty; with two copies, iron can slowly build up in the liver, heart and joints over many years (haemochromatosis). It's one of the most common inherited conditions in people of northern European, especially Irish, descent, and it's easy to treat when caught early.",
    takeaway: "If you're AA here (C282Y on both copies), ask your GP for ferritin and transferrin saturation blood tests; one copy alone rarely causes problems.",
    calls: {
      GG: "No copies of C282Y: you're not at genetic risk of the common form of haemochromatosis.",
      AG: "One copy of C282Y (a carrier): this usually doesn't cause iron overload.",
      AA: "Two copies of C282Y: this is the main genotype behind haemochromatosis (iron overload), though not everyone with it develops problems. Ask for ferritin and transferrin saturation blood tests. (C282Y homozygous)",
    },
  },
  {
    rsid: "rs1799945", gene: "HFE H63D", about: "Iron handling", evidence: "strong",
    plain: "A second, milder change in the same iron-control gene (HFE) as C282Y. On its own it has only a small effect on iron levels; it matters a little more in someone who also carries one copy of C282Y.",
    takeaway: "Usually nothing to act on; if you also carry one C282Y copy, a routine ferritin test is a reasonable check.",
    calls: {
      CC: "No copies of H63D.",
      CG: "One copy of H63D (a carrier): a minor effect.",
      GG: "Two copies of H63D: a mild effect on iron levels. (H63D homozygous)",
    },
  },

  // Vitamin D
  {
    rsid: "rs2282679", gene: "GC", about: "Vitamin D binding protein; blood vitamin D", evidence: "strong",
    plain: "GC makes vitamin D binding protein, which carries vitamin D around in the blood. The G version is one of the most reliable genetic links to vitamin D: people with it tend to have lower readings on a standard vitamin D blood test.",
    takeaway: "If you carry G, it's one more reason to follow the standard UK advice of a daily 10 microgram vitamin D supplement in autumn and winter; a blood test shows where you actually stand.",
    calls: {
      TT: "No G: typical vitamin D levels.",
      GT: "One G: somewhat lower blood vitamin D on average. (25-OH vitamin D)",
      GG: "Two G: lower blood vitamin D on average. (25-OH vitamin D)",
    },
  },
  {
    rsid: "rs731236", gene: "VDR TaqI", about: "Vitamin D receptor", evidence: "weak",
    plain: "VDR makes the vitamin D receptor, the docking point that lets cells respond to vitamin D. This is one of several common VDR markers studied for bone density, immunity and other outcomes; large studies have found little or no consistent effect.",
    takeaway: "Nothing to act on; evidence is weak.",
  },
  {
    rsid: "rs1544410", gene: "VDR BsmI", about: "Vitamin D receptor", evidence: "weak",
    plain: "VDR makes the vitamin D receptor, the docking point that lets cells respond to vitamin D. This is one of several common VDR markers studied for bone density, immunity and other outcomes; large studies have found little or no consistent effect.",
    takeaway: "Nothing to act on; evidence is weak.",
  },
  {
    rsid: "rs2228570", gene: "VDR FokI", about: "Vitamin D receptor", evidence: "weak",
    plain: "VDR makes the vitamin D receptor, the docking point that lets cells respond to vitamin D. This marker changes the length of the receptor protein slightly; it has been studied for bone density and immunity, but large studies have found little consistent effect.",
    takeaway: "Nothing to act on; evidence is weak.",
  },

  // Inflammation & antioxidants
  {
    rsid: "rs1800629", gene: "TNF -308G/A", about: "Inflammatory response", evidence: "moderate",
    plain: "TNF-alpha is a signalling protein that switches on inflammation, part of the immune system's response to infection and injury. The A version of this marker has been linked to making more TNF-alpha, and has been studied in many inflammatory and infectious diseases with mixed results.",
    takeaway: "Nothing to act on; effects are small and inconsistent across studies.",
    calls: {
      GG: "Two copies of the usual version: typical production of TNF-alpha (an inflammation signal).",
      AG: "One A: higher TNF-alpha (inflammation signal) production.",
      AA: "Two A: two copies of the version linked to higher TNF-alpha production.",
    },
  },
  {
    rsid: "rs1800795", gene: "IL-6 -174G/C", about: "Inflammatory response", evidence: "weak",
    plain: "IL-6 is a signalling protein that drives inflammation and fever, and also rises during exercise. This marker may affect how much IL-6 is made, and has been studied for heart disease and other conditions, but findings are inconsistent.",
    takeaway: "Nothing to act on; evidence is weak.",
  },
  {
    rsid: "rs1695", gene: "GSTP1 Ile105Val", about: "Detox / oxidative stress", evidence: "moderate",
    plain: "GSTP1 makes a clean-up enzyme that attaches a chemical tag (glutathione) to certain toxins and drugs so the body can flush them out. The 'Val' version works less well on some of these chemicals and better on others, and its effect on everyday health is unclear.",
    takeaway: "Nothing to act on; real-world effects are uncertain.",
    calls: {
      AA: "Two copies of the usual version. (Ile/Ile)",
      AG: "One copy of the 'Val' version. (Ile/Val)",
      GG: "Two copies of the 'Val' version: lower enzyme activity on some chemicals. (Val/Val)",
    },
  },
  {
    rsid: "rs4880", gene: "SOD2 Val16Ala", about: "Mitochondrial antioxidant", evidence: "weak",
    plain: "SOD2 makes an antioxidant enzyme that works inside mitochondria, the cell's energy factories, mopping up harmful by-products of burning fuel. This marker changes how easily the enzyme gets into the mitochondria, but links to health outcomes are inconsistent.",
    takeaway: "Nothing to act on; evidence is weak.",
    calls: {
      AA: "Two copies of the 'Val' version. (Val/Val)",
      AG: "One copy of each version. (Val/Ala)",
      GG: "Two copies of the 'Ala' version. (Ala/Ala)",
    },
  },
  {
    rsid: "rs1050450", gene: "GPX1 Pro198Leu", about: "Antioxidant (selenium)", evidence: "weak",
    plain: "GPX1 makes glutathione peroxidase, an antioxidant enzyme that needs the mineral selenium to work. The 'Leu' version is linked in some studies to slightly lower enzyme activity, but its effect on health is unclear.",
    takeaway: "Nothing to act on; it's not a reason to take selenium supplements, which can be harmful in excess.",
  },
  {
    rsid: "rs10004195", gene: "TLR1/6/10", about: "Immune response", evidence: "moderate",
    plain: "TLR1, TLR6 and TLR10 are sensors that immune cells use to recognise bacteria. In a large study, the A version at this marker was linked to lower rates of infection with H. pylori, a common stomach bacterium that can cause ulcers.",
    takeaway: "Nothing to act on.",
    calls: {
      TT: "No copies of the A version, which is linked to lower rates of H. pylori (a stomach bacterium) infection.",
      AT: "One copy of the A version, which is linked to lower rates of H. pylori (a stomach bacterium) infection.",
      AA: "Two copies of the A version, which is linked to lower rates of H. pylori (a stomach bacterium) infection.",
    },
  },
  {
    rsid: "rs2802292", gene: "FOXO3", about: "Longevity-associated", evidence: "moderate",
    plain: "FOXO3 is involved in how cells respond to stress, repair themselves and manage energy. The G version has been found more often in people who live into their late 90s and beyond, in several populations, though each copy shifts the odds only slightly and lifestyle matters far more.",
    takeaway: "Nothing to act on; it's a small nudge in the odds, not a forecast.",
    calls: {
      TT: "No copies of the G version linked to living longer.",
      GT: "One copy of the G version linked to living longer.",
      GG: "Two copies of the G version linked to living longer.",
    },
  },

  // Traits
  {
    rsid: "rs12913832", gene: "HERC2/OCA2", about: "Eye colour", evidence: "strong",
    plain: "This marker sits in a genetic switch that controls a nearby pigment gene (OCA2), which sets how much brown pigment the iris makes. It's the single biggest genetic factor behind blue versus brown eyes in Europeans, though other genes fine-tune the exact shade.",
    takeaway: "Nothing to act on; it's just a trait.",
    calls: {
      AA: "Two copies of the 'more pigment' version: brown eyes likely.",
      AG: "One copy of each: usually brown, hazel or green eyes.",
      GG: "Two copies of the 'less pigment' version: blue eyes likely.",
    },
  },
  {
    rsid: "rs17822931", gene: "ABCC11", about: "Earwax type / body odour", evidence: "strong",
    plain: "ABCC11 makes a pump that moves certain substances into sweat and earwax. The T version switches the pump off, giving dry, flaky earwax and much less underarm odour, because skin bacteria have less to feed on. It's very common in East Asian people and uncommon in Europeans.",
    takeaway: "Nothing to act on; it's just a trait.",
    calls: {
      CC: "Two working copies: wet earwax and typical underarm odour.",
      CT: "One working copy is enough: wet earwax.",
      TT: "Two 'off' copies: dry earwax and little underarm odour.",
    },
  },
  {
    rsid: "rs713598", gene: "TAS2R38 P49A", about: "Bitter taste (PTC)", evidence: "moderate",
    plain: "TAS2R38 makes a bitter-taste receptor on the tongue that picks up compounds in broccoli, Brussels sprouts, cabbage and similar greens (and a lab chemical called PTC). Whether you find these bitter depends largely on which versions of this gene you have.",
    takeaway: "Nothing to act on; if bitter greens put you off, cooking them with a little fat, salt or something sweet can help.",
    calls: {
      GG: "Two copies of the 'taster' version: bitter greens are likely to taste stronger to you.",
      CG: "One copy of the 'taster' version.",
      CC: "No copies of the 'taster' version: likely a non-taster.",
    },
  },
  {
    rsid: "rs1726866", gene: "TAS2R38 A262V", about: "Bitter taste", evidence: "moderate",
    plain: "A second marker in the same bitter-taste gene (TAS2R38) as P49A. It is usually inherited together with that marker, so the P49A card gives the clearer picture of whether you're a 'taster'.",
    takeaway: "Nothing extra to act on; read the TAS2R38 P49A card.",
  },
];

const BY_ID = new Map(CURATED_SNPS.map((s) => [s.rsid, s]));

export interface ParsedSnp {
  rsid: string;
  gene: string;
  about: string;
  genotype: string;
  chromosome: string;
  position: string;
}

const norm = (g: string) => g.toUpperCase().split("").sort().join("");

/** "AG — COMT Val158Met: …" text stored on the fact. */
export function describe(rsid: string, genotype: string): string {
  const def = BY_ID.get(rsid);
  if (!def) return genotype;
  const call = def.calls?.[norm(genotype)];
  const ev = def.evidence ? ` [evidence: ${def.evidence}]` : "";
  return `${genotype} — ${def.gene}: ${def.about}.${call ? ` ${call}` : ""}${ev}`;
}

/** Reads the genotype back out of a stored fact value ("AG — …"). */
export function genotypeFromValue(value: string): string | null {
  const m = /^([ACGTDI]{1,2})\b/.exec(value.trim());
  return m ? m[1] : null;
}

/** APOE type from the two sites (23andMe orientation). */
export function apoeType(rs429358: string | null, rs7412: string | null): string | null {
  if (!rs429358 || !rs7412) return null;
  const a = norm(rs429358);
  const b = norm(rs7412);
  // Keep a single " — " per entry: the UI splits the label from the reading on it.
  const table: Record<string, string> = {
    "TT|CC": "ε3/ε3 — The most common type. Your APOE-related risk of heart disease and Alzheimer's is average.",
    "TT|CT": "ε2/ε3 — One copy of ε2. Linked to a slightly lower than average risk of Alzheimer's disease; it can push up triglycerides (a type of blood fat).",
    "TT|TT": "ε2/ε2 — A rare type. Linked to type III hyperlipoproteinaemia, a condition where certain fats build up in the blood.",
    "CT|CC": "ε3/ε4 — One copy of ε4. Linked to higher LDL ('bad') cholesterol and a higher than average risk of Alzheimer's disease; most people with this type do not develop it.",
    "CT|CT": "ε2/ε4 (most likely) — One copy each of ε2 and ε4, whose effects partly cancel each other out.",
    "CC|CC": "ε4/ε4 — Two copies of ε4. A substantially raised risk of Alzheimer's disease; worth discussing with a doctor or genetic counsellor.",
  };
  return table[`${a}|${b}`] ?? null;
}

/**
 * Parses a 23andMe raw text file ("rsid\tchromosome\tposition\tgenotype") and
 * returns only the curated markers. Runs in the browser; nothing is uploaded
 * except the rows you choose to keep.
 */
export function parse23andMe(text: string): { found: ParsedSnp[]; totalLines: number; noCalls: string[]; build: string | null } {
  const found: ParsedSnp[] = [];
  const noCalls: string[] = [];
  let total = 0;
  let build: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    if (line.startsWith("#")) {
      const m = /build (\d+)|GRCh(\d+)/i.exec(line);
      if (m && !build) build = m[1] ?? m[2];
      continue;
    }
    total++;
    const [rsid, chromosome, position, genotype] = line.split(/\s+/);
    const meta = BY_ID.get(rsid);
    if (!meta) continue;
    if (!genotype || genotype === "--") {
      noCalls.push(rsid);
      continue;
    }
    found.push({ rsid, gene: meta.gene, about: meta.about, genotype, chromosome, position });
  }
  return { found, totalLines: total, noCalls, build };
}

export type Evidence = "strong" | "moderate" | "weak";
export const EVIDENCE_ORDER: Evidence[] = ["strong", "moderate", "weak"];

/** Structured reading for display, straight from the marker table. */
export function snpParts(
  rsid: string,
  genotype: string,
): { gene: string; about: string; call: string | null; plain: string; takeaway: string | undefined; evidence: Evidence; known: boolean } {
  const def = BY_ID.get(rsid);
  if (!def) return { gene: "", about: "", call: null, plain: "", takeaway: undefined, evidence: "weak", known: false };
  return {
    gene: def.gene,
    about: def.about,
    call: def.calls?.[norm(genotype)] ?? null,
    plain: def.plain,
    takeaway: def.takeaway,
    evidence: def.evidence ?? "weak",
    known: true,
  };
}
