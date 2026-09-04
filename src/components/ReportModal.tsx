import React from 'react';
import { X, Printer, Download, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { PatientCase } from '../types';
import { Logo } from './Logo';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: PatientCase;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  caseData,
}) => {
  if (!isOpen) return null;

  const handleDownloadCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        ['Parameter', 'Value'],
        ['Case_ID', caseData.id],
        ['Patient_Age', caseData.patientAge],
        ['Patient_Gender', caseData.gender],
        ['Onset_Hours', caseData.onsetHours],
        ['Scanner_Model', caseData.scanner],
        ['Field_Strength', caseData.fieldStrength],
        ['Domain_Center', caseData.domain],
        ['Total_Infarct_Volume_mL', caseData.totalVolumeMl],
        ['Connected_Lesion_Count', caseData.lesionCount],
        ['Hemispheric_Laterality', caseData.laterality],
        ['Vascular_Territory', caseData.territory],
        ['Model_Backbone', '3D nnU-Net with Atlas-Anchored Contrastive UDA'],
        ['Atlas_Registration', 'MNI-152 Standard Space'],
        ['Evaluation_Protocol', 'ISLES 2022 Center-Held-Out'],
        ['Timestamp', new Date().toISOString()],
      ]
        .map((e) => e.join(','))
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${caseData.id}_uda_strokeseg_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white">
      <div className="bg-white text-[#1A1F24] rounded-2xl w-full max-w-3xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Modal Action Bar */}
        <div className="px-6 py-3.5 bg-stone-100 border-b border-stone-200 flex items-center justify-between print:hidden">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">
            Clinical research case export preview
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-stone-50 border border-stone-300 text-xs font-mono text-stone-700 transition"
            >
              <Download className="w-3.5 h-3.5 text-[#3D7068]" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#3D7068] hover:bg-[#315a54] text-white text-xs font-mono font-semibold transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-10 overflow-y-auto space-y-8 font-sans">
          
          {/* Institutional Clinical Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b-2 border-stone-900 gap-4">
            <div className="flex items-center gap-3">
              <Logo size={48} subtitle="Clinical diagnostic report" />
            </div>
            <div className="text-right text-xs font-mono text-stone-500">
              <p className="font-bold text-stone-800">UDA-StrokeSeg Clinical Suite v1.0</p>
              <p>In partnership with HCMUT - VNU-HCM</p>
              <p>Automated Clinical Volumetry</p>
            </div>
          </div>

          {/* Report Title & Metadata Banner */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 grid sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <span className="text-stone-400 block uppercase text-[10px]">Study identifier</span>
              <span className="font-bold text-sm text-stone-900">{caseData.id}</span>
            </div>
            <div>
              <span className="text-stone-400 block uppercase text-[10px]">Patient profile</span>
              <span className="font-bold text-stone-900">{caseData.patientAge}yo · {caseData.gender === 'M' ? 'Male' : 'Female'}</span>
            </div>
            <div>
              <span className="text-stone-400 block uppercase text-[10px]">Scanner acquisition</span>
              <span className="font-bold text-stone-900">{caseData.scanner}</span>
            </div>
            <div>
              <span className="text-stone-400 block uppercase text-[10px]">Domain role</span>
              <span className="font-bold text-emerald-700">{caseData.domain}</span>
            </div>
          </div>

          {/* Primary Quantitative Findings */}
          <div>
            <h4 className="text-base font-serif font-semibold text-stone-900 pb-2 border-b border-stone-200 mb-4">
              Automated infarct quantification
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <span className="text-xs font-mono text-stone-500 uppercase block">Total infarct burden</span>
                <p className="text-3xl font-serif font-bold text-[#3D7068] mt-1">
                  {caseData.totalVolumeMl} <span className="text-sm font-mono font-normal text-stone-500">mL</span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <span className="text-xs font-mono text-stone-500 uppercase block">Connected lesion count</span>
                <p className="text-3xl font-serif font-bold text-stone-800 mt-1">
                  {caseData.lesionCount} <span className="text-sm font-mono font-normal text-stone-500">discrete</span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <span className="text-xs font-mono text-stone-500 uppercase block">Hemispheric laterality</span>
                <p className="text-xl font-serif font-bold text-emerald-800 mt-2">
                  {caseData.laterality}
                </p>
              </div>
            </div>

            {/* Sequence Diagnostic Observations */}
            <div className="space-y-2 text-xs font-mono bg-stone-50 p-4 rounded-xl border border-stone-200">
              <div className="flex items-start gap-2">
                <span className="font-bold text-stone-700 min-w-[80px]">DWI (b1000):</span>
                <span className="text-stone-600">{caseData.dwiDescription}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-stone-700 min-w-[80px]">ADC Map:</span>
                <span className="text-stone-600">{caseData.adcDescription}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-stone-700 min-w-[80px]">FLAIR:</span>
                <span className="text-stone-600">{caseData.flairDescription}</span>
              </div>
            </div>
          </div>

          {/* Technical Specifications from PDF Chapter 4 */}
          <div className="text-xs font-mono text-stone-600 space-y-2">
            <h5 className="font-bold uppercase tracking-wider text-stone-800">
              Pipeline methodological provenance
            </h5>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-1">
              <div>• Backbone: 3D nnU-Net with shared encoder-decoder</div>
              <div>• Adaptation: Atlas-anchored contrastive InfoNCE</div>
              <div>• Hard negatives: Boundary parenchyma sampling (d &lt; δ)</div>
              <div>• Space: Nonlinear MNI-152 isotropic normalization</div>
              <div>• Benchmark: ISLES 2022 center-held-out protocol</div>
              <div>• Voxel resolution: 1.0 × 1.0 × 1.0 mm³</div>
            </div>
          </div>

          {/* Clinical Decision Support Notice */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-start gap-3 text-xs font-mono text-stone-800">
            <AlertTriangle className="w-5 h-5 text-[#3D7068] flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Clinical decision support notice</span>
              <p className="text-[11px] leading-relaxed text-stone-600">
                UDA-StrokeSeg provides automated volumetric quantification of ischemic core lesions (DWI / ADC hyperintensity). 
                It is designed to assist qualified neuroradiologists and stroke neurologists in clinical workflows. 
                Penumbra assessment requires dynamic perfusion-weighted imaging (CTP/MRP). Final diagnostic decisions rest with the attending physician.
              </p>
            </div>
          </div>

          {/* Validation & Attestation Block */}
          <div className="pt-6 border-t border-stone-200 flex justify-between items-end text-xs font-mono text-stone-500">
            <div>
              <p className="font-semibold text-stone-800">Scientific advisory & validation:</p>
              <p>Assoc. Prof. Vo Thi Ngoc Chau (HCMUT - VNU-HCM)</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-stone-800">System specification:</p>
              <p>UDA-StrokeSeg Clinical Suite · Multi-Center v1.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
