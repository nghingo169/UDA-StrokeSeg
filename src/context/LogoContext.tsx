import React, { createContext, useContext, useState, useEffect } from 'react';

export type LogoVariantId = 
  | 'clinical-silhouette' // Phương án Y khoa: Viền Não bộ & Vô cực Interlocking S (Chuẩn theo bản vẽ & hospital template)
  | 'mobius-neuro'        // Phương án 1: Vô cực vỏ não Möbius (Khuyên uốn lượn bán cầu não)
  | 'sketch-refined'      // Phương án 2: Bản vẽ tay chuẩn hóa (Chuẩn hóa từ sketch bút bi)
  | 'cortical-infinity'   // Phương án 3: Bán cầu lồng vô cực (Fusion hình 1 với vô cực)
  | 'monoline-modern';    // Phương án 4: Biểu tượng vô cực tối giản công nghệ cao

export type LogoColorTheme = 'medical' | 'navy' | 'slate' | 'teal' | 'gradient';
export type StrokeWeight = 'light' | 'regular' | 'bold';

interface LogoContextType {
  activeVariant: LogoVariantId;
  setActiveVariant: (variant: LogoVariantId) => void;
  showBrainstem: boolean;
  setShowBrainstem: (show: boolean) => void;
  colorTheme: LogoColorTheme;
  setColorTheme: (theme: LogoColorTheme) => void;
  strokeWeight: StrokeWeight;
  setStrokeWeight: (weight: StrokeWeight) => void;
  isStudioOpen: boolean;
  setIsStudioOpen: (open: boolean) => void;
}

const LogoContext = createContext<LogoContextType | undefined>(undefined);

export const LogoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeVariant, setActiveVariant] = useState<LogoVariantId>('cortical-infinity');
  const [showBrainstem, setShowBrainstem] = useState<boolean>(false);
  const [colorTheme, setColorTheme] = useState<LogoColorTheme>('medical');
  const [strokeWeight, setStrokeWeight] = useState<StrokeWeight>('regular');
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);

  // Allow persisting preference in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('uda_logo_variant');
      if (saved && ['clinical-silhouette', 'mobius-neuro', 'sketch-refined', 'cortical-infinity', 'monoline-modern'].includes(saved)) {
        setActiveVariant(saved as LogoVariantId);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleSetVariant = (variant: LogoVariantId) => {
    setActiveVariant(variant);
    try {
      localStorage.setItem('uda_logo_variant', variant);
    } catch {
      // Ignore
    }
  };

  return (
    <LogoContext.Provider
      value={{
        activeVariant,
        setActiveVariant: handleSetVariant,
        showBrainstem,
        setShowBrainstem,
        colorTheme,
        setColorTheme,
        strokeWeight,
        setStrokeWeight,
        isStudioOpen,
        setIsStudioOpen,
      }}
    >
      {children}
    </LogoContext.Provider>
  );
};

export const useLogo = () => {
  const context = useContext(LogoContext);
  if (!context) {
    throw new Error('useLogo must be used within a LogoProvider');
  }
  return context;
};
