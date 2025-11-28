import React, { useRef, useEffect } from 'react';
import styles from '../documentWorkspace.module.css';
import { useOcrApi } from '../context/DocumentWorkspaceContext';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

let measureCtx = null;
const getMeasureContext = () => {
  if (measureCtx || typeof document === 'undefined') return measureCtx;
  const canvas = document.createElement('canvas');
  measureCtx = canvas.getContext('2d');
  return measureCtx;
};

// Group words into lines based on y-coordinates
const groupWordsByLines = (words) => {
  if (!words || words.length === 0) return [];
  
  // Sort words by y position (top to bottom), then by x position (left to right)
  const sortedWords = [...words]
    .filter(w => w.text && w.bbox)
    .map((word, idx) => ({ ...word, originalIdx: idx }))
    .sort((a, b) => {
      const yDiff = a.bbox.y0 - b.bbox.y0;
      if (Math.abs(yDiff) > 0.01) return yDiff; // Different lines
      return a.bbox.x0 - b.bbox.x0; // Same line, sort by x
    });

  if (sortedWords.length === 0) return [];

  // Group words into lines (words with similar y-coordinates)
  const lines = [];
  let currentLine = [sortedWords[0]];
  const LINE_THRESHOLD = 0.015; // Threshold for considering words on the same line

  for (let i = 1; i < sortedWords.length; i++) {
    const prevWord = sortedWords[i - 1];
    const currWord = sortedWords[i];
    const yDiff = Math.abs(currWord.bbox.y0 - prevWord.bbox.y0);
    
    if (yDiff <= LINE_THRESHOLD) {
      // Same line
      currentLine.push(currWord);
    } else {
      // New line
      lines.push(currentLine);
      currentLine = [currWord];
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
};

const OcrTextLayer = ({ pageNumber, pageScale = 1 }) => {
  const { results } = useOcrApi();
  const pageResult = results?.[pageNumber];
  const layerRef = useRef(null);

  // Calculate lines before early return to ensure hooks are always called in same order
  const lines = pageResult && !pageResult.isPdfText && pageResult.words?.length
    ? groupWordsByLines(pageResult.words)
    : [];

  // Handle copy event to reconstruct text with proper spacing
  // This hook must be called before any early returns
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !lines.length) return;

    const handleCopy = (e) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      // Check if selection is within this OCR layer
      if (!layer.contains(range.commonAncestorContainer)) return;

      // Find which words are selected by checking if their text nodes are in the range
      const selectedWordIndices = new Set();
      const wordElements = layer.querySelectorAll(`.${styles.ocrWord}`);
      
      wordElements.forEach((wordEl) => {
        const textNode = wordEl.querySelector(`.${styles.ocrWordInner}`);
        if (textNode && range.intersectsNode(textNode)) {
          const lineIdx = wordEl.getAttribute('data-line-index');
          const wordIdx = wordEl.getAttribute('data-word-index');
          if (lineIdx !== null && wordIdx !== null) {
            selectedWordIndices.add(`${lineIdx}-${wordIdx}`);
          }
        }
      });

      if (selectedWordIndices.size === 0) return;

      // Reconstruct text using the grouped lines structure
      let reconstructedText = '';
      lines.forEach((line, lineIdx) => {
        let lineText = '';
        line.forEach((word, wordIdx) => {
          const key = `${lineIdx}-${wordIdx}`;
          if (selectedWordIndices.has(key)) {
            if (lineText) lineText += ' ';
            lineText += word.text;
          }
        });
        if (lineText) {
          if (reconstructedText) reconstructedText += '\n';
          reconstructedText += lineText;
        }
      });

      if (reconstructedText) {
        e.clipboardData.setData('text/plain', reconstructedText);
        e.preventDefault();
      }
    };

    layer.addEventListener('copy', handleCopy);
    return () => {
      layer.removeEventListener('copy', handleCopy);
    };
  }, [lines, styles.ocrWord, styles.ocrWordInner]);

  // Only render for pages that were OCR'd (no native PDF text layer)
  if (!pageResult || pageResult.isPdfText || !pageResult.words?.length) {
    return null;
  }

  const metrics = pageResult.metrics || {};
  const baseWidth = metrics.baseWidth || 0;
  const baseHeight = metrics.baseHeight || 0;
  const ocrScale = metrics.ocrScale || 1;
  const displayWidth = baseWidth ? baseWidth * pageScale : null;
  const displayHeight = baseHeight ? baseHeight * pageScale : null;
  const fontScaleFactor = ocrScale ? pageScale / ocrScale : 1;

  return (
    <div ref={layerRef} className={styles.ocrTextLayer}>
      {lines.map((line, lineIdx) => (
        <React.Fragment key={`line-${lineIdx}`}>
          {line.map((word, wordIdx) => {
            if (!word.text || !word.bbox) return null;
            const { x0, x1, y0, y1 } = word.bbox;
            const widthNorm = clamp(x1 - x0, 0, 1);
            const heightNorm = clamp(y1 - y0, 0, 1);
            const left = x0 * 100;
            const top = y0 * 100;
            const width = Math.max(widthNorm * 100, 0.3);
            const height = Math.max(heightNorm * 100, 0.5);

            const targetWidthPx = displayWidth != null ? widthNorm * displayWidth : null;
            const targetHeightPx = displayHeight != null ? heightNorm * displayHeight : null;
            const baseFontSize =
              word.font?.size && fontScaleFactor
                ? word.font.size * fontScaleFactor
                : targetHeightPx || 12;
            const ctx = getMeasureContext();
            let measuredWidth = 0;
            let measuredAscent = baseFontSize * 0.8;
            let measuredDescent = baseFontSize * 0.2;
            if (ctx) {
              ctx.font = `${word.font?.isItalic ? 'italic' : 'normal'} ${word.font?.isBold ? 600 : 400} ${baseFontSize}px ${word.font?.family || 'Times New Roman'}`;
              const metrics = ctx.measureText(word.text || '');
              measuredWidth = metrics.width || 0;
              if (metrics.actualBoundingBoxAscent) {
                measuredAscent = metrics.actualBoundingBoxAscent;
              }
              if (metrics.actualBoundingBoxDescent) {
                measuredDescent = metrics.actualBoundingBoxDescent;
              }
            }
            const glyphHeight = measuredAscent + measuredDescent || baseFontSize;
            const lineHeightPx = glyphHeight;
            const fontFamily = word.font?.family || 'Times New Roman';
            const fontWeight = word.font?.isBold ? 600 : 400;
            const fontStyle = word.font?.isItalic ? 'italic' : 'normal';

            const scaleX =
              targetWidthPx && measuredWidth > 0.01 ? targetWidthPx / measuredWidth : 1;
            const scaleY =
              targetHeightPx && glyphHeight > 0.01 ? targetHeightPx / glyphHeight : 1;
            const transform =
              scaleX !== 1 || scaleY !== 1
                ? `scale(${scaleX}, ${scaleY})`
                : undefined;

            return (
              <React.Fragment key={`word-${word.originalIdx}`}>
                <span
                  className={styles.ocrWord}
                  data-line-index={lineIdx}
                  data-word-index={wordIdx}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                  }}
                >
                  <span
                    className={styles.ocrWordInner}
                    style={{
                      fontFamily,
                      fontWeight,
                      fontStyle,
                      fontSize: `${baseFontSize}px`,
                      lineHeight: `${lineHeightPx}px`,
                      transform,
                      transformOrigin: 'left top',
                    }}
                  >
                    {word.text}
                  </span>
                </span>
              </React.Fragment>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};

export default OcrTextLayer;


