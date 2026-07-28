import React from 'react';

type ReportPageProps = {
  isDarkMode: boolean;
  isFitToScreen: boolean;
  onToggleFitToScreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPrint: () => void;
  children: React.ReactNode;
};

export function ReportPage({
  isDarkMode,
  isFitToScreen,
  onToggleFitToScreen,
  onZoomIn,
  onZoomOut,
  onPrint,
  children,
}: ReportPageProps) {
  return (
    <div
      className="w-full h-screen overflow-auto flex flex-col transition-colors duration-200"
      style={{ background: isDarkMode ? '#0f172a' : '#f1f5f9' }}
    >
      <div className="w-full mb-4 sticky top-0 z-50">
        <div className="print-toolbar">
          <button className="toolbar-btn" onClick={onToggleFitToScreen}>
            {isFitToScreen ? 'Normal View' : 'Fit to Screen'}
          </button>
          <button className="toolbar-btn" onClick={onZoomIn}>Zoom In</button>
          <button className="toolbar-btn" onClick={onZoomOut}>Zoom Out</button>
          <button className="toolbar-btn" onClick={onPrint}>Print / Save as PDF</button>
        </div>
      </div>

      <div
        id="zoomWrapper"
        className={`bg-white shadow-2xl rounded-sm flex flex-col gap-8 transition-transform duration-200 ${
          isFitToScreen
            ? 'max-w-5xl mx-auto px-6'
            : 'max-w-full mx-auto px-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}