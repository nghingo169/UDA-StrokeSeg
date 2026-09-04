import React, { useState } from 'react';
import { PatientCase } from '../types';

interface HeroSectionProps {
  onOpenScanModal: () => void;
  onOpenReportModal: () => void;
  onOpenHospitalModal?: () => void;
  activeCase: PatientCase;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenScanModal,
  onOpenReportModal,
  activeCase,
}) => {
  const [activeModality, setActiveModality] = useState<'DWI' | 'ADC' | 'FLAIR'>('DWI');
  const [currentSlice, setCurrentSlice] = useState<number>(21);

  return (
    <section id="overview" className="pt-12 pb-16 md:pt-16 md:pb-24 px-6 sm:px-8 max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-12 gap-12 lg:gap-14 items-center">
        {/* Left Column matching Image 1 */}
        <div className="lg:col-span-7 flex flex-col">
          {/* Eyebrow */}
          <span className="text-xs font-mono tracking-[0.25em] text-[#3D7068] uppercase font-semibold mb-5 block">
            UNSUPERVISED DOMAIN ADAPTATION
          </span>

          {/* Editorial Display Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif text-[#1A1F24] leading-[1.12] mb-6 font-normal tracking-tight">
            Segment acute ischemic stroke lesions on MRI from any center
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg text-stone-600 leading-relaxed max-w-xl mb-10 font-normal">
            Ingest DWI, ADC and FLAIR volumes. Get slice-wise overlays, lesion volume, lesion count and hemispheric laterality — without a single annotation from your site.
          </p>

          {/* Action Buttons matching Image 1 */}
          <div className="flex items-center gap-4">
            <button
              onClick={onOpenScanModal}
              className="px-6 py-3.5 bg-[#3D7068] hover:bg-[#315a53] text-white font-sans text-sm font-medium transition cursor-pointer"
            >
              Run a scan
            </button>

            <button
              onClick={onOpenReportModal}
              className="px-6 py-3.5 bg-white border border-stone-300 hover:border-stone-900 text-[#1A1F24] font-sans text-sm font-medium transition cursor-pointer"
            >
              Read the method
            </button>
          </div>
        </div>

        {/* Right Column matching Image 1: Minimalist Dark Slice Viewer */}
        <div className="lg:col-span-5">
          <div className="relative aspect-square w-full bg-[#12161C] border border-stone-800 overflow-hidden shadow-xl flex items-center justify-center group select-none">
            {/* Vector Anatomical MRI Simulation */}
            <svg
              viewBox="0 0 320 280"
              className="w-full h-full max-h-[300px] filter drop-shadow-lg"
            >
              <defs>
                <radialGradient id="brainParenchymaHero" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={activeModality === 'ADC' ? '#5E646E' : '#242930'} />
                  <stop offset="70%" stopColor={activeModality === 'ADC' ? '#42464F' : '#181C22'} />
                  <stop offset="100%" stopColor="#0D0F13" />
                </radialGradient>
                
                <radialGradient id="ischemicLesionHero" cx="45%" cy="45%" r="55%">
                  <stop
                    offset="0%"
                    stopColor={
                      activeModality === 'DWI'
                        ? '#E8F7F4'
                        : activeModality === 'ADC'
                        ? '#101216'
                        : '#C0D0CE'
                    }
                    stopOpacity="0.95"
                  />
                  <stop
                    offset="100%"
                    stopColor={
                      activeModality === 'DWI'
                        ? '#7EC7BC'
                        : activeModality === 'ADC'
                        ? '#22262E'
                        : '#5B7672'
                    }
                    stopOpacity="0.8"
                  />
                </radialGradient>

                <filter id="lesionGlowHero" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Skull boundary */}
              <ellipse cx="160" cy="140" rx="120" ry="110" fill="#14171C" stroke="#252A33" strokeWidth="2" />
              <ellipse cx="160" cy="140" rx="112" ry="103" fill="none" stroke="#0D0F13" strokeWidth="2.5" />

              {/* Brain Parenchyma */}
              <path
                d="M 160 38
                   C 120 38, 56 60, 52 110
                   C 48 150, 60 190, 84 216
                   C 108 238, 140 242, 160 242
                   C 180 242, 212 238, 236 216
                   C 260 190, 272 150, 268 110
                   C 264 60, 200 38, 160 38 Z"
                fill="url(#brainParenchymaHero)"
                stroke="#333945"
                strokeWidth="1.5"
              />

              {/* Longitudinal Fissure */}
              <line x1="160" y1="40" x2="160" y2="240" stroke="#16191E" strokeWidth="1.5" strokeDasharray="3 2" />

              {/* Ventricles */}
              <path
                d="M 163 115 C 166 122, 172 135, 170 148 C 168 156, 164 162, 163 165 Z"
                fill={activeModality === 'FLAIR' ? '#0E1114' : '#1A1D23'}
                stroke="#2C323D"
                strokeWidth="1"
              />
              <path
                d="M 157 115 C 154 122, 148 135, 150 148 C 152 156, 156 162, 157 165 Z"
                fill={activeModality === 'FLAIR' ? '#0E1114' : '#1A1D23'}
                stroke="#2C323D"
                strokeWidth="1"
              />

              {/* Stroke Lesion Morphology */}
              <g id="strokeLesionAreaHero">
                <path
                  d="M 102 96
                     C 118 88, 138 98, 142 118
                     C 145 134, 135 152, 118 156
                     C 102 160, 88 144, 86 128
                     C 84 112, 92 100, 102 96 Z"
                  fill="url(#ischemicLesionHero)"
                  stroke={activeModality === 'DWI' ? '#A8E3D8' : '#3D7068'}
                  strokeWidth="1"
                />

                <circle
                  cx="138"
                  cy="168"
                  r="7"
                  fill="url(#ischemicLesionHero)"
                  stroke={activeModality === 'DWI' ? '#A8E3D8' : '#3D7068'}
                  strokeWidth="0.8"
                />

                {/* Pulsing Segmentation Mask */}
                <g filter="url(#lesionGlowHero)">
                  <path
                    d="M 102 96
                       C 118 88, 138 98, 142 118
                       C 145 134, 135 152, 118 156
                       C 102 160, 88 144, 86 128
                       C 84 112, 92 100, 102 96 Z"
                    fill="#3D7068"
                    fillOpacity="0.55"
                    stroke="#3D7068"
                    strokeWidth="2"
                    className="animate-pulse"
                  />
                  <circle
                    cx="138"
                    cy="168"
                    r="7"
                    fill="#3D7068"
                    fillOpacity="0.55"
                    stroke="#3D7068"
                    strokeWidth="1.5"
                    className="animate-pulse"
                  />
                </g>
              </g>
            </svg>

            {/* Modality Selector (Subtle top-right controls) */}
            <div className="absolute top-3 right-3 flex gap-1 bg-[#1A1F24]/80 backdrop-blur-xs p-1 border border-stone-800">
              {(['DWI', 'ADC', 'FLAIR'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveModality(m)}
                  className={`px-2 py-0.5 text-[10px] font-mono transition ${
                    activeModality === m
                      ? 'bg-[#3D7068] text-white'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Bottom Left Legend exactly matching Image 1 */}
            <div className="absolute bottom-0 left-0 p-5 z-10">
              <span className="font-mono text-xs text-stone-400">
                {activeModality} · slice {currentSlice}/48 · 14.6 mL
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
