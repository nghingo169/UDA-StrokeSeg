/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LogoProvider } from './context/LogoContext';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { PipelineSection } from './components/PipelineSection';
import { MriViewer } from './components/MriViewer';
import { Footer } from './components/Footer';
import { RunScanModal } from './components/RunScanModal';
import { ReportModal } from './components/ReportModal';
import { HospitalDeploymentModal } from './components/HospitalDeploymentModal';
import { PATIENT_CASES } from './data/strokeData';
import { PatientCase } from './types';

export default function App() {
  const [activeCase, setActiveCase] = useState<PatientCase>(PATIENT_CASES[0]);
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isHospitalModalOpen, setIsHospitalModalOpen] = useState<boolean>(false);
  const [reportCase, setReportCase] = useState<PatientCase>(PATIENT_CASES[0]);

  const handleOpenReport = (caseData?: PatientCase) => {
    if (caseData) {
      setReportCase(caseData);
    } else {
      setReportCase(activeCase);
    }
    setIsReportModalOpen(true);
  };

  const handleSelectCaseAndNavigate = (caseData: PatientCase) => {
    setActiveCase(caseData);
    // Smooth scroll to viewer
    const viewerEl = document.getElementById('viewer');
    if (viewerEl) {
      viewerEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <LogoProvider>
      <div className="min-h-screen bg-[#F9F8F3] text-[#1A1F24] selection:bg-[#3D7068] selection:text-white flex flex-col">
        {/* Persistent Enterprise Medical Navigation Header */}
        <Navbar
          onOpenScanModal={() => setIsScanModalOpen(true)}
          onOpenReportModal={() => handleOpenReport()}
          onOpenHospitalModal={() => setIsHospitalModalOpen(true)}
        />

        {/* Main Commercial Application Flow */}
        <main className="flex-grow">
          {/* Executive Overview & Interactive Live Slice Preview */}
          <HeroSection
            onOpenScanModal={() => setIsScanModalOpen(true)}
            onOpenReportModal={() => handleOpenReport()}
            onOpenHospitalModal={() => setIsHospitalModalOpen(true)}
            activeCase={activeCase}
          />

          {/* 3-Tier Enterprise Clinical Pipeline (Preprocess, Adapt, Report) */}
          <PipelineSection onRequestPrototype={() => setIsHospitalModalOpen(true)} />

          {/* Interactive Diagnostic Workstation & Volumetric Analysis */}
          <MriViewer
            onOpenReportModal={handleOpenReport}
            onOpenScanModal={() => setIsScanModalOpen(true)}
          />
        </main>

        {/* Enterprise Medical Footer */}
        <Footer
          onOpenScanModal={() => setIsScanModalOpen(true)}
          onOpenReportModal={() => handleOpenReport()}
        />

        {/* Interactive Modals */}
        <RunScanModal
          isOpen={isScanModalOpen}
          onClose={() => setIsScanModalOpen(false)}
          onSelectCaseAndNavigate={handleSelectCaseAndNavigate}
          onOpenReportModal={(c) => {
            setIsScanModalOpen(false);
            handleOpenReport(c);
          }}
        />

        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          caseData={reportCase}
        />

        {/* Hospital Deployment & Clinical Procurement Modal */}
        <HospitalDeploymentModal
          isOpen={isHospitalModalOpen}
          onClose={() => setIsHospitalModalOpen(false)}
        />
      </div>
    </LogoProvider>
  );
}
