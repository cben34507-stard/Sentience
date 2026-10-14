/**
 * A curated set of well-studied SNPs worth pulling out of a 23andMe raw export.
 * The description is what the marker is commonly associated with — treat it as
 * a prompt for discussion, not a diagnosis.
 */
export const CURATED_SNPS: { rsid: string; gene: string; about: string }[] = [
  { rsid: "rs4680", gene: "COMT", about: "Dopamine clearance; Val/Met 'warrior/worrier', stress & focus" },
  { rsid: "rs1801133", gene: "MTHFR C677T", about: "Folate metabolism; B-vitamin handling" },
  { rsid: "rs1801131", gene: "MTHFR A1298C", about: "Folate metabolism" },
  { rsid: "rs762551", gene: "CYP1A2", about: "Caffeine metabolism speed" },
  { rsid: "rs5751876", gene: "ADORA2A", about: "Caffeine-induced anxiety / sleep disruption" },
  { rsid: "rs2472297", gene: "CYP1A1/2 region", about: "Caffeine consumption tendency" },
  { rsid: "rs6265", gene: "BDNF", about: "Neuroplasticity, mood, exercise response" },
  { rsid: "rs1800497", gene: "DRD2/ANKK1 Taq1A", about: "Dopamine receptor density; reward sensitivity" },
  { rsid: "rs53576", gene: "OXTR", about: "Oxytocin receptor; social sensitivity" },
  { rsid: "rs6295", gene: "HTR1A", about: "Serotonin receptor; mood/anxiety" },
  { rsid: "rs25531", gene: "SLC6A4 (5-HTTLPR region)", about: "Serotonin transporter" },
  { rsid: "rs324420", gene: "FAAH", about: "Anandamide breakdown; anxiety/pain" },
  { rsid: "rs1799971", gene: "OPRM1", about: "Opioid receptor; pain & reward" },
  { rsid: "rs429358", gene: "APOE", about: "APOE ε4 marker (with rs7412); lipid & cognitive risk" },
  { rsid: "rs7412", gene: "APOE", about: "APOE ε2 marker (with rs429358)" },
  { rsid: "rs1815739", gene: "ACTN3", about: "Fast-twitch muscle 'sprinter' variant" },
  { rsid: "rs8192678", gene: "PPARGC1A", about: "Endurance/mitochondrial response to training" },
  { rsid: "rs4988235", gene: "LCT/MCM6", about: "Lactase persistence (lactose tolerance)" },
  { rsid: "rs9939609", gene: "FTO", about: "Appetite & obesity risk" },
  { rsid: "rs7903146", gene: "TCF7L2", about: "Type 2 diabetes risk" },
  { rsid: "rs174537", gene: "FADS1", about: "Omega-3/6 conversion" },
  { rsid: "rs1051730", gene: "CHRNA3", about: "Nicotine dependence" },
  { rsid: "rs1229984", gene: "ADH1B", about: "Alcohol metabolism" },
  { rsid: "rs671", gene: "ALDH2", about: "Alcohol flush reaction" },
  { rsid: "rs731236", gene: "VDR TaqI", about: "Vitamin D receptor" },
  { rsid: "rs1544410", gene: "VDR BsmI", about: "Vitamin D receptor" },
  { rsid: "rs2282679", gene: "GC", about: "Vitamin D binding protein; serum vitamin D levels" },
  { rsid: "rs1800629", gene: "TNF-α", about: "Inflammatory response" },
  { rsid: "rs1800795", gene: "IL-6", about: "Inflammatory response" },
  { rsid: "rs1800562", gene: "HFE C282Y", about: "Hemochromatosis / iron overload" },
  { rsid: "rs1799945", gene: "HFE H63D", about: "Iron handling" },
  { rsid: "rs12913832", gene: "HERC2/OCA2", about: "Eye colour" },
  { rsid: "rs1801260", gene: "CLOCK", about: "Circadian rhythm / chronotype" },
  { rsid: "rs57875989", gene: "PER3", about: "Chronotype, sleep need" },
  { rsid: "rs73598374", gene: "ADA", about: "Deep sleep / sleep pressure" },
  { rsid: "rs10830963", gene: "MTNR1B", about: "Melatonin receptor; fasting glucose" },
  { rsid: "rs1042522", gene: "TP53", about: "Cell cycle / stress response" },
  { rsid: "rs16969968", gene: "CHRNA5", about: "Nicotine dependence" },
  { rsid: "rs17822931", gene: "ABCC11", about: "Earwax type / body odour" },
  { rsid: "rs713598", gene: "TAS2R38", about: "Bitter taste perception (PTC)" },
  { rsid: "rs1726866", gene: "TAS2R38", about: "Bitter taste perception" },
  { rsid: "rs4994", gene: "ADRB3", about: "Fat metabolism / weight regain" },
  { rsid: "rs1042713", gene: "ADRB2", about: "Adrenergic receptor; exercise response" },
  { rsid: "rs1042714", gene: "ADRB2", about: "Adrenergic receptor" },
  { rsid: "rs1695", gene: "GSTP1", about: "Detox / oxidative stress" },
  { rsid: "rs4880", gene: "SOD2", about: "Mitochondrial antioxidant" },
  { rsid: "rs1050450", gene: "GPX1", about: "Antioxidant (selenium)" },
  { rsid: "rs602662", gene: "FUT2", about: "Secretor status; B12 absorption, gut microbiome" },
  { rsid: "rs601338", gene: "FUT2", about: "Secretor status" },
  { rsid: "rs1801282", gene: "PPARG", about: "Insulin sensitivity" },
  { rsid: "rs5082", gene: "APOA2", about: "Saturated fat response" },
  { rsid: "rs662799", gene: "APOA5", about: "Triglyceride response to fat" },
  { rsid: "rs1799883", gene: "FABP2", about: "Fat absorption" },
  { rsid: "rs2228570", gene: "VDR FokI", about: "Vitamin D receptor" },
  { rsid: "rs6323", gene: "MAOA", about: "Monoamine breakdown; stress response" },
  { rsid: "rs1137101", gene: "LEPR", about: "Leptin receptor; satiety" },
  { rsid: "rs3813929", gene: "HTR2C", about: "Serotonin receptor; appetite / antipsychotic weight gain" },
  { rsid: "rs1360780", gene: "FKBP5", about: "Cortisol feedback; stress resilience" },
  { rsid: "rs10004195", gene: "TLR1 region", about: "Immune response" },
  { rsid: "rs2802292", gene: "FOXO3", about: "Longevity-associated" },
];

export interface ParsedSnp {
  rsid: string;
  gene: string;
  about: string;
  genotype: string;
  chromosome: string;
  position: string;
}

/**
 * Parses a 23andMe raw text file ("rsid\tchromosome\tposition\tgenotype") and
 * returns only the curated markers. Runs in the browser; nothing is uploaded
 * except the handful of rows you choose to keep.
 */
export function parse23andMe(text: string): { found: ParsedSnp[]; totalLines: number } {
  const want = new Map(CURATED_SNPS.map((s) => [s.rsid, s]));
  const found: ParsedSnp[] = [];
  let total = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    total++;
    const [rsid, chromosome, position, genotype] = line.split(/\s+/);
    const meta = want.get(rsid);
    if (meta && genotype && genotype !== "--") found.push({ ...meta, genotype, chromosome, position });
  }
  return { found, totalLines: total };
}
