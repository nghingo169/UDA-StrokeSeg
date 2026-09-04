import React from 'react';
import { Logo } from './Logo';

interface NavbarProps {
  onOpenScanModal: () => void;
  onOpenReportModal: () => void;
  onOpenHospitalModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenScanModal,
  onOpenReportModal,
  onOpenHospitalModal,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#FAF9F5]/95 backdrop-blur-sm border-b border-stone-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-4 sm:py-5 flex items-center justify-between">
        {/* Brand with Infinity Brain Logo */}
        <a href="#overview" className="group flex items-center gap-3.5 hover:opacity-85 transition-opacity">
          <Logo size={42} showWordmark={false} />
          <span className="text-2xl font-serif tracking-tight text-[#1A1F24]">
            UDA-StrokeSeg
          </span>
        </a>

        {/* Minimal Navigation matching Image 1 */}
        <nav className="flex items-center gap-8 text-sm font-sans text-stone-600">
          <a
            href="#methodology"
            className="hover:text-[#1A1F24] transition-colors"
          >
            Method
          </a>
          <a
            href="#protocol"
            className="hover:text-[#1A1F24] transition-colors"
          >
            Benchmarks
          </a>
          <a
            href="#viewer"
            className="hover:text-[#1A1F24] transition-colors"
          >
            Prototype
          </a>
          {onOpenHospitalModal && (
            <button
              onClick={onOpenHospitalModal}
              className="text-stone-600 hover:text-[#1A1F24] transition-colors cursor-pointer text-left"
            >
              Deployment
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};
