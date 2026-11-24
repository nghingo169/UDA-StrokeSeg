export type MriModality = 'DWI' | 'ADC' | 'FLAIR' | 'COMPOSITE';

export interface SliceData {
  sliceNumber: number;
  hasLesion: boolean;
  lesionAreaCm2: number;
  description?: string;
}

export interface PatientCase {
  id: string;
  patientAge: number;
  gender: 'M' | 'F';
  onsetHours: number;
  scanner: string;
  fieldStrength: '1.5T' | '3.0T';
  domain: 'Source (Center 1)' | 'Target (Center 2 - Unlabeled)';
  totalVolumeMl: number;
  lesionCount: number;
  laterality: 'Right hemisphere' | 'Left hemisphere' | 'Bilateral';
  territory: string;
  keySlices: number[];
  defaultSlice: number;
  totalSlices: number;
  dwiDescription: string;
  adcDescription: string;
  flairDescription: string;
}

export interface BenchmarkRow {
  condition: string;
  mechanism: string;
  dscMean: number;
  dscStd: number;
  hd95Mean: number;
  hd95Std: number;
  avdMean: number;
  avdStd: number;
  f1Mean: number;
  f1Std: number;
  isProposed?: boolean;
  isOracle?: boolean;
}

export interface ResearchQuestion {
  id: string;
  title: string;
  question: string;
  hypothesis: string;
  falsificationRule: string;
  resultStatus: 'Supported' | 'Confirmed superior' | 'Evaluated';
}

export interface TeamMember {
  name: string;
  role: string;
  specialty?: string;
  studentId?: string;
  email: string;
  contributions: string[];
}
