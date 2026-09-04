import React from 'react';
import { Logo } from './Logo';
import { ShieldAlert, ArrowUp } from 'lucide-react';

interface FooterProps {
  onOpenScanModal: () => void;
  onOpenReportModal: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenScanModal,
  onOpenReportModal,
}) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#13161A] text-white pt-20 pb-12 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        
        {/* Top Grid */}
        <div className="grid lg:grid-cols-12 gap-12 pb-16 border-b border-stone-800">
          
          {/* Brand & Mission Statement */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="flex items-center gap-3.5">
              <Logo size={38} variant="dark" showWordmark={false} />
              <span className="text-2xl font-serif tracking-tight text-white">
                UDA-StrokeSeg
              </span>
            </div>
            
            <p className="mt-6 text-sm text-stone-400 leading-relaxed max-w-md">
              <strong>UDA-StrokeSeg</strong> delivers automated, zero-annotation lesion quantification 
              for acute ischemic stroke on multi-vendor 1.5T and 3.0T MRI. Engineered for hospital PACS networks, 
              stroke centers, and clinical trials with guaranteed on-premise zero-data-egress.
            </p>

            <div className="mt-8 flex items-center gap-4">
              <button
                onClick={onOpenScanModal}
                className="px-4 py-2 bg-[#3D7068] hover:bg-[#325c56] text-white text-xs font-mono font-semibold rounded transition"
              >
                Run clinical demo
              </button>
              <button
                onClick={onOpenReportModal}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-mono rounded transition"
              >
                Sample diagnostic report
              </button>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-3 sm:col-span-6 flex flex-col gap-3 font-mono text-xs">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">
              Platform modules
            </span>
            <a href="#overview" className="text-stone-400 hover:text-white transition">01. Clinical overview</a>
            <a href="#methodology" className="text-stone-400 hover:text-white transition">02. 3-tier pipeline</a>
            <a href="#viewer" className="text-stone-400 hover:text-white transition">03. Diagnostic workstation</a>
          </div>

          {/* Institutional Governance & Regulatory Notice */}
          <div className="lg:col-span-4 sm:col-span-6 flex flex-col gap-3 font-mono text-xs">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">
              Institutional governance & compliance
            </span>
            <p className="text-stone-400 leading-relaxed">
              Developed in partnership with Ho Chi Minh City University of Technology (HCMUT - VNU-HCM)<br />
              Commercial Enterprise Edition · Version 1.0<br />
              Automated Ischemic Stroke Quantification Suite
            </p>

            {/* Regulatory Notice Box */}
            <div className="mt-4 p-3.5 rounded-lg bg-black/40 border border-stone-800 text-[11px] text-stone-400 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-[#3D7068] flex-shrink-0 mt-0.5" />
              <p className="leading-snug">
                <strong>Clinical Notice:</strong> Automated volumetric results assist attending neurologists and neuroradiologists in clinical decision-making.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-stone-500 gap-4">
          <div className="flex items-center gap-2">
            <span>© 2026 UDA-StrokeSeg Clinical Suite · In scientific partnership with HCMUT. All rights reserved.</span>
          </div>

          <button
            onClick={scrollToTop}
            className="inline-flex items-center gap-1.5 text-stone-400 hover:text-white transition group"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </footer>
  );
};
