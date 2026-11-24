import { PatientCase, BenchmarkRow, ResearchQuestion, TeamMember } from '../types';

export const PATIENT_CASES: PatientCase[] = [
  {
    id: 'ISLES2022_042',
    patientAge: 68,
    gender: 'M',
    onsetHours: 3.2,
    scanner: 'Siemens Skyra 3.0T',
    fieldStrength: '3.0T',
    domain: 'Target (Center 2 - Unlabeled)',
    totalVolumeMl: 14.62,
    lesionCount: 2,
    laterality: 'Right hemisphere',
    territory: 'Right middle cerebral artery (MCA) territory',
    keySlices: [18, 21, 24, 28],
    defaultSlice: 21,
    totalSlices: 48,
    dwiDescription: 'Hyperintense focal signal in right frontoparietal cortex and centrum semiovale (restricted diffusion).',
    adcDescription: 'Pronounced dark hypointense core with ADC values < 620 × 10⁻⁶ mm²/s confirming acute cytotoxicity.',
    flairDescription: 'Subtle perilesional hyperintensity with initial sulcal effacement (DWI-FLAIR positive mismatch window).'
  },
  {
    id: 'ISLES2022_108',
    patientAge: 74,
    gender: 'F',
    onsetHours: 2.5,
    scanner: 'GE Healthcare Signa 1.5T',
    fieldStrength: '1.5T',
    domain: 'Target (Center 2 - Unlabeled)',
    totalVolumeMl: 4.25,
    lesionCount: 4,
    laterality: 'Left hemisphere',
    territory: 'Left basal ganglia & subcortical white matter',
    keySlices: [16, 19, 22, 26],
    defaultSlice: 19,
    totalSlices: 48,
    dwiDescription: 'Multifocal punctate hyperintensities along internal capsule posterior limb and corona radiata.',
    adcDescription: 'Distinct regional hypointensities demonstrating acute lacunar ischemic event.',
    flairDescription: 'Background leucoaraiosis (Fazekas Grade 2) surrounding the acute restriction loci.'
  },
  {
    id: 'ISLES2022_215',
    patientAge: 61,
    gender: 'M',
    onsetHours: 4.1,
    scanner: 'Philips Achieva 3.0T',
    fieldStrength: '3.0T',
    domain: 'Target (Center 2 - Unlabeled)',
    totalVolumeMl: 38.80,
    lesionCount: 1,
    laterality: 'Right hemisphere',
    territory: 'Complete right M2 segment territorial infarct',
    keySlices: [20, 25, 29, 34],
    defaultSlice: 25,
    totalSlices: 48,
    dwiDescription: 'Broad wedge-shaped cortical and subcortical diffusion restriction across temporal-parietal operculum.',
    adcDescription: 'Severe signal drop throughout core region; ADC values down to 480 × 10⁻⁶ mm²/s.',
    flairDescription: 'Marked sulcal effacement and early hyperintensity indicating extensive territorial ischemic burden.'
  }
];

export const BENCHMARK_DATA: BenchmarkRow[] = [
  {
    condition: 'Source-only baseline',
    mechanism: 'nnU-Net trained on Center 1 (Dice + CE); direct zero-shot evaluation on Center 2',
    dscMean: 52.4,
    dscStd: 14.1,
    hd95Mean: 28.6,
    hd95Std: 9.8,
    avdMean: 12.8,
    avdStd: 5.4,
    f1Mean: 0.58,
    f1Std: 0.15,
  },
  {
    condition: 'Mean Teacher UDA',
    mechanism: 'Student-Teacher self-ensembling consistency regularization (ISLA protocol)',
    dscMean: 56.1,
    dscStd: 12.8,
    hd95Mean: 24.2,
    hd95Std: 8.7,
    avdMean: 10.4,
    avdStd: 4.9,
    f1Mean: 0.62,
    f1Std: 0.14,
  },
  {
    condition: 'Vanilla InfoNCE',
    mechanism: 'Contrastive alignment with random spatial crop pairing without atlas anchoring',
    dscMean: 55.7,
    dscStd: 13.2,
    hd95Mean: 25.1,
    hd95Std: 8.9,
    avdMean: 11.2,
    avdStd: 5.1,
    f1Mean: 0.60,
    f1Std: 0.14,
  },
  {
    condition: 'Atlas-guided pairing only',
    mechanism: 'MNI-152 space neighborhood sampling N(a_i, r) without boundary hard negatives',
    dscMean: 61.8,
    dscStd: 11.4,
    hd95Mean: 19.3,
    hd95Std: 7.2,
    avdMean: 8.1,
    avdStd: 3.8,
    f1Mean: 0.68,
    f1Std: 0.12,
  },
  {
    condition: 'Full UDA-StrokeSeg (ours)',
    mechanism: 'Atlas-anchored contrastive alignment + lesion-boundary hard-negative mining',
    dscMean: 66.4,
    dscStd: 10.2,
    hd95Mean: 14.7,
    hd95Std: 5.8,
    avdMean: 6.3,
    avdStd: 3.1,
    f1Mean: 0.74,
    f1Std: 0.10,
    isProposed: true,
  },
  {
    condition: 'Target-supervised oracle',
    mechanism: 'Full supervised training on labeled Center 2 target cases (upper reference bound)',
    dscMean: 71.2,
    dscStd: 9.4,
    hd95Mean: 11.5,
    hd95Std: 4.6,
    avdMean: 4.9,
    avdStd: 2.6,
    f1Mean: 0.79,
    f1Std: 0.09,
    isOracle: true,
  }
];

export const RESEARCH_QUESTIONS: ResearchQuestion[] = [
  {
    id: 'RQ1',
    title: 'Primary adaptation efficacy',
    question: 'Does atlas-anchored, hard-negative contrastive alignment significantly outperform unadapted source models, Mean Teacher, and vanilla contrastive baselines on held-out Center 2?',
    hypothesis: 'Atlas-anchored contrastive learning with boundary hard negatives captures domain-invariant anatomical features while preserving sharp lesion borders.',
    falsificationRule: 'Falsified if the proposed method fails to outperform the strongest unsupervised baseline on BOTH DSC and HD95 with a paired Wilcoxon signed-rank test p < 0.05.',
    resultStatus: 'Confirmed superior'
  },
  {
    id: 'RQ2',
    title: 'Atlas spatial prior validity',
    question: 'Does registering source and target volumes to a common MNI-152 atlas measurably increase semantic consistency of cross-domain positive pairs compared to random crops?',
    hypothesis: 'Mapping to a standardized atlas coordinate space acts as a reliable prior, reducing cross-domain semantic mismatch away from pathological margins.',
    falsificationRule: 'Falsified if atlas-constrained and random pairs demonstrate equivalent tissue agreement across evaluated boundary distance radii.',
    resultStatus: 'Supported'
  },
  {
    id: 'RQ3',
    title: 'Boundary hard-negative value',
    question: 'Does mining hard-negative voxels from healthy brain parenchyma immediately adjacent to source lesion borders yield statistically significant gains over atlas pairing alone?',
    hypothesis: 'Boundary hard negatives penalize false positive leakage into edema and perilesional hyperintensities on FLAIR/DWI.',
    falsificationRule: 'Falsified unless hard-negative mining improves mean DSC by ≥ 1.0% absolute and reduces median HD95 by ≥ 5% relative to atlas pairing alone.',
    resultStatus: 'Supported'
  }
];

export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Ngo Tieu Nghi',
    role: 'Lead AI Research Scientist',
    specialty: 'Domain adaptation & statistical modeling',
    email: 'nghi.ngotieu@hcmut.edu.vn',
    contributions: ['Formulation of atlas-guided contrastive objective', 'Cross-center multi-modal partitioning', 'Statistical validation & boundary optimization']
  },
  {
    name: 'Le Phuoc Minh Thien',
    role: 'Clinical Systems Architect',
    specialty: 'High-throughput inference & PACS pipeline',
    email: 'thien.let1n2442005@hcmut.edu.vn',
    contributions: ['FastAPI edge microservices & pipeline orchestration', 'Interactive clinical workstation implementation', 'Boundary hard-negative mining integration']
  },
  {
    name: 'Pham Thanh Bao Ngan',
    role: 'Biomedical Data Engineer',
    specialty: 'Neuroimaging preprocessing & volumetry',
    email: 'ngan.pham11@hcmut.edu.vn',
    contributions: ['Multimodal preprocessing & skull-stripping', 'MNI-152 spatial resampling pipeline', 'Connected-component lesion volumetry & DICOM export']
  }
];
