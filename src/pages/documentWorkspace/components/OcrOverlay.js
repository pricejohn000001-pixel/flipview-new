import React, { useEffect, useMemo } from 'react';
import styles from '../documentWorkspace.module.css';
import { useOcrApi } from '../context/DocumentWorkspaceContext';

const OcrOverlay = () => {
  const { isRunning, isClippingRunning, progress, results } = useOcrApi();

  useEffect(() => {
    if (!results) return;
    console.log('OCR results updated:', results);
  }, [results]);

  const overallProgress = useMemo(() => {
    const entries = Object.values(progress || {});
    if (!entries.length) return 0;
    const total = entries.reduce((sum, entry) => sum + (entry?.progress || 0), 0);
    return Math.round(total / entries.length);
  }, [progress]);

  if (!isRunning || isClippingRunning) {
    return null;
  }

  return (
    <div className={styles.ocrLoadingOverlay}>
      <div className={styles.ocrLoadingContent}>
        <p>Processing document with OCR...</p>
        {Object.keys(progress || {}).length > 0 && (
          <div className={styles.ocrProgressContainer}>
            <div className={styles.ocrProgressBar}>
              <div className={styles.ocrProgressBarFill} style={{ width: `${overallProgress}%` }} />
            </div>
            <p className={styles.ocrProgressText}>{overallProgress}%</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OcrOverlay;

