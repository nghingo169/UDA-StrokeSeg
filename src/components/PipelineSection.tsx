import React from 'react';

interface PipelineSectionProps {
  onRequestPrototype?: () => void;
}

export const PipelineSection: React.FC<PipelineSectionProps> = ({
  onRequestPrototype,
}) => {
  return (
    <section id="methodology" className="pt-8 pb-20 px-6 sm:px-8 max-w-7xl mx-auto border-t border-stone-200">
      {/* 3-Column Pipeline Strip matching Image 2 top */}
      <div className="grid md:grid-cols-3 gap-8 sm:gap-12 pt-6 mb-16">
        {/* Col 01 */}
        <div className="border-t-2 border-stone-900 pt-4">
          <span className="text-xs font-mono text-stone-500 uppercase tracking-wider block mb-2">
            01 / PREPROCESS
          </span>
          <h3 className="text-xl font-bold font-sans text-stone-900 mb-2">
            Standardize the volume
          </h3>
          <p className="text-sm text-stone-600 leading-relaxed">
            Skull-strip, normalize intensity, resample, register to the MNI atlas.
          </p>
        </div>

        {/* Col 02 */}
        <div className="border-t-2 border-stone-900 pt-4">
          <span className="text-xs font-mono text-stone-500 uppercase tracking-wider block mb-2">
            02 / ADAPT
          </span>
          <h3 className="text-xl font-bold font-sans text-stone-900 mb-2">
            Align across centers
          </h3>
          <p className="text-sm text-stone-600 leading-relaxed">
            Atlas-anchored contrastive alignment with boundary hard negatives.
          </p>
        </div>

        {/* Col 03 */}
        <div className="border-t-2 border-stone-900 pt-4">
          <span className="text-xs font-mono text-stone-500 uppercase tracking-wider block mb-2">
            03 / REPORT
          </span>
          <h3 className="text-xl font-bold font-sans text-stone-900 mb-2">
            Quantify and export
          </h3>
          <p className="text-sm text-stone-600 leading-relaxed">
            Overlays, lesion volume in mL, lesion count, laterality, PDF and CSV.
          </p>
        </div>
      </div>

      {/* Evaluation Protocol Dark Banner matching Image 2 middle */}
      <div id="protocol" className="bg-[#12161C] text-white p-8 sm:p-12 mb-8">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          {/* Left Column */}
          <div className="lg:col-span-5">
            <span className="text-[11px] font-mono tracking-[0.25em] text-stone-400 uppercase block mb-3">
              EVALUATION PROTOCOL
            </span>
            <h3 className="text-3xl sm:text-4xl font-serif text-white font-normal leading-tight">
              ISLES 2022, center-held-out
            </h3>
          </div>

          {/* Right Metrics Grid matching Image 2 */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
            <div>
              <div className="text-2xl sm:text-3xl font-serif text-white mb-1">
                DSC
              </div>
              <div className="text-xs text-stone-400 font-sans">
                Dice similarity
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-serif text-white mb-1">
                HD95
              </div>
              <div className="text-xs text-stone-400 font-sans">
                Boundary error
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-serif text-white mb-1">
                AVD
              </div>
              <div className="text-xs text-stone-400 font-sans">
                Volume difference
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-serif text-white mb-1">
                F1
              </div>
              <div className="text-xs text-stone-400 font-sans">
                Lesion-wise
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action matching Image 2 */}
      {onRequestPrototype && (
        <div className="flex justify-end pt-4">
          <button
            onClick={onRequestPrototype}
            className="px-8 py-3.5 bg-[#3D7068] hover:bg-[#315a53] text-white font-sans text-sm font-medium transition cursor-pointer"
          >
            Request the prototype
          </button>
        </div>
      )}
    </section>
  );
};
