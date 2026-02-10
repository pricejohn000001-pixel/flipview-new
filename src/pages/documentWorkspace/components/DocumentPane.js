import React, { useMemo, useEffect, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { MdBookmark } from 'react-icons/md';
import demoPdf from '../../../assets/WPC.pdf';
import styles from '../documentWorkspace.module.css';
import {
  DEFAULT_BRUSH_OPACITY,
  DEFAULT_BRUSH_SIZE,
  WORKSPACE_ERASER_TOOL_ID,
  WORKSPACE_RESIZER_WIDTH,
} from '../constants';
import { useDocumentApi } from '../context/DocumentWorkspaceContext';
import OcrTextLayer from './OcrTextLayer';

const drawingTools = ['highlight', 'freehand', 'bookmark', 'clip', 'comment', WORKSPACE_ERASER_TOOL_ID];

const DocumentPane = () => {
  const {
    numPages,
    onDocumentLoadSuccess: onContextDocumentLoadSuccess,
    viewerZoomWrapperRef,
    overlayRefs,
    pageRefs,
    primaryScale,
    activeTool,
    activeColor,
    filteredAnnotations,
    searchHighlights = [],
    drawingState,
    liveFreehandOpacity,
    liveFreehandStrokeWidth,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleStartDraggingNote,
    handleStartDraggingBookmark,
    bookmarks,
    documentRightPadding,
    isHighlightView,
    highlightBoundsPerPage,
    isPdfOutOfViewport,
  } = useDocumentApi();

  const annotationsToRender = useMemo(
    () => [...filteredAnnotations, ...searchHighlights],
    [filteredAnnotations, searchHighlights],
  );

  // Local state for PDF document to access page metadata
  const [pdfDocument, setPdfDocument] = useState(null);
  
  const handleDocumentLoadSuccess = (pdf) => {
    setPdfDocument(pdf);
    if (onContextDocumentLoadSuccess) {
      onContextDocumentLoadSuccess(pdf);
    }
  };

  // Virtualization: track which pages are near the viewport
  const [visiblePages, setVisiblePages] = useState(() => new Set());
  // Pre-calculated page heights based on PDF metadata (at scale 1.0)
  const [pageUnscaledHeights, setPageUnscaledHeights] = useState({});

  // Calculate unscaled page heights immediately upon load
  useEffect(() => {
    if (!pdfDocument || !numPages) return;

    let isMounted = true;
    
    const calculateHeights = async () => {
      try {
        const MAX_PAGES_TO_MEASURE = 200; 
        
        const heights = {};
        
        // Measure page 1 at scale 1.0
        const page1 = await pdfDocument.getPage(1);
        const viewport1 = page1.getViewport({ scale: 1 });
        const defaultHeight = viewport1.height;
        
        // Fill all with default first
        for (let i = 1; i <= numPages; i++) {
          heights[i] = defaultHeight;
        }

        // If not too many pages, measure individually
        if (numPages <= MAX_PAGES_TO_MEASURE) {
            const promises = [];
            for (let i = 2; i <= numPages; i++) {
                promises.push(pdfDocument.getPage(i).then(p => ({
                    pageNumber: i,
                    height: p.getViewport({ scale: 1 }).height
                })));
            }
            
            const results = await Promise.all(promises);
            if (!isMounted) return;
            
            results.forEach(r => {
                heights[r.pageNumber] = r.height;
            });
        }
        
        if (isMounted) {
            setPageUnscaledHeights(heights);
        }
      } catch (err) {
        console.error("Error calculating page heights:", err);
      }
    };

    calculateHeights();

    return () => { isMounted = false; };
  }, [pdfDocument, numPages]); // Removed primaryScale dependency!

  useEffect(() => {
    const root = viewerZoomWrapperRef.current;
    if (!root || !numPages) return;

    let rafId = null;
    const pending = new Set(visiblePages);
    const commit = () => {
      rafId = null;
      const changed = pending.size !== visiblePages.size || [...pending].some((p) => !visiblePages.has(p));
      if (changed) setVisiblePages(new Set(pending));
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const pageNumAttr = entry.target.getAttribute('data-page-number');
          const pageNumber = pageNumAttr ? parseInt(pageNumAttr, 10) : null;
          if (!pageNumber) continue;
          if (entry.isIntersecting) {
            pending.add(pageNumber);
          } else {
            // Hysteresis: only remove if fully outside without margin
            pending.delete(pageNumber);
          }
        }
        if (!rafId) rafId = requestAnimationFrame(commit);
      },
      {
        root,
        rootMargin: '150% 0px',
        threshold: 0,
      }
    );

    // Observe all page wrappers
    const nodes = [];
    for (let i = 1; i <= (numPages || 0); i++) {
      const node = pageRefs.current?.[i];
      if (node) {
        observer.observe(node);
        nodes.push(node);
      }
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      nodes.forEach((n) => observer.unobserve(n));
      observer.disconnect();
    };
  }, [viewerZoomWrapperRef, pageRefs, numPages, visiblePages]);

  return (
    <div
      className={styles.documentPane}
      style={{ paddingRight: `${Math.max(documentRightPadding, WORKSPACE_RESIZER_WIDTH)}px` }}
    >
      <div
        ref={viewerZoomWrapperRef}
        className={`${styles.viewerZoomWrapper} ${
          isPdfOutOfViewport ? styles.viewerZoomWrapperLeftAligned : ''
        }`}
      >
        <Document file={demoPdf} onLoadSuccess={handleDocumentLoadSuccess}>
          <section
            className={styles.multiPageContainer}
            data-highlight-view={isHighlightView ? 'true' : undefined}
            style={
              isHighlightView
                ? { '--crop-progress': highlightBoundsPerPage?.avgCropProgress || 0 }
                : undefined
            }
          >
            {Array.from({ length: numPages || 0 }, (_, index) => {
              const pageNumber = index + 1;
              const hasPageHighlights = highlightBoundsPerPage?.bounds?.[pageNumber]?.hasHighlights;
              if (isHighlightView && !hasPageHighlights) {
                return null;
              }

              const pageBounds = highlightBoundsPerPage?.bounds?.[pageNumber];
              const highlightStyle =
                isHighlightView && pageBounds?.hasHighlights
                  ? (() => {
                      const style = {
                        clipPath: `inset(${pageBounds.clipTop}% 0% ${pageBounds.clipBottom}% 0%)`,
                        transition:
                          'clip-path 0.4s cubic-bezier(0.4, 0, 0.2, 1), -webkit-mask-image 0.4s cubic-bezier(0.4, 0, 0.2, 1), mask-image 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      };
                      if (pageBounds.maskImage && pageBounds.maskStrength > 0) {
                        style.WebkitMaskImage = pageBounds.maskImage;
                        style.maskImage = pageBounds.maskImage;
                        style.WebkitMaskComposite = 'source-in';
                        style.maskComposite = 'intersect';
                      }
                      return style;
                    })()
                  : undefined;

              // Use pre-calculated height or a fallback estimate
              const heightStyle = pageUnscaledHeights[pageNumber] 
                ? `${pageUnscaledHeights[pageNumber] * primaryScale}px` 
                : `${Math.round(800 * primaryScale)}px`; // Fallback while loading

              return (
                <div
                  key={pageNumber}
                  ref={(node) => {
                    if (node) pageRefs.current[pageNumber] = node;
                  }}
                  className={styles.pageWrapper}
                  data-page-number={pageNumber}
                  style={{ minHeight: heightStyle, height: heightStyle }} 
                >
                  {visiblePages.has(pageNumber) ? (
                    <div
                      className={styles.viewerCanvas}
                      data-highlight-view={
                        isHighlightView && hasPageHighlights ? 'true' : undefined
                      }
                      style={highlightStyle}
                    >
                      <Page
                        pageNumber={pageNumber}
                        scale={primaryScale}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        className={styles.pdfPage}
                        data-drawing-active={
                          drawingTools.includes(activeTool) ? 'true' : undefined
                        }
                      />

                      <OcrTextLayer pageNumber={pageNumber} pageScale={primaryScale} />
                      <div
                        ref={(node) => {
                          if (node) overlayRefs.current[pageNumber] = node;
                        }}
                        className={styles.annotationOverlay}
                        data-overlay
                        data-drawing-tool={
                          drawingTools.includes(activeTool) ? 'true' : undefined
                        }
                        onPointerDown={(event) => handlePointerDown(event, pageNumber, pageNumber)}
                        onPointerMove={(event) => handlePointerMove(event, pageNumber, pageNumber)}
                        onPointerUp={(event) => handlePointerUp(event, pageNumber, pageNumber)}
                      >
                        <svg className={styles.annotationSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
                          {annotationsToRender
                            .filter((annotation) => annotation.pageNumber === pageNumber && annotation.type !== 'comment')
                            .map((annotation) => {
                              if (annotation.type === 'highlight' && annotation.rects) {
                                const rectClassName = annotation.isSearchHighlight
                                  ? `${styles.highlightRect} ${styles.searchHighlightRect}`
                                  : styles.highlightRect;
                                return annotation.rects.map((rect, idx) => (
                                  <rect
                                    key={`${annotation.id}-rect-${idx}`}
                                    className={rectClassName}
                                    x={`${rect.x * 100}%`}
                                    y={`${rect.y * 100}%`}
                                    width={`${rect.width * 100}%`}
                                    height={`${rect.height * 100}%`}
                                    fill={annotation.color}
                                    opacity={annotation.isSearchHighlight ? 0.95 : 0.3}
                                  />
                                ));
                              }
                              if (annotation.type === 'highlight' && annotation.position) {
                                const { x, y, width, height } = annotation.position;
                                const rectClassName = annotation.isSearchHighlight
                                  ? `${styles.highlightRect} ${styles.searchHighlightRect}`
                                  : styles.highlightRect;
                                return (
                                  <rect
                                    key={annotation.id}
                                    className={rectClassName}
                                    x={`${x * 100}%`}
                                    y={`${y * 100}%`}
                                    width={`${width * 100}%`}
                                    height={`${height * 100}%`}
                                    fill={annotation.color}
                                    opacity={annotation.isSearchHighlight ? 0.95 : 1}
                                  />
                                );
                              }
                              if ((annotation.type === 'underline' || annotation.type === 'strike') && annotation.lines) {
                                return annotation.lines.map((line, idx) => (
                                  <line
                                    key={`${annotation.id}-line-${idx}`}
                                    className={
                                      annotation.type === 'underline'
                                        ? styles.underlineLine
                                        : styles.strikeLine
                                    }
                                    x1={`${line.x1 * 100}%`}
                                    y1={`${line.y1 * 100}%`}
                                    x2={`${line.x2 * 100}%`}
                                    y2={`${line.y2 * 100}%`}
                                    stroke={annotation.color}
                                    vectorEffect="non-scaling-stroke"
                                  />
                                ));
                              }
                              if (annotation.type === 'freehand') {
                                const points = annotation.points.map((point) => `${point.x * 100},${point.y * 100}`).join(' ');
                                const strokeWidthValue = annotation.strokeWidth || DEFAULT_BRUSH_SIZE;
                                const strokeOpacityValue =
                                  typeof annotation.opacity === 'number'
                                    ? annotation.opacity
                                    : DEFAULT_BRUSH_OPACITY;
                                return (
                                  <polyline
                                    key={annotation.id}
                                    className={styles.freehandPath}
                                    points={points}
                                    stroke={annotation.color}
                                    strokeOpacity={strokeOpacityValue}
                                    style={{ '--freehand-stroke-width': `${strokeWidthValue}` }}
                                    vectorEffect="non-scaling-stroke"
                                  />
                                );
                              }
                              return null;
                            })}

                          {drawingState?.type === 'freehand' &&
                            drawingState.pageNumber === pageNumber &&
                            drawingState.points?.length > 1 && (
                              <polyline
                                className={styles.freehandPath}
                                points={drawingState.points
                                  .map((point) => `${point.x * 100},${point.y * 100}`)
                                  .join(' ')}
                                stroke={activeColor}
                                strokeOpacity={liveFreehandOpacity ?? DEFAULT_BRUSH_OPACITY}
                                style={{
                                  '--freehand-stroke-width': `${liveFreehandStrokeWidth || DEFAULT_BRUSH_SIZE}`,
                                }}
                                vectorEffect="non-scaling-stroke"
                              />
                            )}

                          {drawingState?.type === 'highlight' &&
                            drawingState.pageNumber === pageNumber &&
                            drawingState.start && (
                              <rect
                                className={styles.highlightRect}
                                x={`${Math.min(drawingState.lastPoint?.x || drawingState.start.x, drawingState.start.x) * 100}%`}
                                y={`${Math.min(drawingState.lastPoint?.y || drawingState.start.y, drawingState.start.y) * 100}%`}
                                width={`${Math.abs((drawingState.lastPoint?.x || drawingState.start.x) - drawingState.start.x) * 100}%`}
                                height={`${Math.abs((drawingState.lastPoint?.y || drawingState.start.y) - drawingState.start.y) * 100}%`}
                                fill={activeColor}
                              />
                            )}

                          {drawingState?.type === 'clip' &&
                            drawingState.pageNumber === pageNumber &&
                            drawingState.start && (
                              <rect
                                className={styles.highlightRect}
                                x={`${Math.min(drawingState.lastPoint?.x || drawingState.start.x, drawingState.start.x) * 100}%`}
                                y={`${Math.min(drawingState.lastPoint?.y || drawingState.start.y, drawingState.start.y) * 100}%`}
                                width={`${Math.abs((drawingState.lastPoint?.x || drawingState.start.x) - drawingState.start.x) * 100}%`}
                                height={`${Math.abs((drawingState.lastPoint?.y || drawingState.start.y) - drawingState.start.y) * 100}%`}
                                fill="rgba(59, 130, 246, 0.2)"
                                stroke="rgba(59, 130, 246, 0.8)"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                              />
                            )}
                        </svg>

                        {annotationsToRender
                          .filter((annotation) => annotation.pageNumber === pageNumber && annotation.type === 'comment')
                          .map((annotation) => (
                            <button
                              key={annotation.id}
                              type="button"
                              className={styles.noteBadge}
                              style={{
                                left: `${annotation.position.x * 100}%`,
                                top: `${annotation.position.y * 100}%`,
                                backgroundColor: annotation.color,
                              }}
                              onPointerDown={(event) => handleStartDraggingNote(event, annotation)}
                              title={annotation.linkedText ? `Linked: ${annotation.linkedText}` : 'Note'}
                            >
                              <strong>Note</strong> {annotation.content}
                            </button>
                          ))}

                        {bookmarks
                          .filter((bookmark) => bookmark.pageNumber === pageNumber)
                          .map((bookmark) => (
                            <div
                              key={bookmark.id}
                              className={styles.bookmarkFlag}
                              style={{
                                left: `${bookmark.position.x * 100}%`,
                                top: `${bookmark.position.y * 100}%`,
                                backgroundColor: bookmark.color,
                                cursor: activeTool === 'select' ? 'grab' : 'default',
                              }}
                              onPointerDown={(event) => handleStartDraggingBookmark(event, bookmark)}
                              title={bookmark.note || 'Bookmark'}
                            >
                              <MdBookmark size={18} color="white" />
                              {bookmark.note && <span className={styles.bookmarkNote}>{bookmark.note}</span>}
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </section>
        </Document>
      </div>
    </div>
  );
};

export default DocumentPane;
