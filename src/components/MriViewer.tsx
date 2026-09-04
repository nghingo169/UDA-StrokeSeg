import React, { useState } from 'react';
import {
  Maximize2,
  Minimize2,
  Download,
  Eye,
  Sliders,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Crosshair,
  FileSpreadsheet,
  FileText,
  Info
} from 'lucide-react';
import { PatientCase, MriModality } from '../types';
import { PATIENT_CASES } from '../data/strokeData';

interface MriViewerProps {
  onOpenReportModal: (caseData: PatientCase) => void;
  onOpenScanModal: () => void;
}

export const MriViewer: React.FC<MriViewerProps> = ({
  onOpenReportModal,
  onOpenScanModal,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>('ISLES2022_042');
  const [modality, setModality] = useState<MriModality>('DWI');
  const [sliceIndex, setSliceIndex] = useState<number>(21);
  const [showMask, setShowMask] = useState<boolean>(true);
  const [maskOpacity, setMaskOpacity] = useState<number>(65);
  const [showHardNegatives, setShowHardNegatives] = useState<boolean>(true);
  const [showCrosshairs, setShowCrosshairs] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'binary' | 'heatmap'>('binary');

  const currentCase = PATIENT_CASES.find((c) => c.id === selectedCaseId) || PATIENT_CASES[0];

  const handleCaseChange = (caseId: string) => {
    setSelectedCaseId(caseId);
    const target = PATIENT_CASES.find((c) => c.id === caseId);
    if (target) {
      setSliceIndex(target.defaultSlice);
    }
  };

  // Check if current slice is in the lesion active zone
  const hasLesionOnSlice = Math.abs(sliceIndex - currentCase.defaultSlice) <= 7;
  const sliceLesionSize = hasLesionOnSlice
    ? Math.max(0.2, (1 - Math.abs(sliceIndex - currentCase.defaultSlice) / 8) * (currentCase.totalVolumeMl / 8)).toFixed(2)
    : '0.00';

  return (
    <section id="viewer" className="py-24 px-6 sm:px-8 max-w-7xl mx-auto">
      {/* Clinical Workstation Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#3D7068]/10 text-[#3D7068] text-[10px] font-mono font-bold uppercase tracking-widest mb-3">
            Diagnostic workstation · Multi-contrast MRI engine
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-medium text-[#1A1F24]">
            Slice-by-slice multimodal MRI exploration
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onOpenReportModal(currentCase)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded transition shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5 text-[#3D7068]" />
            <span>Generate case report</span>
          </button>
          <button
            onClick={onOpenScanModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold text-white bg-[#3D7068] hover:bg-[#346059] rounded transition shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Test custom case</span>
          </button>
        </div>
      </div>

      {/* Main Medical Console Grid */}
      <div className="grid lg:grid-cols-12 gap-8 items-start bg-[#13161A] text-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-stone-800">
        
        {/* Left / Center 8-cols: The MRI Canvas & Interactive Controls */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Top Bar: Case Switcher & Modality Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-800">
            {/* Case Selection Tabs */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-stone-400 uppercase mr-1">Case:</span>
              {PATIENT_CASES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleCaseChange(c.id)}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition ${
                    selectedCaseId === c.id
                      ? 'bg-[#3D7068] text-white shadow'
                      : 'bg-stone-800/80 text-stone-400 hover:text-white hover:bg-stone-800'
                  }`}
                >
                  {c.id}
                </button>
              ))}
            </div>

            {/* Modality Selector */}
            <div className="flex items-center gap-1 bg-stone-900/90 p-1 rounded-lg border border-stone-800">
              {(['DWI', 'ADC', 'FLAIR'] as const).map((mod) => (
                <button
                  key={mod}
                  onClick={() => setModality(mod)}
                  className={`px-3 py-1 text-xs font-mono font-bold rounded transition ${
                    modality === mod
                      ? 'bg-[#3D7068] text-white'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive MRI Canvas Container */}
          <div className="relative aspect-[4/3] bg-black rounded-xl border border-stone-800 overflow-hidden flex items-center justify-center select-none shadow-inner">
            
            {/* Top Canvas Badges */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              <span className="px-2.5 py-1 bg-[#1A1F24]/85 backdrop-blur-md rounded border border-white/10 text-[11px] font-mono text-emerald-400 font-semibold">
                {currentCase.id} · {currentCase.scanner}
              </span>
              <span className="px-2.5 py-1 bg-[#1A1F24]/85 backdrop-blur-md rounded border border-white/10 text-[11px] font-mono text-stone-300">
                {modality} (Axial)
              </span>
            </div>

            {/* Quick Action Overlay Toggles */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <button
                onClick={() => setShowCrosshairs(!showCrosshairs)}
                className={`p-1.5 rounded border transition ${
                  showCrosshairs
                    ? 'bg-[#3D7068] border-[#3D7068] text-white'
                    : 'bg-[#1A1F24]/85 border-white/10 text-stone-400 hover:text-white'
                }`}
                title="Toggle MNI Crosshairs"
              >
                <Crosshair className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowMask(!showMask)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono border transition ${
                  showMask
                    ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                    : 'bg-[#1A1F24]/85 border-white/10 text-stone-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Mask {showMask ? 'on' : 'off'}</span>
              </button>
            </div>

            {/* SVG Anatomical Rendering Engine representing Real Stroke MRI Axial Slices */}
            <svg
              viewBox="0 0 360 320"
              className="w-full h-full max-h-[360px] filter drop-shadow-2xl"
            >
              <defs>
                {/* Modality Parenchyma Texture Shaders */}
                <radialGradient id="parenchymaGrad" cx="50%" cy="50%" r="50%">
                  <stop
                    offset="0%"
                    stopColor={
                      modality === 'ADC'
                        ? '#5E626B'
                        : modality === 'FLAIR'
                        ? '#22262E'
                        : '#2A2E36'
                    }
                  />
                  <stop
                    offset="75%"
                    stopColor={
                      modality === 'ADC'
                        ? '#3C4048'
                        : modality === 'FLAIR'
                        ? '#171A20'
                        : '#181B21'
                    }
                  />
                  <stop offset="100%" stopColor="#0B0D10" />
                </radialGradient>

                {/* Acute Ischemia Pathological Signal Shader */}
                <radialGradient id="lesionSignal" cx="45%" cy="45%" r="55%">
                  <stop
                    offset="0%"
                    stopColor={
                      modality === 'DWI'
                        ? '#F0FAF8'
                        : modality === 'ADC'
                        ? '#0F1115'
                        : '#A0B5B1'
                    }
                    stopOpacity="0.95"
                  />
                  <stop
                    offset="80%"
                    stopColor={
                      modality === 'DWI'
                        ? '#8ED1C6'
                        : modality === 'ADC'
                        ? '#1C1F26'
                        : '#4E6763'
                    }
                    stopOpacity="0.8"
                  />
                </radialGradient>

                {/* Heatmap gradient */}
                <linearGradient id="probHeatmap" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.7" />
                  <stop offset="50%" stopColor="#10B981" stopOpacity="0.8" />
                  <stop offset="85%" stopColor="#F59E0B" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity="0.95" />
                </linearGradient>
              </defs>

              {/* Skull & Extra-axial border */}
              <ellipse cx="180" cy="160" rx="145" ry="132" fill="#14171C" stroke="#252A33" strokeWidth="2.5" />
              <ellipse cx="180" cy="160" rx="136" ry="124" fill="none" stroke="#0D0F13" strokeWidth="3" />

              {/* Brain Parenchyma Outline */}
              <path
                d="M 180 44
                   C 135 44, 60 70, 56 128
                   C 52 174, 66 220, 94 250
                   C 122 276, 158 280, 180 280
                   C 202 280, 238 276, 266 250
                   C 294 220, 308 174, 304 128
                   C 300 70, 225 44, 180 44 Z"
                fill="url(#parenchymaGrad)"
                stroke="#333A46"
                strokeWidth="1.5"
              />

              {/* Interhemispheric Fissure */}
              <line x1="180" y1="46" x2="180" y2="278" stroke="#13161A" strokeWidth="2" strokeDasharray="3 2" />

              {/* Ventricular System (Morphology scales slightly with axial level) */}
              {sliceIndex >= 14 && sliceIndex <= 34 && (
                <g opacity={modality === 'FLAIR' ? 0.35 : 0.8}>
                  {/* Left Ventricle */}
                  <path
                    d="M 184 135 C 188 142, 196 156, 194 172 C 192 182, 186 188, 184 192 Z"
                    fill="#12151A"
                    stroke="#232832"
                    strokeWidth="1"
                  />
                  {/* Right Ventricle */}
                  <path
                    d="M 176 135 C 172 142, 164 156, 166 172 C 168 182, 174 188, 176 192 Z"
                    fill="#12151A"
                    stroke="#232832"
                    strokeWidth="1"
                  />
                </g>
              )}

              {/* Anatomical Sulci */}
              <path d="M 100 110 Q 130 120 148 105" stroke="#181B22" strokeWidth="1.5" fill="none" />
              <path d="M 260 110 Q 230 120 212 105" stroke="#181B22" strokeWidth="1.5" fill="none" />
              <path d="M 95 180 Q 125 185 152 175" stroke="#181B22" strokeWidth="1.5" fill="none" />
              <path d="M 265 180 Q 235 185 208 175" stroke="#181B22" strokeWidth="1.5" fill="none" />

              {/* CASE SPECIFIC LESION MORPHOLOGY */}
              {hasLesionOnSlice && (
                <g id="pathologyLayer">
                  {selectedCaseId === 'ISLES2022_042' && (
                    <>
                      {/* Primary Right MCA Infarction */}
                      <path
                        d="M 112 110
                           C 130 100, 154 112, 158 135
                           C 161 154, 150 174, 131 178
                           C 112 182, 96 164, 94 146
                           C 92 128, 101 114, 112 110 Z"
                        fill="url(#lesionSignal)"
                        stroke={modality === 'DWI' ? '#A2E3D8' : '#2D5A54'}
                        strokeWidth="1.2"
                      />
                      {/* Secondary punctate satellite core */}
                      <circle
                        cx="152"
                        cy="194"
                        r="8"
                        fill="url(#lesionSignal)"
                        stroke={modality === 'DWI' ? '#A2E3D8' : '#2D5A54'}
                        strokeWidth="1"
                      />

                      {/* Segmentation Mask / Heatmap Overlay */}
                      {showMask && (
                        <g opacity={maskOpacity / 100}>
                          {viewMode === 'binary' ? (
                            <>
                              <path
                                d="M 112 110
                                   C 130 100, 154 112, 158 135
                                   C 161 154, 150 174, 131 178
                                   C 112 182, 96 164, 94 146
                                   C 92 128, 101 114, 112 110 Z"
                                fill="#2DD4BF"
                                stroke="#4ADE80"
                                strokeWidth="2"
                              />
                              <circle cx="152" cy="194" r="8" fill="#2DD4BF" stroke="#4ADE80" strokeWidth="2" />
                            </>
                          ) : (
                            <>
                              <path
                                d="M 112 110
                                   C 130 100, 154 112, 158 135
                                   C 161 154, 150 174, 131 178
                                   C 112 182, 96 164, 94 146
                                   C 92 128, 101 114, 112 110 Z"
                                fill="url(#probHeatmap)"
                                stroke="#F59E0B"
                                strokeWidth="1.5"
                              />
                              <circle cx="152" cy="194" r="8" fill="url(#probHeatmap)" stroke="#F59E0B" strokeWidth="1.5" />
                            </>
                          )}

                          {/* Boundary Hard-Negative Sampling Region */}
                          {showHardNegatives && (
                            <path
                              d="M 104 102
                                 C 136 90, 166 104, 168 138
                                 C 172 165, 158 186, 131 190
                                 C 104 194, 88 172, 86 148
                                 C 84 124, 93 108, 104 102 Z"
                              fill="none"
                              stroke="#F59E0B"
                              strokeWidth="1.5"
                              strokeDasharray="3 3"
                            />
                          )}
                        </g>
                      )}
                    </>
                  )}

                  {selectedCaseId === 'ISLES2022_108' && (
                    <>
                      {/* Left hemisphere multifocal lacunar strokes (Screen right) */}
                      <ellipse cx="225" cy="140" rx="9" ry="7" fill="url(#lesionSignal)" />
                      <ellipse cx="240" cy="165" rx="7" ry="6" fill="url(#lesionSignal)" />
                      <circle cx="218" cy="180" r="5" fill="url(#lesionSignal)" />
                      <circle cx="250" cy="135" r="5" fill="url(#lesionSignal)" />

                      {showMask && (
                        <g opacity={maskOpacity / 100}>
                          <ellipse cx="225" cy="140" rx="9" ry="7" fill="#2DD4BF" stroke="#4ADE80" strokeWidth="1.5" />
                          <ellipse cx="240" cy="165" rx="7" ry="6" fill="#2DD4BF" stroke="#4ADE80" strokeWidth="1.5" />
                          <circle cx="218" cy="180" r="5" fill="#2DD4BF" stroke="#4ADE80" strokeWidth="1.5" />
                          <circle cx="250" cy="135" r="5" fill="#2DD4BF" stroke="#4ADE80" strokeWidth="1.5" />
                        </g>
                      )}
                    </>
                  )}

                  {selectedCaseId === 'ISLES2022_215' && (
                    <>
                      {/* Massive territorial right infarct */}
                      <path
                        d="M 90 90
                           C 140 70, 175 90, 178 140
                           C 180 185, 155 225, 120 230
                           C 85 235, 65 195, 68 150
                           C 70 115, 80 96, 90 90 Z"
                        fill="url(#lesionSignal)"
                      />

                      {showMask && (
                        <g opacity={maskOpacity / 100}>
                          <path
                            d="M 90 90
                               C 140 70, 175 90, 178 140
                               C 180 185, 155 225, 120 230
                               C 85 235, 65 195, 68 150
                               C 70 115, 80 96, 90 90 Z"
                            fill={viewMode === 'binary' ? '#2DD4BF' : 'url(#probHeatmap)'}
                            stroke="#4ADE80"
                            strokeWidth="2.5"
                          />
                        </g>
                      )}
                    </>
                  )}
                </g>
              )}

              {/* Crosshairs & MNI Coordinates */}
              {showCrosshairs && (
                <g stroke="#38BDF8" strokeWidth="0.8" opacity="0.65" strokeDasharray="4 4">
                  <line x1="180" y1="0" x2="180" y2="320" />
                  <line x1="0" y1="160" x2="360" y2="160" />
                  <circle cx="180" cy="160" r="4" fill="#38BDF8" />
                </g>
              )}

              {/* Anatomical Orientation Indicators */}
              <text x="20" y="164" fill="#64748B" fontSize="11" fontFamily="monospace" fontWeight="bold">R</text>
              <text x="330" y="164" fill="#64748B" fontSize="11" fontFamily="monospace" fontWeight="bold">L</text>
              <text x="176" y="28" fill="#64748B" fontSize="11" fontFamily="monospace" fontWeight="bold">A</text>
              <text x="176" y="308" fill="#64748B" fontSize="11" fontFamily="monospace" fontWeight="bold">P</text>
            </svg>

            {/* Bottom Floating Slice Status */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 bg-[#13161A]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-stone-800 text-[11px] font-mono">
              <span className="text-stone-400">Slice:</span>
              <span className="text-white font-bold">{sliceIndex} / {currentCase.totalSlices}</span>
              <span className="text-stone-600">|</span>
              <span className="text-stone-400">Slice volume:</span>
              <span className="text-emerald-400 font-bold">{sliceLesionSize} mL</span>
            </div>
          </div>

          {/* Slider & Scrubber Controls */}
          <div className="bg-[#181B20] p-4 rounded-xl border border-stone-800 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-mono text-stone-400">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSliceIndex((prev) => Math.max(1, prev - 1))}
                  className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-white transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>Navigate axial slices</span>
                <button
                  onClick={() => setSliceIndex((prev) => Math.min(currentCase.totalSlices, prev + 1))}
                  className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-white transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-stone-500">Key slices:</span>
                {currentCase.keySlices.map((k) => (
                  <button
                    key={k}
                    onClick={() => setSliceIndex(k)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      sliceIndex === k ? 'bg-[#3D7068] text-white' : 'bg-stone-800 text-stone-400 hover:text-white'
                    }`}
                  >
                    #{k}
                  </button>
                ))}
              </div>
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min={1}
              max={currentCase.totalSlices}
              value={sliceIndex}
              onChange={(e) => setSliceIndex(Number(e.target.value))}
              className="w-full accent-[#3D7068] cursor-pointer"
            />
          </div>
        </div>

        {/* Right 4-cols: Case Metadata & Quantitative Output */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Patient / Case Diagnostic Card */}
          <div className="bg-[#181B20] p-5 rounded-xl border border-stone-800">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-800">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#3D7068]">
                Case information
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300">
                UDA adapted
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-stone-400">Patient demographics:</span>
                <span className="text-white font-medium">{currentCase.patientAge}yo {currentCase.gender === 'M' ? 'Male' : 'Female'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Onset-to-imaging:</span>
                <span className="text-amber-300 font-medium">{currentCase.onsetHours} hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Scanner field:</span>
                <span className="text-white font-medium">{currentCase.scanner}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Domain category:</span>
                <span className="text-stone-300">{currentCase.domain}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Vascular territory:</span>
                <span className="text-emerald-400 text-right max-w-[180px] font-medium leading-tight">
                  {currentCase.territory}
                </span>
              </div>
            </div>
          </div>

          {/* Quantitative Clinical Volumetry */}
          <div className="bg-[#181B20] p-5 rounded-xl border border-stone-800">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#4ADE80] block mb-3">
              Automated volumetric metrics
            </span>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                <span className="text-[10px] font-mono text-stone-400 uppercase block">Total infarct burden</span>
                <p className="text-2xl font-serif font-semibold text-white mt-1">
                  {currentCase.totalVolumeMl} <span className="text-xs font-mono text-stone-400">mL</span>
                </p>
              </div>

              <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                <span className="text-[10px] font-mono text-stone-400 uppercase block">Lesion foci count</span>
                <p className="text-2xl font-serif font-semibold text-white mt-1">
                  {currentCase.lesionCount} <span className="text-xs font-mono text-stone-400">connected</span>
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono border-t border-stone-800 pt-3">
              <div className="flex justify-between">
                <span className="text-stone-400">Laterality:</span>
                <span className="text-emerald-400 font-bold">{currentCase.laterality}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Model framework:</span>
                <span className="text-stone-300">3D nnU-Net (UDA-adapted)</span>
              </div>
            </div>
          </div>

          {/* Viewer Layer Controls */}
          <div className="bg-[#181B20] p-5 rounded-xl border border-stone-800 space-y-4">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400 block">
              Display & overlay adjustments
            </span>

            {/* Mode: Binary vs Heatmap */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-stone-400">Rendering mode:</span>
              <div className="flex gap-1 bg-stone-900 p-1 rounded border border-stone-700">
                <button
                  onClick={() => setViewMode('binary')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    viewMode === 'binary' ? 'bg-[#3D7068] text-white' : 'text-stone-400'
                  }`}
                >
                  Binary
                </button>
                <button
                  onClick={() => setViewMode('heatmap')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    viewMode === 'heatmap' ? 'bg-[#3D7068] text-white' : 'text-stone-400'
                  }`}
                >
                  Probability
                </button>
              </div>
            </div>

            {/* Opacity slider */}
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between text-stone-400">
                <span>Overlay opacity:</span>
                <span className="text-white">{maskOpacity}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={maskOpacity}
                onChange={(e) => setMaskOpacity(Number(e.target.value))}
                className="w-full accent-[#3D7068] cursor-pointer"
              />
            </div>

            {/* Boundary Hard Negatives Toggle */}
            <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-stone-800">
              <span className="text-stone-400">Hard-negative margin:</span>
              <button
                onClick={() => setShowHardNegatives(!showHardNegatives)}
                className={`px-2 py-0.5 rounded text-[10px] border ${
                  showHardNegatives
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-stone-800 text-stone-500 border-stone-700'
                }`}
              >
                {showHardNegatives ? 'Visible' : 'Hidden'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
