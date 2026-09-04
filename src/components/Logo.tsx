import React from 'react';
import { useLogo, LogoVariantId, LogoColorTheme, StrokeWeight } from '../context/LogoContext';

export interface LogoProps {
  size?: number;
  className?: string;
  variant?: 'light' | 'dark' | 'brand';
  overrideStyle?: LogoVariantId;
  showWordmark?: boolean;
  subtitle?: string;
  animate?: boolean;
  interactive?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 42,
  className = '',
  variant = 'brand',
  overrideStyle,
  showWordmark = true,
  subtitle = 'HCMUT · MEDICAL AI RESEARCH',
  animate = true,
  interactive = false,
}) => {
  const {
    activeVariant: globalVariant,
    showBrainstem: globalShowStem,
    colorTheme: globalColorTheme,
    strokeWeight: globalWeight,
    setIsStudioOpen,
  } = useLogo();

  const activeStyle = overrideStyle || globalVariant;
  const showStem = globalShowStem;

  // Stroke width mapping
  const strokeWidthVal =
    globalWeight === 'light' ? 2.2 : globalWeight === 'bold' ? 3.4 : 2.8;

  // Determine stroke & accent colors based on variant & color theme
  let mainStroke = '#4A7268';
  let accentStroke = '#4A7268';
  let stemColor = '#4A7268';

  if (variant === 'dark') {
    mainStroke = '#7EC7BC';
    accentStroke = '#7EC7BC';
    stemColor = '#94A3B8';
  } else if (variant === 'light') {
    mainStroke = '#1A1F24';
    accentStroke = '#334155';
    stemColor = '#334155';
  } else {
    // Brand variant - medical green matching user reference
    mainStroke = '#4A7268';
    accentStroke = '#4A7268';
    stemColor = '#4A7268';
  }

  const textColor = variant === 'dark' ? 'text-white' : 'text-[#1A1F24]';
  const subTextColor = variant === 'dark' ? 'text-stone-400' : 'text-stone-500';

  return (
    <div
      className={`inline-flex items-center gap-3 select-none ${className}`}
    >
      {/* Dynamic SVG Icon Container */}
      <div
        style={{ width: size, height: size }}
        className="relative flex-shrink-0 flex items-center justify-center transition-transform duration-300 hover:scale-105"
      >
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full overflow-visible"
          aria-label="UDA-StrokeSeg Infinity Brain Logo"
        >
          <defs>
            {/* Gradient definition for high-tech variants */}
            <linearGradient id="udaBrainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4A7268" />
              <stop offset="100%" stopColor="#31564E" />
            </linearGradient>

            <linearGradient id="udaBrainGradDark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7AC1B5" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>
          </defs>

          {/* Coordinate ring matching reference image */}
          <circle
            cx="60"
            cy="60"
            r="53"
            stroke={variant === 'dark' ? '#334155' : '#D1DCD8'}
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />

          {/* Precision Crosshair ticks matching reference image */}
          <line x1="60" y1="2" x2="60" y2="10" stroke={variant === 'dark' ? '#475569' : '#A3B8B2'} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="60" y1="110" x2="60" y2="118" stroke={variant === 'dark' ? '#475569' : '#A3B8B2'} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="2" y1="60" x2="10" y2="60" stroke={variant === 'dark' ? '#475569' : '#A3B8B2'} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="110" y1="60" x2="118" y2="60" stroke={variant === 'dark' ? '#475569' : '#A3B8B2'} strokeWidth="1.8" strokeLinecap="round" />

          {/* =========================================================================
              STYLE: CLINICAL SILHOUETTE & INFINITY DOUBLE S (Hospital & Academic Master)
              Brain Silhouette contour + Interlocking S Infinity Loop + Sulcal Axis
             ========================================================================= */}
          {activeStyle === 'clinical-silhouette' && (
            <g className={animate ? 'transition-all duration-500' : ''}>
              {/* Optional Anatomical Brainstem (Cuống não) */}
              {showStem && (
                <path
                  d="M 56 100 C 56 107, 54 112, 51 116 C 54 117, 66 117, 69 116 C 66 112, 64 107, 64 100"
                  fill="none"
                  stroke={stemColor}
                  strokeWidth={strokeWidthVal * 0.8}
                  strokeLinecap="round"
                  opacity="0.8"
                />
              )}

              <g transform="translate(10, 10)">
                {/* Outer Brain Silhouette */}
                <path
                  d="M50 90C25 90 10 70 10 45C10 20 30 10 50 10C70 10 90 20 90 45C90 70 75 90 50 90Z"
                  fill="none"
                  stroke={mainStroke}
                  strokeWidth={strokeWidthVal * 0.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Subtle anatomical hemisphere divider */}
                <path
                  d="M50 10 L50 26 M50 74 L50 90"
                  stroke={mainStroke}
                  strokeWidth={strokeWidthVal * 0.5}
                  strokeLinecap="round"
                  opacity="0.35"
                />

                {/* Interlocking S (Infinity Style) - Upper Loop */}
                <path
                  d="M35 40C35 28 45 28 50 40C55 52 65 52 65 40"
                  stroke={mainStroke}
                  strokeWidth={strokeWidthVal * 1.3}
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Interlocking S (Infinity Style) - Lower Loop */}
                <path
                  d="M65 60C65 72 55 72 50 60C45 48 35 48 35 60"
                  stroke={accentStroke}
                  strokeWidth={strokeWidthVal * 1.3}
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Central Medial Coordinate Axis */}
                <path
                  d="M50 38L50 62"
                  stroke={accentStroke}
                  strokeWidth={1.6}
                  strokeDasharray="2.5 2.5"
                  strokeLinecap="round"
                />

                {/* Central Fused Node */}
                <circle cx="50" cy="50" r="3" fill={mainStroke} />
              </g>
            </g>
          )}

          {/* =========================================================================
              STYLE 1: MOBIUS NEURO-INFINITY (Khuyên Möbius Vỏ Não)
              A continuous infinity ribbon where the outer edges unfold into the
              cerebral gyri (lobes) of image 1, crossing gracefully with ribbon depth.
             ========================================================================= */}
          {activeStyle === 'mobius-neuro' && (
            <g className={animate ? 'transition-all duration-500' : ''}>
              {/* Optional Anatomical Brainstem (Cuống não) */}
              {showStem && (
                <path
                  d="M 57 76 C 57 88, 55 96, 52 104 C 54 105, 66 105, 68 104 C 65 96, 63 88, 63 76"
                  fill="none"
                  stroke={stemColor}
                  strokeWidth={strokeWidthVal * 0.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.8"
                />
              )}

              {/* Underlying pass of the infinity loop (passing beneath center) */}
              <path
                d="M 28 42
                   C 19 46, 14 55, 14 62
                   C 14 70, 20 78, 28 80
                   C 36 82, 45 78, 52 70
                   C 56 65, 59 62, 60 60
                   C 61 58, 64 55, 68 50
                   C 75 42, 84 38, 92 40
                   C 100 42, 106 50, 106 58
                   C 106 66, 101 74, 92 78
                   C 84 82, 75 78, 68 70"
                stroke={mainStroke}
                strokeWidth={strokeWidthVal}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.25"
              />

              {/* Left Hemisphere (Gyri Lobe curves forming the left loop of infinity) */}
              <path
                d="M 60 60
                   C 54 68, 46 76, 38 78
                   C 31 80, 23 78, 19 72
                   C 14 65, 14 54, 20 47
                   C 26 40, 35 38, 42 41
                   C 48 44, 54 52, 60 60"
                stroke={mainStroke}
                strokeWidth={strokeWidthVal}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Distinctive Cerebral Gyri (scalloped lobes on left hemisphere rim) */}
              <path
                d="M 42 41
                   C 38 33, 29 33, 23 38
                   C 16 43, 11 51, 12 59
                   C 11 67, 16 75, 22 79
                   C 28 84, 37 84, 43 77"
                stroke={mainStroke}
                strokeWidth={strokeWidthVal}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Right Hemisphere (Gyri Lobe curves forming the right loop of infinity) */}
              <path
                d="M 60 60
                   C 66 52, 74 44, 82 42
                   C 89 40, 97 42, 101 48
                   C 106 55, 106 66, 100 73
                   C 94 80, 85 82, 78 79
                   C 72 76, 66 68, 60 60"
                stroke={accentStroke}
                strokeWidth={strokeWidthVal}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Distinctive Cerebral Gyri (scalloped lobes on right hemisphere rim) */}
              <path
                d="M 78 79
                   C 82 87, 91 87, 97 82
                   C 104 77, 109 69, 108 61
                   C 109 53, 104 45, 98 41
                   C 92 36, 83 36, 77 43"
                stroke={accentStroke}
                strokeWidth={strokeWidthVal}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interior Sulcal Waves (Nếp nhăn vỏ não bên trong) */}
              <path
                d="M 28 53 C 34 50, 38 57, 44 54"
                stroke={mainStroke}
                strokeWidth={strokeWidthVal * 0.75}
                strokeLinecap="round"
                opacity="0.75"
              />
              <path
                d="M 25 66 C 31 63, 35 69, 41 66"
                stroke={mainStroke}
                strokeWidth={strokeWidthVal * 0.75}
                strokeLinecap="round"
                opacity="0.75"
              />
              <path
                d="M 92 53 C 86 50, 82 57, 76 54"
                stroke={accentStroke}
                strokeWidth={strokeWidthVal * 0.75}
                strokeLinecap="round"
                opacity="0.75"
              />
              <path
                d="M 95 66 C 89 63, 85 69, 79 66"
                stroke={accentStroke}
                strokeWidth={strokeWidthVal * 0.75}
                strokeLinecap="round"
                opacity="0.75"
              />

              {/* Central Crossing Ribbon Bridge (Over-Under 3D depth) */}
              <path
                d="M 54 52 L 66 68"
                stroke={variant === 'dark' ? '#1A1F24' : '#FBFBFA'}
                strokeWidth={strokeWidthVal + 3.5}
                strokeLinecap="round"
              />
              <path
                d="M 53 51 L 67 69"
                stroke={mainStroke}
                strokeWidth={strokeWidthVal}
                strokeLinecap="round"
              />

              {/* Central Core Pulse Node */}
              <circle cx="60" cy="60" r="2.5" fill={accentStroke} />
            </g>
          )}

          {/* =========================================================================
              STYLE 2: SKETCH-REFINED (Bản vẽ tay chuẩn hóa)
              Faithful digital translation of the user's hand-drawn pen sketch:
              Left gyri bumps, center X-cross, right gyri bumps, and base brainstem.
             ========================================================================= */}
          {activeStyle === 'sketch-refined' && (
            <g className={animate ? 'transition-all duration-500' : ''}>
              {/* Brainstem (Cuống não) branching from the base, directly from user sketch */}
              {showStem && (
                <g>
                  <path
                    d="M 68 76 C 70 86, 73 95, 71 105 L 81 102 C 80 93, 76 84, 73 75"
                    fill="none"
                    stroke={stemColor}
                    strokeWidth={strokeWidthVal}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line x1="71" y1="105" x2="81" y2="102" stroke={stemColor} strokeWidth={strokeWidthVal} strokeLinecap="round" />
                </g>
              )}

              {/* Continuous Infinity Loop with Gyri Scallops as drawn in sketch */}
              {/* Left Wing (5 distinctive gyri scallops on outer edge) */}
              <path
                d="M 58 60
                   L 46 72
                   C 42 78, 38 86, 32 89
                   C 27 91, 23 85, 22 79
                   C 21 73, 15 72, 14 65
                   C 13 58, 17 54, 16 47
                   C 15 40, 22 36, 28 37
                   C 34 38, 39 42, 45 49
                   L 58 60"
                stroke={mainStroke}
                strokeWidth={strokeWidthVal}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Right Wing (4-5 distinctive gyri scallops on outer edge) */}
              <path
                d="M 62 60
                   L 74 48
                   C 80 41, 85 36, 92 37
                   C 98 38, 104 43, 105 50
                   C 106 56, 102 61, 104 67
                   C 106 73, 100 78, 95 80
                   C 88 82, 81 78, 74 72
                   L 62 60"
                stroke={accentStroke}
                strokeWidth={strokeWidthVal}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Cross Center lines (Refined crossing paths) */}
              <line x1="44" y1="74" x2="76" y2="46" stroke={mainStroke} strokeWidth={strokeWidthVal} strokeLinecap="round" />
              
              {/* Foreground cross stroke with clean isolation gap */}
              <line
                x1="44"
                y1="46"
                x2="76"
                y2="74"
                stroke={variant === 'dark' ? '#1A1F24' : '#FBFBFA'}
                strokeWidth={strokeWidthVal + 4}
                strokeLinecap="round"
              />
              <line x1="44" y1="46" x2="76" y2="74" stroke={accentStroke} strokeWidth={strokeWidthVal} strokeLinecap="round" />

              {/* Internal Gyri Folds (Adds organic brain feeling) */}
              <path
                d="M 24 53 C 29 50, 33 56, 38 53"
                stroke={mainStroke}
                strokeWidth={strokeWidthVal * 0.7}
                strokeLinecap="round"
                opacity="0.6"
              />
              <path
                d="M 26 67 C 32 64, 35 70, 40 66"
                stroke={mainStroke}
                strokeWidth={strokeWidthVal * 0.7}
                strokeLinecap="round"
                opacity="0.6"
              />
              <path
                d="M 94 53 C 89 50, 85 56, 80 53"
                stroke={accentStroke}
                strokeWidth={strokeWidthVal * 0.7}
                strokeLinecap="round"
                opacity="0.6"
              />
              <path
                d="M 92 67 C 86 64, 83 70, 78 66"
                stroke={accentStroke}
                strokeWidth={strokeWidthVal * 0.7}
                strokeLinecap="round"
                opacity="0.6"
              />
            </g>
          )}

          {/* =========================================================================
              STYLE 3: CORTICAL INFINITY (Bán cầu lồng vô cực - Fusion trực tiếp Hình 1)
              Preserves the upright dual-hemisphere brain of Image 1, but folds the
              internal sulci and medial longitudinal fissure into a continuous glowing
              infinity loop connecting both hemispheres.
             ========================================================================= */}
          {activeStyle === 'cortical-infinity' && (
            <g className={animate ? 'transition-all duration-500' : ''}>
              {/* Left Hemisphere Outer Silhouette (Scalloped exactly like Image 1) */}
              <path
                d="M 57 16
                   C 50 16, 44 19, 40 23
                   C 36 21, 31 22, 28 26
                   C 23 27, 19 32, 18 38
                   C 14 42, 14 48, 15 54
                   C 12 59, 13 67, 17 72
                   C 16 78, 20 84, 25 87
                   C 29 93, 37 97, 44 98
                   C 50 99, 55 96, 57 92"
                stroke={mainStroke}
                strokeWidth={strokeWidthVal}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Right Hemisphere Outer Silhouette (Scalloped exactly like Image 1) */}
              <path
                d="M 63 16
                   C 70 16, 76 19, 80 23
                   C 84 21, 89 22, 92 26
                   C 97 27, 101 32, 102 38
                   C 106 42, 106 48, 105 54
                   C 108 59, 107 67, 103 72
                   C 104 78, 100 84, 95 87
                   C 91 93, 83 97, 76 98
                   C 70 99, 65 96, 63 92"
                stroke={accentStroke}
                strokeWidth={strokeWidthVal}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Center Fissure: Top & Bottom vertical clefts */}
              <path d="M 60 14 L 60 33" stroke={mainStroke} strokeWidth={strokeWidthVal} strokeLinecap="round" />
              <path d="M 60 87 L 60 106" stroke={mainStroke} strokeWidth={strokeWidthVal} strokeLinecap="round" />

              {/* INFINITY SYMBOL AS THE INTERCONNECTING CORPUS CALLOSUM & SULCI */}
              {/* Left loop of infinity inside left hemisphere */}
              <path
                d="M 60 60
                   C 53 49, 42 44, 33 49
                   C 24 54, 24 66, 33 71
                   C 42 76, 53 71, 60 60"
                stroke={mainStroke}
                strokeWidth={strokeWidthVal * 1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Right loop of infinity inside right hemisphere */}
              <path
                d="M 60 60
                   C 67 71, 78 76, 87 71
                   C 96 66, 96 54, 87 49
                   C 78 44, 67 49, 60 60"
                stroke={accentStroke}
                strokeWidth={strokeWidthVal * 1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Anatomical internal gyri accents from reference image */}
              <path d="M 28 36 C 34 33, 40 38, 47 35" stroke={mainStroke} strokeWidth={strokeWidthVal * 0.85} strokeLinecap="round" />
              <path d="M 92 36 C 86 33, 80 38, 73 35" stroke={accentStroke} strokeWidth={strokeWidthVal * 0.85} strokeLinecap="round" />
              <path d="M 28 84 C 34 87, 40 82, 47 85" stroke={mainStroke} strokeWidth={strokeWidthVal * 0.85} strokeLinecap="round" />
              <path d="M 92 84 C 86 87, 80 82, 73 85" stroke={accentStroke} strokeWidth={strokeWidthVal * 0.85} strokeLinecap="round" />

              {/* Central Interconnection Node */}
              <circle cx="60" cy="60" r="3.6" fill={accentStroke} />
            </g>
          )}

          {/* =========================================================================
              STYLE 4: MONOLINE-MODERN (Biểu tượng vô cực tối giản công nghệ cao)
              Geometric elegance: 3 precise anatomical wave notches on each side of
              a continuous infinity ribbon, pristine at 16px to billboard size.
             ========================================================================= */}
          {activeStyle === 'monoline-modern' && (
            <g className={animate ? 'transition-all duration-500' : ''}>
              {/* Optional Stem */}
              {showStem && (
                <path
                  d="M 58 74 L 56 98 M 62 74 L 64 98"
                  stroke={stemColor}
                  strokeWidth={strokeWidthVal * 0.8}
                  strokeLinecap="round"
                  opacity="0.7"
                />
              )}

              {/* Background Loop Path */}
              <path
                d="M 60 60
                   C 68 50, 76 40, 88 40
                   C 102 40, 110 50, 110 60
                   C 110 70, 102 80, 88 80
                   C 76 80, 68 70, 60 60
                   C 52 50, 44 40, 32 40
                   C 18 40, 10 50, 10 60
                   C 10 70, 18 80, 32 80
                   C 44 80, 52 70, 60 60"
                stroke={mainStroke}
                strokeWidth={strokeWidthVal * 0.35}
                strokeDasharray="2 3"
                opacity="0.3"
              />

              {/* Left Hemisphere Monoline Ribbon with 3 Sculpted Gyri Lobes */}
              <path
                d="M 60 60
                   C 53 69, 45 78, 35 78
                   C 28 78, 22 84, 18 78
                   C 13 72, 8 68, 9 60
                   C 8 52, 13 48, 18 42
                   C 22 36, 28 42, 35 42
                   C 45 42, 53 51, 60 60"
                stroke={mainStroke}
                strokeWidth={strokeWidthVal * 1.15}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Right Hemisphere Monoline Ribbon with 3 Sculpted Gyri Lobes */}
              <path
                d="M 60 60
                   C 67 51, 75 42, 85 42
                   C 92 42, 98 36, 102 42
                   C 107 48, 112 52, 111 60
                   C 112 68, 107 72, 102 78
                   C 98 84, 92 78, 85 78
                   C 75 78, 67 69, 60 60"
                stroke={accentStroke}
                strokeWidth={strokeWidthVal * 1.15}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Depth Separation Notch at Center */}
              <circle cx="60" cy="60" r="4.5" fill={variant === 'dark' ? '#1A1F24' : '#FBFBFA'} />
              <circle cx="60" cy="60" r="2.2" fill={mainStroke} />

              {/* Minimal sulcal indicators */}
              <circle cx="28" cy="60" r="2" fill={mainStroke} opacity="0.6" />
              <circle cx="92" cy="60" r="2" fill={accentStroke} opacity="0.6" />
            </g>
          )}
        </svg>
      </div>

      {/* Wordmark and Typography */}
      {showWordmark && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span
              className={`text-xl md:text-2xl font-semibold tracking-tight font-serif-title leading-none ${textColor}`}
            >
              UDA-StrokeSeg
            </span>
            <span className="inline-block px-1.5 py-0.5 text-[9px] font-mono-code font-bold tracking-wider rounded bg-[#2D5A54]/10 text-[#2D5A54]">
              v1.0
            </span>
          </div>
          {subtitle && (
            <span
              className={`text-[9px] md:text-[10px] font-mono-code font-semibold tracking-[0.2em] uppercase mt-1 ${subTextColor}`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
