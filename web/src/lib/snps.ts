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
  about: string;
  /** Raw-file genotype (letters sorted) → plain reading. */
  calls?: Record<string, string>;
  /** Marker sits on the X chromosome: one letter is expected in males. */
  xLinked?: boolean;
  evidence?: "strong" | "moderate" | "weak";
}

export const CURATED_SNPS: SnpDef[] = [
  // Methylation / B vitamins
  { rsid: "rs1801133", gene: "MTHFR C677T", about: "Folate metabolism", evidence: "strong",
    calls: { GG: "677CC: typical enzyme activity.", AG: "677CT: one copy; enzyme activity mildly reduced (~65%).", AA: "677TT: activity ~30%; can raise homocysteine when folate is low." } },
  { rsid: "rs1801131", gene: "MTHFR A1298C", about: "Folate metabolism", evidence: "moderate",
    calls: { TT: "1298AA: typical.", GT: "1298AC: one copy; small effect.", GG: "1298CC: two copies; modestly reduced activity. On its own (with 677CC) homocysteine is usually normal." } },
  { rsid: "rs602662", gene: "FUT2", about: "B12 levels, gut microbiome", evidence: "moderate",
    calls: { GG: "Usually inherited together with rs601338; read secretor status there.", AG: "Usually inherited together with rs601338; read secretor status there.", AA: "Usually inherited together with rs601338; read secretor status there." } },
  { rsid: "rs601338", gene: "FUT2 W143X", about: "Secretor status", evidence: "strong",
    calls: { GG: "Secretor.", AG: "Secretor (carrier of non-secretor allele).", AA: "Non-secretor (~20% of Europeans): no blood-group antigens in saliva/gut; higher B12 on average; resistant to common norovirus strains." } },

  // Caffeine
  { rsid: "rs762551", gene: "CYP1A2", about: "Caffeine metabolism speed", evidence: "strong",
    calls: { AA: "*1F/*1F: fast, inducible caffeine metaboliser.", AC: "Slower metaboliser (one C).", CC: "Slow metaboliser; caffeine lingers longer." } },
  { rsid: "rs5751876", gene: "ADORA2A", about: "Caffeine-induced anxiety / sleep disruption", evidence: "moderate",
    calls: { CC: "Less prone to caffeine-induced anxiety.", CT: "Intermediate.", TT: "More sensitive to caffeine anxiety and sleep disruption." } },
  { rsid: "rs2472297", gene: "CYP1A1/2 region", about: "Caffeine consumption tendency", evidence: "strong",
    calls: { CC: "Typical intake tendency.", CT: "One T: tends to drink slightly more caffeine.", TT: "Two T: tends to drink more caffeine." } },

  // Brain & mood
  { rsid: "rs4680", gene: "COMT Val158Met", about: "Dopamine clearance in the prefrontal cortex", evidence: "strong",
    calls: { GG: "Val/Val: faster dopamine clearance ('warrior').", AG: "Val/Met: intermediate.", AA: "Met/Met: slower clearance ('worrier'); better working memory at rest, more stress-sensitive." } },
  { rsid: "rs6265", gene: "BDNF Val66Met", about: "Neuroplasticity, mood, exercise response", evidence: "strong",
    calls: { CC: "Val/Val: typical activity-dependent BDNF release.", CT: "Val/Met: somewhat reduced release.", TT: "Met/Met: reduced release." } },
  { rsid: "rs1800497", gene: "DRD2/ANKK1 Taq1A", about: "Dopamine D2 receptor density", evidence: "moderate",
    calls: { GG: "A2/A2: typical receptor density.", AG: "A1/A2: one A1; lower D2 density in some studies (reward-seeking).", AA: "A1/A1: lower D2 density." } },
  { rsid: "rs53576", gene: "OXTR", about: "Oxytocin receptor; social sensitivity", evidence: "weak",
    calls: { GG: "GG: linked to higher empathy in some studies.", AG: "AG: intermediate.", AA: "AA: evidence is mixed." } },
  { rsid: "rs6295", gene: "HTR1A C-1019G", about: "Serotonin receptor; mood/anxiety", evidence: "weak",
    calls: { CG: "Heterozygous; evidence for mood effects is mixed.", CC: "Homozygous; evidence for mood effects is mixed.", GG: "Homozygous; evidence for mood effects is mixed." } },
  { rsid: "rs6323", gene: "MAOA", about: "Monoamine breakdown", xLinked: true, evidence: "weak" },
  { rsid: "rs324420", gene: "FAAH C385A", about: "Anandamide breakdown; anxiety/pain", evidence: "moderate",
    calls: { CC: "Pro/Pro: typical FAAH.", AC: "One A: less FAAH, slightly higher anandamide.", AA: "Thr/Thr: lower FAAH; linked to lower anxiety." } },
  { rsid: "rs1799971", gene: "OPRM1 A118G", about: "Opioid receptor; pain & reward", evidence: "moderate",
    calls: { AA: "Asn/Asn: typical.", AG: "One G (Asp40): may need more opioid pain relief; stronger alcohol reward in some studies.", GG: "Two G." } },
  { rsid: "rs1360780", gene: "FKBP5", about: "Cortisol feedback; stress resilience", evidence: "moderate",
    calls: { CC: "Typical stress-hormone recovery.", CT: "One T.", TT: "Two T: stronger, longer cortisol response, mainly after early-life stress." } },
  { rsid: "rs3813929", gene: "HTR2C -759C/T", about: "Serotonin receptor; appetite / antipsychotic weight gain", xLinked: true, evidence: "moderate",
    calls: { C: "C (one copy, X chromosome): typical.", T: "T: less weight gain on some antipsychotics.", CC: "Typical.", CT: "One T.", TT: "Two T." } },

  // Sleep & circadian
  { rsid: "rs1801260", gene: "CLOCK 3111T/C", about: "Circadian rhythm / chronotype", evidence: "weak",
    calls: { AA: "3111TT: typical.", AG: "One 3111C: linked to later chronotype in some studies.", GG: "Two 3111C: later chronotype in some studies." } },
  { rsid: "rs73598374", gene: "ADA G22A", about: "Deep sleep / sleep pressure", evidence: "moderate",
    calls: { CC: "Typical adenosine breakdown.", CT: "One T: more deep sleep, more affected by sleep loss.", TT: "Two T." } },
  { rsid: "rs10830963", gene: "MTNR1B", about: "Melatonin receptor; fasting glucose", evidence: "strong",
    calls: { CC: "Typical.", CG: "One G: slightly higher fasting glucose; late-evening eating may hit glucose tolerance harder.", GG: "Two G: as above, stronger." } },

  // Metabolism & weight
  { rsid: "rs9939609", gene: "FTO", about: "Appetite & obesity risk", evidence: "strong",
    calls: { TT: "No risk allele.", AT: "One A: ~1 kg heavier on average; slightly more appetite. Exercise blunts the effect.", AA: "Two A: ~3 kg heavier on average." } },
  { rsid: "rs7903146", gene: "TCF7L2", about: "Type 2 diabetes risk", evidence: "strong",
    calls: { CC: "Typical risk.", CT: "One T: ~1.4x relative risk of type 2 diabetes.", TT: "Two T: roughly 1.8–2x relative risk of type 2 diabetes. Weight, activity and diet still dominate; worth keeping HbA1c checked." } },
  { rsid: "rs1801282", gene: "PPARG Pro12Ala", about: "Insulin sensitivity", evidence: "strong",
    calls: { CC: "Pro/Pro: most common.", CG: "Pro/Ala: Ala is modestly protective against type 2 diabetes.", GG: "Ala/Ala." } },
  { rsid: "rs1137101", gene: "LEPR Gln223Arg", about: "Leptin receptor; satiety", evidence: "weak",
    calls: { AA: "Gln/Gln.", AG: "Gln/Arg.", GG: "Arg/Arg: weak, inconsistent links to appetite." } },
  { rsid: "rs4994", gene: "ADRB3 Trp64Arg", about: "Fat metabolism / weight regain", evidence: "weak",
    calls: { AA: "Trp/Trp: most common.", AG: "Trp/Arg.", GG: "Arg/Arg." } },
  { rsid: "rs5082", gene: "APOA2 -265T/C", about: "Saturated fat response", evidence: "moderate",
    calls: { AA: "TT.", AG: "TC: not the sensitive group.", GG: "CC: higher saturated-fat intake linked to higher BMI." } },
  { rsid: "rs662799", gene: "APOA5 -1131T/C", about: "Triglyceride response to fat", evidence: "strong",
    calls: { AA: "-1131TT: typical triglycerides.", AG: "One C: higher triglycerides.", GG: "Two C: higher triglycerides." } },
  { rsid: "rs174537", gene: "FADS1", about: "Omega-3/6 conversion", evidence: "strong",
    calls: { GG: "Efficient conversion of plant omega-3/6 to long-chain forms.", GT: "Intermediate conversion.", TT: "Lower conversion: direct EPA/DHA (oily fish, algae oil) matters more than plant ALA." } },
  { rsid: "rs1799883", gene: "FABP2 Ala54Thr", about: "Fat absorption", evidence: "weak" },
  { rsid: "rs4988235", gene: "LCT/MCM6 -13910", about: "Lactase persistence", evidence: "strong",
    calls: { AA: "Lactase persistent: very likely lactose tolerant as an adult.", AG: "Lactase persistent (one copy is enough).", GG: "Likely lactose intolerant as an adult." } },

  // Lipids & heart
  { rsid: "rs429358", gene: "APOE (ε4 site)", about: "APOE type, read with rs7412", evidence: "strong" },
  { rsid: "rs7412", gene: "APOE (ε2 site)", about: "APOE type, read with rs429358", evidence: "strong" },

  // Exercise
  { rsid: "rs1815739", gene: "ACTN3 R577X", about: "Fast-twitch muscle protein", evidence: "strong",
    calls: { CC: "RR: full α-actinin-3 in fast-twitch fibres (power/sprint profile).", CT: "RX: mixed.", TT: "XX: no α-actinin-3 (~18% of Europeans); endurance-leaning." } },
  { rsid: "rs8192678", gene: "PPARGC1A Gly482Ser", about: "Mitochondrial response to training", evidence: "moderate",
    calls: { CC: "Gly/Gly: most common.", CT: "Gly/Ser.", TT: "Ser/Ser: smaller endurance-training gains in some studies." } },
  { rsid: "rs1042713", gene: "ADRB2 Arg16Gly", about: "Adrenergic receptor; exercise response", evidence: "weak",
    calls: { AA: "Arg16/Arg16.", AG: "Arg16/Gly16.", GG: "Gly16/Gly16." } },
  { rsid: "rs1042714", gene: "ADRB2 Gln27Glu", about: "Adrenergic receptor", evidence: "weak",
    calls: { CC: "Gln27/Gln27.", CG: "Gln27/Glu27.", GG: "Glu27/Glu27." } },
  { rsid: "rs1042522", gene: "TP53 Arg72Pro", about: "Cell cycle / stress response", evidence: "weak",
    calls: { CC: "Likely Arg/Arg (most common in Europeans).", CG: "Arg/Pro.", GG: "Likely Pro/Pro." } },

  // Alcohol & nicotine
  { rsid: "rs671", gene: "ALDH2*2", about: "Alcohol flush reaction", evidence: "strong",
    calls: { GG: "Normal ALDH2: no flush.", AG: "One *2: alcohol flush; drinking raises oesophageal cancer risk.", AA: "Two *2: strong flush; alcohol poorly tolerated." } },
  { rsid: "rs1229984", gene: "ADH1B Arg48His", about: "Alcohol metabolism", evidence: "strong",
    calls: { CC: "Arg/Arg: typical (most Europeans).", CT: "One His: faster alcohol → acetaldehyde.", TT: "His/His: fast; protective against heavy drinking." } },
  { rsid: "rs1051730", gene: "CHRNA3", about: "Nicotine dependence", evidence: "strong",
    calls: { GG: "Typical.", AG: "One risk copy: if smoking, heavier use and harder to quit.", AA: "Two risk copies." } },
  { rsid: "rs16969968", gene: "CHRNA5 D398N", about: "Nicotine dependence", evidence: "strong",
    calls: { GG: "Typical.", AG: "One risk copy (pairs with CHRNA3 above).", AA: "Two risk copies." } },

  // Iron
  { rsid: "rs1800562", gene: "HFE C282Y", about: "Haemochromatosis / iron overload", evidence: "strong",
    calls: { GG: "No C282Y: not at genetic risk of the common form.", AG: "C282Y carrier: usually no iron overload.", AA: "C282Y homozygous: main haemochromatosis genotype; ask for ferritin/transferrin saturation." } },
  { rsid: "rs1799945", gene: "HFE H63D", about: "Iron handling", evidence: "strong",
    calls: { CC: "No H63D.", CG: "H63D carrier: minor effect.", GG: "H63D homozygous: mild effect." } },

  // Vitamin D
  { rsid: "rs2282679", gene: "GC", about: "Vitamin D binding protein; blood vitamin D", evidence: "strong",
    calls: { TT: "Typical vitamin D levels.", GT: "One G: somewhat lower 25-OH vitamin D on average.", GG: "Two G: lower 25-OH vitamin D on average." } },
  { rsid: "rs731236", gene: "VDR TaqI", about: "Vitamin D receptor", evidence: "weak" },
  { rsid: "rs1544410", gene: "VDR BsmI", about: "Vitamin D receptor", evidence: "weak" },
  { rsid: "rs2228570", gene: "VDR FokI", about: "Vitamin D receptor", evidence: "weak" },

  // Inflammation & antioxidants
  { rsid: "rs1800629", gene: "TNF -308G/A", about: "Inflammatory response", evidence: "moderate",
    calls: { GG: "Typical TNF-α production.", AG: "One A: higher TNF-α production.", AA: "Two A." } },
  { rsid: "rs1800795", gene: "IL-6 -174G/C", about: "Inflammatory response", evidence: "weak" },
  { rsid: "rs1695", gene: "GSTP1 Ile105Val", about: "Detox / oxidative stress", evidence: "moderate",
    calls: { AA: "Ile/Ile.", AG: "Ile/Val.", GG: "Val/Val: lower activity on some substrates." } },
  { rsid: "rs4880", gene: "SOD2 Val16Ala", about: "Mitochondrial antioxidant", evidence: "weak",
    calls: { AA: "Val/Val.", AG: "Val/Ala.", GG: "Ala/Ala." } },
  { rsid: "rs1050450", gene: "GPX1 Pro198Leu", about: "Antioxidant (selenium)", evidence: "weak" },
  { rsid: "rs10004195", gene: "TLR1/6/10", about: "Immune response", evidence: "moderate",
    calls: { TT: "No copies of the A allele linked to lower H. pylori infection rates.", AT: "One A.", AA: "Two A." } },
  { rsid: "rs2802292", gene: "FOXO3", about: "Longevity-associated", evidence: "moderate",
    calls: { TT: "No longevity-associated G.", GT: "One longevity-associated G.", GG: "Two longevity-associated G." } },

  // Traits
  { rsid: "rs12913832", gene: "HERC2/OCA2", about: "Eye colour", evidence: "strong",
    calls: { AA: "Brown eyes likely.", AG: "Usually brown, hazel or green.", GG: "Blue eyes likely." } },
  { rsid: "rs17822931", gene: "ABCC11", about: "Earwax type / body odour", evidence: "strong",
    calls: { CC: "Wet earwax; typical underarm odour.", CT: "Wet earwax.", TT: "Dry earwax; little underarm odour." } },
  { rsid: "rs713598", gene: "TAS2R38 P49A", about: "Bitter taste (PTC)", evidence: "moderate",
    calls: { GG: "Taster allele on both copies: bitter greens likely taste stronger.", CG: "One taster allele.", CC: "Likely non-taster." } },
  { rsid: "rs1726866", gene: "TAS2R38 A262V", about: "Bitter taste", evidence: "moderate" },
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
  const table: Record<string, string> = {
    "TT|CC": "ε3/ε3 — the most common type; average risk.",
    "TT|CT": "ε2/ε3 — slightly lower Alzheimer's risk; can raise triglycerides.",
    "TT|TT": "ε2/ε2 — rare; linked to type III hyperlipoproteinaemia.",
    "CT|CC": "ε3/ε4 — one ε4: higher LDL and Alzheimer's risk than average.",
    "CT|CT": "ε2/ε4 (most likely) — effects partly offset.",
    "CC|CC": "ε4/ε4 — two ε4: substantially raised Alzheimer's risk; worth discussing with a doctor.",
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
