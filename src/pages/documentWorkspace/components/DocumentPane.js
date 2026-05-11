import React, { useMemo, useEffect, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { MdBookmark, MdChat } from 'react-icons/md';
import demoPdf from '../../../assets/ww.pdf';
import styles from '../documentWorkspace.module.css';
import {
  DEFAULT_BRUSH_OPACITY,
  DEFAULT_BRUSH_SIZE,
  WORKSPACE_ERASER_TOOL_ID,
  WORKSPACE_RESIZER_WIDTH,
} from '../constants';
import { useDocumentApi, useClippingsApi, useWorkspaceApi } from '../context/DocumentWorkspaceContext';
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
    isPdfOutOfViewport,
    handleAnnotationClick, // Destructure new handler
  } = useDocumentApi();

  const { items: clippings } = useClippingsApi();
  const { comments: workspaceComments } = useWorkspaceApi();

  const [activeNoteId, setActiveNoteId] = useState(null);

  // Close active note when clicking elsewhere
  useEffect(() => {
    if (!activeNoteId) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest(`.${styles.noteBadge}`)) {
        setActiveNoteId(null);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [activeNoteId]);

  const handleNoteClick = (e, annotationId) => {
    // If it was a drag, don't toggle
    if (e.pointerType === 'touch') {
      e.preventDefault();
      e.stopPropagation();
      setActiveNoteId(prev => (prev === annotationId ? null : annotationId));
    }
  };

  const handleNoteWheel = (e) => {
    // Stop propagation to prevent the PDF viewer from scrolling
    // when the mouse is over the note tooltip
    e.stopPropagation();
  };

  const handleContainerWheel = (e) => {
    // If we are scrolling inside a noteBadge tooltip, prevent the container from scrolling
    if (e.target.closest(`.${styles.noteBadge}`)) {
      // Check if the target is actually scrollable and needs to scroll
      const tooltip = e.target.closest(`.${styles.noteBadge}`);
      if (tooltip) {
        // We stop propagation here as well to be safe
        e.stopPropagation();
      }
    }
  };

  const annotationsToRender = useMemo(
    () => {
      // Map clippings to highlight annotations
      const clippingHighlights = clippings
        .filter(c => c.sourcePage && (c.sourceRect || (c.sourceRects && c.sourceRects.length > 0)))
        .map(c => ({
          id: `clip-highlight-${c.id}`,
          type: 'highlight',
          pageNumber: c.sourcePage,
          color: c.color || '#fbbf24', // Fallback color
          // Use multi-rects if available, otherwise single valid position
          ...(c.sourceRects && c.sourceRects.length > 0
            ? { rects: c.sourceRects }
            : { position: c.sourceRect }),
          isSearchHighlight: false,
          opacity: 0.3, // Consistent opacity
        }));

      // Map workspace comments to highlight annotations
      const commentHighlights = workspaceComments
        .filter(c => c.sourceRect && c.pageNumber)
        .map(c => ({
          id: `comment-highlight-${c.id}`,
          type: 'highlight',
          pageNumber: c.pageNumber,
          color: c.color || '#facc15', // Fallback color
          // Use multi-rects if available
          ...(c.sourceRects && c.sourceRects.length > 0
            ? { rects: c.sourceRects }
            : { position: c.sourceRect }),
          isSearchHighlight: false,
          opacity: 0.3,
        }));

      return [...filteredAnnotations, ...searchHighlights, ...clippingHighlights, ...commentHighlights];
    },
    [filteredAnnotations, searchHighlights, clippings, workspaceComments],
  );

  // Local state for PDF document to access page metadata
  const [pdfDocument, setPdfDocument] = useState(null);

  const handleDocumentLoadSuccess = (pdf) => {
    setPdfDocument(pdf);
    if (onContextDocumentLoadSuccess) {
      onContextDocumentLoadSuccess(pdf);
    }
  };

  // PDF URL and ID from sessionStorage
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfId, setPdfId] = useState(null);

  // Read PDF URL and ID from sessionStorage on mount
  useEffect(() => {
    const url = sessionStorage.getItem('pdfUrl');
    const id = sessionStorage.getItem('pdfId');

    if (url) setPdfUrl(url);
    if (id) setPdfId(id);
  }, []);

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
      onWheel={handleContainerWheel}
      style={{ paddingRight: `${Math.max(documentRightPadding, WORKSPACE_RESIZER_WIDTH)}px` }}
    >
      <div
        ref={viewerZoomWrapperRef}
        className={`${styles.viewerZoomWrapper} ${isPdfOutOfViewport ? styles.viewerZoomWrapperLeftAligned : ''
          }`}
      >
        <Document file={demoPdf} onLoadSuccess={handleDocumentLoadSuccess}>
          <section
            className={styles.multiPageContainer}
          >
            {Array.from({ length: numPages || 0 }, (_, index) => {
              const pageNumber = index + 1;

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
                    >
                      <Page
                        pageNumber={pageNumber}
                        scale={primaryScale}
                        renderTextLayer={true}
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
                                    style={{ pointerEvents: 'visiblePainted', cursor: 'pointer' }}
                                    onClick={(e) => {
                                      if (activeTool === 'select') {
                                        // e.stopPropagation(); // Optional: stop propergation if needed
                                        handleAnnotationClick && handleAnnotationClick(annotation);
                                      }
                                    }}
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
                                    style={{ pointerEvents: 'visiblePainted', cursor: 'pointer' }}
                                    onClick={(e) => {
                                      if (activeTool === 'select') {
                                        handleAnnotationClick && handleAnnotationClick(annotation);
                                      }
                                    }}
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
                              <g>
                                {/* Background fill */}
                                <rect
                                  x={`${Math.min(drawingState.lastPoint?.x || drawingState.start.x, drawingState.start.x) * 100}%`}
                                  y={`${Math.min(drawingState.lastPoint?.y || drawingState.start.y, drawingState.start.y) * 100}%`}
                                  width={`${Math.abs((drawingState.lastPoint?.x || drawingState.start.x) - drawingState.start.x) * 100}%`}
                                  height={`${Math.abs((drawingState.lastPoint?.y || drawingState.start.y) - drawingState.start.y) * 100}%`}
                                  fill="rgba(212, 175, 55, 0.15)"
                                />
                                
                                {/* Dashed border */}
                                <rect
                                  className={styles.clipBorder}
                                  x={`${Math.min(drawingState.lastPoint?.x || drawingState.start.x, drawingState.start.x) * 100}%`}
                                  y={`${Math.min(drawingState.lastPoint?.y || drawingState.start.y, drawingState.start.y) * 100}%`}
                                  width={`${Math.abs((drawingState.lastPoint?.x || drawingState.start.x) - drawingState.start.x) * 100}%`}
                                  height={`${Math.abs((drawingState.lastPoint?.y || drawingState.start.y) - drawingState.start.y) * 100}%`}
                                  fill="none"
                                  stroke="#d4af37"
                                  strokeWidth="1"
                                  strokeDasharray="5,5"
                                />
                              </g>
                            )}
                        </svg>

                        {annotationsToRender
                          .filter((annotation) => annotation.pageNumber === pageNumber && annotation.type === 'comment')
                          .map((annotation) => (
                            <button
                              key={annotation.id}
                              type="button"
                              className={styles.noteBadge}
                              data-position-y={annotation.position.y < 0.2 ? 'top' : annotation.position.y > 0.8 ? 'bottom' : 'middle'}
                              data-position-x={annotation.position.x > 0.7 ? 'right' : 'left'}
                              data-active={activeNoteId === annotation.id}
                              style={{
                                left: `${annotation.position.x * 100}%`,
                                top: `${annotation.position.y * 100}%`,
                                backgroundColor: annotation.color,
                              }}
                              onClick={(e) => handleNoteClick(e, annotation.id)}
                              onPointerDown={(event) => handleStartDraggingNote(event, annotation)}
                              onWheel={handleNoteWheel}
                              title={annotation.linkedText ? `Linked: ${annotation.linkedText}` : 'Note'}
                              data-content={annotation.content}
                            >
                              <MdChat size={14} />
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
