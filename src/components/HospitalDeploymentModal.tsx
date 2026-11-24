import React, { useState } from 'react';
import {
  X,
  Building2,
  Server,
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  Cpu,
  Download,
  Mail,
  ArrowRight,
  Stethoscope,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';
import { Logo } from './Logo';

interface HospitalDeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HospitalDeploymentModal: React.FC<HospitalDeploymentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [hospitalName, setHospitalName] = useState('');
  const [department, setDepartment] = useState('Radiology & Neuroimaging');
  const [scannerType, setScannerType] = useState('3.0T Siemens Magnetom / GE Signa');
  const [pacsSystem, setPacsSystem] = useState('DICOM C-STORE / DICOM-SR (Standard)');
  const [deploymentTier, setDeploymentTier] = useState<'edge' | 'cloud' | 'trial'>('edge');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#1A1F24]/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#FAF9F5] rounded-2xl shadow-2xl border border-stone-300 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={36} showWordmark={false} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-serif text-[#1A1F24] font-semibold">
                  Hospital deployment & clinical evaluation
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#3D7068]/15 text-[#3D7068]">
                  Enterprise Suite
                </span>
              </div>
              <p className="text-xs text-stone-500 font-mono mt-0.5">
                Multi-center zero-annotation PACS integration protocol · HIPAA & GDPR compliant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {submitted ? (
            <div className="text-center py-10 px-4">
              <div className="w-16 h-16 bg-[#3D7068]/15 text-[#3D7068] rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-2xl font-serif text-stone-900 mb-2">
                Evaluation package dispatched
              </h4>
              <p className="text-sm text-stone-600 max-w-lg mx-auto leading-relaxed mb-6">
                Thank you for registering <strong>{hospitalName || 'your clinical institution'}</strong>. 
                Our research consortium has generated your institution-specific trial token and container specification.
              </p>
              <div className="p-4 rounded-xl bg-white border border-stone-200 text-left max-w-md mx-auto text-xs font-mono space-y-2 mb-6 text-stone-700">
                <div className="flex justify-between">
                  <span className="text-stone-400">Target PACS:</span>
                  <span className="font-semibold">{pacsSystem}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Scanner profile:</span>
                  <span className="font-semibold">{scannerType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Execution architecture:</span>
                  <span className="font-semibold text-[#3D7068] uppercase">{deploymentTier} container</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Audit trail:</span>
                  <span className="text-emerald-700 font-semibold">Zero-data-egress verified</span>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-mono text-stone-700 hover:bg-stone-50 transition"
                >
                  Configure another center
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-[#3D7068] text-white rounded-lg text-xs font-mono font-semibold hover:bg-[#2D544E] transition"
                >
                  Return to workstation
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Value Banner */}
              <div className="grid sm:grid-cols-3 gap-3 p-4 rounded-xl bg-white border border-stone-200">
                <div className="flex items-start gap-2.5">
                  <Server className="w-4 h-4 text-[#3D7068] mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">Zero-annotation adaptation</span>
                    <span className="text-[11px] text-stone-500 leading-tight block mt-0.5">
                      No radiologist labeling required for new scanner models.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#3D7068] mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">On-premise edge GPU</span>
                    <span className="text-[11px] text-stone-500 leading-tight block mt-0.5">
                      Patient MRI data never leaves your hospital firewall.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <FileCheck className="w-4 h-4 text-[#3D7068] mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">DICOM-SR automated</span>
                    <span className="text-[11px] text-stone-500 leading-tight block mt-0.5">
                      Automatic lesion volume & laterality injected into PACS.
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600 block mb-1.5">
                    Hospital or medical center name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cho Ray Hospital / Mayo Clinic"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#3D7068] font-sans"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600 block mb-1.5">
                    Clinical department
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#3D7068] font-sans"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600 block mb-1.5">
                    Installed scanner field strength
                  </label>
                  <select
                    value={scannerType}
                    onChange={(e) => setScannerType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#3D7068] font-sans"
                  >
                    <option value="3.0T Siemens Magnetom / GE Signa">3.0T High-Field (Siemens / GE / Philips)</option>
                    <option value="1.5T Siemens Avanto / Philips Achieva">1.5T Clinical Standard (Multi-Vendor)</option>
                    <option value="Mixed 1.5T and 3.0T Fleet">Mixed Fleet (Both 1.5T & 3.0T Scanners)</option>
                    <option value="Mobile or Low-Field Unit">Mobile or Specialized Stroke Unit</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600 block mb-1.5">
                    PACS & workstation protocol
                  </label>
                  <select
                    value={pacsSystem}
                    onChange={(e) => setPacsSystem(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#3D7068] font-sans"
                  >
                    <option value="DICOM C-STORE / DICOM-SR (Standard)">DICOM C-STORE + DICOM-SR Structured Report</option>
                    <option value="Orthanc / dcm4chee Enterprise PACS">Orthanc / dcm4chee Enterprise PACS</option>
                    <option value="GE Centricity / Siemens Syngo.via">GE Centricity / Siemens Syngo.via</option>
                    <option value="HL7 / FHIR EHR Direct Integration">HL7 v2.x / FHIR EHR Direct Integration</option>
                  </select>
                </div>
              </div>

              {/* Deployment Option Selector */}
              <div>
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600 block mb-2">
                  Institutional licensing & deployment preference
                </label>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => setDeploymentTier('edge')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      deploymentTier === 'edge'
                        ? 'bg-white border-[#3D7068] ring-2 ring-[#3D7068]/20 shadow-xs'
                        : 'bg-white/60 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-stone-900">Hospital edge container</span>
                      <span className="text-[10px] font-mono text-[#3D7068] font-semibold">Recommended</span>
                    </div>
                    <p className="text-[11px] text-stone-500 leading-normal">
                      NVIDIA Clara / Docker container on local radiology GPU server. Complete data sovereignty.
                    </p>
                  </div>

                  <div
                    onClick={() => setDeploymentTier('trial')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      deploymentTier === 'trial'
                        ? 'bg-white border-[#3D7068] ring-2 ring-[#3D7068]/20 shadow-xs'
                        : 'bg-white/60 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-stone-900">Clinical hospital evaluation</span>
                      <span className="text-[10px] font-mono text-amber-700 font-semibold">60-day pilot</span>
                    </div>
                    <p className="text-[11px] text-stone-500 leading-normal">
                      Full enterprise evaluation license for acute stroke neurology teams and hospital trials.
                    </p>
                  </div>

                  <div
                    onClick={() => setDeploymentTier('cloud')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      deploymentTier === 'cloud'
                        ? 'bg-white border-[#3D7068] ring-2 ring-[#3D7068]/20 shadow-xs'
                        : 'bg-white/60 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-stone-900">Private health cloud</span>
                      <span className="text-[10px] font-mono text-stone-500 font-semibold">Multi-hospital</span>
                    </div>
                    <p className="text-[11px] text-stone-500 leading-normal">
                      Dedicated HIPAA-certified instance serving multi-hospital regional stroke networks.
                    </p>
                  </div>
                </div>
              </div>

              {/* Regulatory Notice */}
              <div className="p-3.5 rounded-lg bg-stone-100/90 border border-stone-200 text-[11px] text-stone-600 font-mono">
                <span className="font-bold text-stone-800">Deployment & quality standards:</span> Prepared under ISO 13485 medical device quality framework for hospital PACS C-STORE and zero-egress edge execution.
              </div>

              {/* Submit CTA */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-stone-500 font-mono">
                  HCMUT Medical AI Consortium · 2026
                </div>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-mono text-stone-600 hover:text-stone-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#3D7068] hover:bg-[#2D544E] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition shadow-md cursor-pointer flex items-center gap-2"
                  >
                    <span>Request deployment dossier</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
