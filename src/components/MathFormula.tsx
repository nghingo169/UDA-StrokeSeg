import React, { useMemo } from 'react';
import katex from 'katex';

interface MathFormulaProps {
  math: string;
  block?: boolean;
  className?: string;
}

export const MathFormula: React.FC<MathFormulaProps> = ({
  math,
  block = false,
  className = '',
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode: block,
        throwOnError: false,
      });
    } catch {
      return math;
    }
  }, [math, block]);

  return (
    <span
      className={`${block ? 'block overflow-x-auto py-1 text-center' : 'inline-block align-middle'} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

// Helper component that renders text containing $math$ delimiters or raw LaTeX inline
export const FormattedMathText: React.FC<{ text: string; className?: string }> = ({
  text,
  className = '',
}) => {
  const parts = useMemo(() => {
    // Split by single dollar sign $...$
    const segments = text.split(/(\$[^$]+\$)/g);
    return segments.map((seg, idx) => {
      if (seg.startsWith('$') && seg.endsWith('$') && seg.length > 2) {
        const mathContent = seg.slice(1, -1);
        return (
          <MathFormula
            key={idx}
            math={mathContent}
            block={false}
            className="px-0.5"
          />
        );
      }
      return <span key={idx}>{seg}</span>;
    });
  }, [text]);

  return <span className={className}>{parts}</span>;
};
