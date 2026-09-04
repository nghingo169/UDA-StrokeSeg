import React, { useState } from 'react';
import { X, Play, Upload, CheckCircle2, Loader2, ArrowRight, FileText, AlertCircle } from 'lucide-react';
import { PatientCase } from '../types';
import { PATIENT_CASES } from '../data/strokeData';

interface RunScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCaseAndNavigate: (c: PatientCase) => void;
  onOpenReportModal: (c: PatientCase) => void;
}

export const RunScanModal: React.FC<RunScanModalProps> = ({
  isOpen,
  onClose,
  onSelectCaseAndNavigate,
  onOpenReportModal,
}) => {
  const [selectedCase, setSelectedCase] = useState<PatientCase>(PATIENT_CASES[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  if (!isOpen) return null;

  const steps = [
    { title: 'Validation & modality alignment', desc: 'Validating DWI, ADC, and FLAIR 3D NIfTI headers & skull-stripping' },
    { title: 'Spatial MNI atlas registration', desc: 'Affine coordinate normalization to standard brain template' },
    { title: '3D nnU-Net UDA inference', desc: 'Forward pass via adapted shared encoder-decoder weights' },
    { title: 'Volumetric post-processing', desc: 'Extracting lesion volume (mL), connected components, and laterality' },
  ];

  const handleRunInference = () => {
    setIsProcessing(true);
    setIsCompleted(false);
    setCurrentStep(1);

    setTimeout(() => {
      setCurrentStep(2);
      setTimeout(() => {
        setCurrentStep(3);
        setTimeout(() => {
          setCurrentStep(4);
          setIsProcessing(false);
          setIsCompleted(true);
        }, 800);
      }, 900);
    }, 900);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      setIsCompleted(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#181C22] text-white rounded-2xl w-full max-w-2xl border border-stone-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#13161A] border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3D7068]" />
            <h3 className="text-base font-serif font-medium text-white">
              Execute UDA-StrokeSeg inference pipeline
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Step 1: Select Case or Upload */}
          <div>
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-400 block mb-2">
              1. Select clinical validation case or provide local DICOM / NIfTI
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {PATIENT_CASES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCase(c);
                    setUploadedFileName(null);
                    setIsCompleted(false);
                  }}
                  className={`p-3 rounded-lg border text-left font-mono text-xs transition ${
                    selectedCase.id === c.id && !uploadedFileName
                      ? 'bg-[#3D7068] border-emerald-400 text-white'
                      : 'bg-[#13161A] border-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  <span className="font-bold block text-white">{c.id}</span>
                  <span className="text-[10px] text-stone-300 block">{c.scanner}</span>
                  <span className="text-[10px] text-emerald-400 block mt-1">{c.totalVolumeMl} mL · {c.laterality.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            {/* Custom Upload Dropzone */}
            <div className="border border-dashed border-stone-700 hover:border-stone-500 rounded-lg p-4 bg-[#13161A]/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-[#3D7068]" />
                <div>
                  <span className="text-xs font-mono font-semibold text-stone-200 block">
                    {uploadedFileName ? `Attached: ${uploadedFileName}` : 'Or drag & drop NIfTI / DICOM study (.nii.gz)'}
                  </span>
                  <span className="text-[10px] font-mono text-stone-500">
                    Expected: Multi-contrast DWI (b1000), ADC map, and FLAIR
                  </span>
                </div>
              </div>
              <label className="cursor-pointer px-3 py-1.5 bg-stone-800 hover:bg-stone-700 rounded text-xs font-mono text-stone-200 transition">
                Browse
                <input type="file" accept=".gz,.nii,.dcm,.zip" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>

          {/* Pipeline execution status */}
          <div className="bg-[#13161A] p-4 rounded-xl border border-stone-800">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-400 block mb-3">
              2. Synchronized automated inference pipeline
            </span>

            <div className="space-y-3 font-mono text-xs">
              {steps.map((step, idx) => {
                const stepNum = idx + 1;
                const isDone = currentStep > stepNum || isCompleted;
                const isCurrent = currentStep === stepNum && isProcessing;

                return (
                  <div key={step.title} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isCurrent ? (
                        <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-stone-700 text-stone-500 flex items-center justify-center text-[9px]">
                          {stepNum}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className={`font-semibold ${isDone ? 'text-white' : isCurrent ? 'text-amber-300' : 'text-stone-500'}`}>
                        {step.title}
                      </span>
                      <p className="text-[11px] text-stone-500 leading-snug">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Results preview when completed */}
          {isCompleted && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 animate-fade-in space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase">
                  Segmentation successfully generated
                </span>
                <span className="text-[10px] text-stone-400">Time elapsed: 2.6s (CUDA)</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs bg-black/40 p-3 rounded-lg border border-white/5">
                <div>
                  <span className="text-stone-400 text-[10px] block">Infarct burden:</span>
                  <span className="text-white font-bold text-sm">{selectedCase.totalVolumeMl} mL</span>
                </div>
                <div>
                  <span className="text-stone-400 text-[10px] block">Lesion count:</span>
                  <span className="text-white font-bold text-sm">{selectedCase.lesionCount} foci</span>
                </div>
                <div>
                  <span className="text-stone-400 text-[10px] block">Hemisphere:</span>
                  <span className="text-emerald-400 font-bold text-sm">{selectedCase.laterality.split(' ')[0]}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    onClose();
                    onSelectCaseAndNavigate(selectedCase);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#3D7068] hover:bg-[#315a54] text-white rounded text-xs font-semibold"
                >
                  <span>Open in slice viewer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onOpenReportModal(selectedCase)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>View formatted report</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#13161A] border-t border-stone-800 flex items-center justify-between">
          <span className="text-[11px] font-mono text-stone-500">
            Model: 3D nnU-Net · Contrastive UDA checkpoint
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-xs font-mono text-stone-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleRunInference}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#3D7068] hover:bg-[#315a54] disabled:opacity-50 text-white rounded text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute pipeline</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
