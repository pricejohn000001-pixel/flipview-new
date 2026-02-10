import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import { pdfjs } from 'react-pdf';
import useOcr from './useOcr';
import {
  ANNOTATION_TYPES,
  COLOR_OPTIONS,
  DEFAULT_BRUSH_OPACITY,
  DEFAULT_BRUSH_SIZE,
  WORKSPACE_ERASER_TOOL_ID,
  WORKSPACE_FIXED_WIDTH_PX,
  WORKSPACE_LEFT_STACK_SPREAD,
  WORKSPACE_LEFT_STACK_X,
  WORKSPACE_RESIZER_WIDTH,
  WORKSPACE_SLIDE_MAX,
  WORKSPACE_SLIDE_MIN,
} from '../constants';
import {
  clamp,
  createAnnotationId,
  createBookmarkId,
  createClippingId,
  createWorkspaceItemId,
  getBoundingRectFromPoints,
  getNormalizedPoint,
  getPointerPressure,
  getPrimaryPageFromSource,
  getWorkspaceItemSourceId,
  getWorkspaceItemType,
} from '../utils';

const ERASER_TARGET_TYPES = new Set(['highlight', 'underline', 'strike', 'freehand']);
const DEFAULT_ERASER_PADDING = 0.015;

const pointWithinRect = (point, rect, padding = DEFAULT_ERASER_PADDING) => {
  if (!point || !rect) return false;
  const width = rect.width ?? 0;
  const height = rect.height ?? 0;
  const x0 = (rect.x ?? 0) - padding;
  const y0 = (rect.y ?? 0) - padding;
  const x1 = x0 + width + padding * 2;
  const y1 = y0 + height + padding * 2;
  return point.x >= x0 && point.x <= x1 && point.y >= y0 && point.y <= y1;
};

const distanceSqPointToSegment = (point, a, b) => {
  if (!point || !a || !b) return Number.POSITIVE_INFINITY;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    const diffX = point.x - a.x;
    const diffY = point.y - a.y;
    return diffX * diffX + diffY * diffY;
  }
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1);
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const diffX = point.x - projX;
  const diffY = point.y - projY;
  return diffX * diffX + diffY * diffY;
};

const getNormalizedStrokeThreshold = (strokeWidth, overlayDimensions) => {
  if (overlayDimensions?.width && overlayDimensions?.height) {
    const reference = Math.max(Math.min(overlayDimensions.width, overlayDimensions.height), 1);
    const normalizedWidth = (strokeWidth || DEFAULT_BRUSH_SIZE) / reference;
    return Math.max(normalizedWidth * 1.4, DEFAULT_ERASER_PADDING);
  }
  return DEFAULT_ERASER_PADDING * 1.2;
};

const doesFreehandStrokeHitPoint = (annotation, point, overlayDimensions) => {
  const points = annotation?.points;
  if (!points || points.length < 2) return false;
  const threshold = getNormalizedStrokeThreshold(annotation.strokeWidth, overlayDimensions);
  const thresholdSq = threshold * threshold;
  for (let i = 1; i < points.length; i += 1) {
    if (distanceSqPointToSegment(point, points[i - 1], points[i]) <= thresholdSq) {
      return true;
    }
  }
  return false;
};

const doesLineHitPoint = (line, point, overlayDimensions) => {
  if (!line) return false;
  const threshold = getNormalizedStrokeThreshold(DEFAULT_BRUSH_SIZE / 2, overlayDimensions);
  return distanceSqPointToSegment(point, { x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 }) <= threshold * threshold;
};

const normalizeClippingText = (value) => {
  if (!value) return '';
  const lines = value.replace(/\r/g, '').split('\n');
  const paragraphs = [];
  let current = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current.length) {
        paragraphs.push(current.join(' '));
        current = [];
      }
    } else {
      current.push(trimmed);
    }
  });
  if (current.length) {
    paragraphs.push(current.join(' '));
  }
  return paragraphs.join('\n\n').trim();
};

const doesAnnotationHitPoint = (annotation, point, overlayDimensions) => {
  if (!annotation || !ERASER_TARGET_TYPES.has(annotation.type)) return false;
  if (annotation.type === 'highlight') {
    if (annotation.rects?.some((rect) => pointWithinRect(point, rect))) {
      return true;
    }
    if (annotation.position && pointWithinRect(point, annotation.position)) {
      return true;
    }
    return false;
  }
  if ((annotation.type === 'underline' || annotation.type === 'strike') && annotation.lines?.length) {
    return annotation.lines.some((line) => doesLineHitPoint(line, point, overlayDimensions));
  }
  if (annotation.type === 'freehand') {
    return doesFreehandStrokeHitPoint(annotation, point, overlayDimensions);
  }
  return false;
};

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const useDocumentWorkspaceController = () => {
  // Core PDF state
  const [numPages, setNumPages] = useState(null);
  const [isPdfReady, setIsPdfReady] = useState(false);
  const [primaryPage, setPrimaryPage] = useState(1);

  // base annotation/bookmark state (your existing features)
  const [annotations, setAnnotations] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [annotationFilters, setAnnotationFilters] = useState(() => ANNOTATION_TYPES.reduce((acc, type) => ({ ...acc, [type]: true }), {}));
  const [activeTool, setActiveTool] = useState('select');
  const [activeColor, setActiveColor] = useState(COLOR_OPTIONS[0]);
  const [activeBrushSize, setActiveBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [activeBrushOpacity, setActiveBrushOpacity] = useState(DEFAULT_BRUSH_OPACITY);
  const [freehandMode, setFreehandMode] = useState('straight');
  const [isPressureEnabled, setIsPressureEnabled] = useState(true);
  const [isFreehandPaletteOpen, setIsFreehandPaletteOpen] = useState(false);
  const [isFreehandCommentMode, setIsFreehandCommentMode] = useState(false);
  const [isSearchBarOpen, setIsSearchBarOpen] = useState(false);
  const [isWorkspaceResizing, setIsWorkspaceResizing] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState(null);
  const [isHighlightView, setIsHighlightView] = useState(false);
  const [highlightViewCropZoom, setHighlightViewCropZoom] = useState(1.0); // Separate zoom for cropping, not page scale
  const [isPdfOutOfViewport, setIsPdfOutOfViewport] = useState(false);

  // drawing / clippings / search
  const [drawingState, setDrawingState] = useState(null);
  const [clippings, setClippings] = useState([]); // each clipping: { id, content, createdAt, sourcePage, sourceRect? {x,y,width,height} (normalized) }
  const [selectedClippings, setSelectedClippings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);

  // workspace items for LiquidText-like canvas
  // each: { id, type: 'clip' | 'comment', sourceId, x, y }
  const [workspaceItems, setWorkspaceItems] = useState([]);
  const [workspaceComments, setWorkspaceComments] = useState([]);
  // Initialize tablet detection on first render
  const checkTabletInitial = () => {
    if (typeof window === 'undefined') return false;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return isTouchDevice && width >= 768 && width <= 1400 && (width > height);
  };
  const isTabletInitial = checkTabletInitial();
  const initialPrimaryScale = isTabletInitial ? 0.8 : 1.0;
  const [primaryScale, setPrimaryScale] = useState(initialPrimaryScale);
  const [isTablet, setIsTablet] = useState(isTabletInitial);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(isTabletInitial);
  const [isClippingsPanelCollapsed, setIsClippingsPanelCollapsed] = useState(isTabletInitial);
  // Responsive workspace width (px). Start with a computed value based on
  // viewport but capped at the legacy fixed max.
  const computeWorkspaceWidth = () => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : WORKSPACE_FIXED_WIDTH_PX;
    const max = WORKSPACE_FIXED_WIDTH_PX;
    const min = 320; // minimum usable workspace width
    const desired = Math.min(max, Math.floor(vw * 0.8));
    return Math.max(min, desired);
  };

  const [workspaceWidth, setWorkspaceWidth] = useState(computeWorkspaceWidth);

  // Initialize workspace slide based on the responsive width
  const initialWorkspaceSlide = isTabletInitial
    ? Math.floor(workspaceWidth / 2)
    : Math.floor(workspaceWidth * 0.7);
  const [workspaceSlide, setWorkspaceSlide] = useState(initialWorkspaceSlide);

  // refs
  const pdfProxyRef = useRef(null);
  const overlayRefs = useRef({}); // Now keyed by pageNumber
  const searchRunIdRef = useRef(0);
  const viewerZoomWrapperRef = useRef(null);
  const viewerDeckRef = useRef(null);
  const workspaceResizeMetaRef = useRef({ startX: 0, startSlide: initialWorkspaceSlide });
  
  // Page position tracking for annotation rail
  const [pagePositions, setPagePositions] = useState({}); // { pageNumber: { top, height } }
  const pageRefs = useRef({}); // { pageNumber: DOMElement }

  const {
    ocrResults,
    ocrProgress,
    isOcrRunning,
    isClippingOcrRunning,
    runOcrOnPage,
    runOcrOnAllPages,
    extractTextFromArea,
  } = useOcr({ pdfProxyRef });

  // Update workspaceWidth on viewport resize and clamp slide into bounds
  useEffect(() => {
    const handleResize = () => {
      const w = computeWorkspaceWidth();
      setWorkspaceWidth(w);
      setWorkspaceSlide((prev) => clamp(prev, WORKSPACE_SLIDE_MIN, Math.max(WORKSPACE_SLIDE_MIN, w)));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Tablet detection - typically 768px-1024px width and touch capability
  useEffect(() => {
    const checkTablet = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      // Tablet: width between 768-1400px (or wider in landscape), touch capable, and landscape orientation
      const isTabletDevice = isTouchDevice && width >= 768 && width <= 1400 && (width > height);
      setIsTablet(isTabletDevice);
      
      // Keep panels collapsed for tablets when in landscape
      if (isTabletDevice) {
        setIsRightPanelCollapsed(true);
        setIsClippingsPanelCollapsed(true);
      }
    };
    
    // Check immediately and on resize/orientation change
    checkTablet();
    window.addEventListener('resize', checkTablet);
    window.addEventListener('orientationchange', checkTablet);
    return () => {
      window.removeEventListener('resize', checkTablet);
      window.removeEventListener('orientationchange', checkTablet);
    };
  }, []);

  const handleExtractClipFromArea = useCallback((clipRect, pageNumber) => {
    extractTextFromArea(clipRect, pageNumber).then((result) => {
      if (!result) return;
      const newClip = {
        id: createClippingId(),
        content: result.text,
        createdAt: new Date().toISOString(),
        sourcePage: pageNumber,
        sourceRect: clipRect,
        confidence: result.confidence,
        source: 'OCR',
      };
      setClippings((prev) => [newClip, ...prev]);
      setSelectedClippings([]);
      setActiveTool('select');
      const normalizedY = numPages ? clamp(pageNumber / numPages, 0.08, 0.9) : undefined;
      addClipToWorkspace(newClip.id, { preferredY: normalizedY });
    });
  }, [extractTextFromArea, numPages, addClipToWorkspace]);

  const draggingAnnotationId = useRef(null);
  const draggingAnnotationMetaRef = useRef({ offsetX: 0, offsetY: 0, pageNumber: 1 });
  const draggingBookmarkId = useRef(null);
  const draggingBookmarkMetaRef = useRef({ offsetX: 0, offsetY: 0 });

  const currentSelectionRef = useRef({ text: '', range: null, pageNumber: null });

  // workspace drag/move refs
  const draggingWorkspaceItemId = useRef(null);
  const draggingWorkspaceMetaRef = useRef({ offsetX: 0, offsetY: 0 });

  const dismissFreehandPalette = useCallback(() => {
    setIsFreehandPaletteOpen(false);
  }, []);

  useEffect(() => {
    if (activeTool !== 'freehand') {
      dismissFreehandPalette();
    }
  }, [activeTool, dismissFreehandPalette]);

  useEffect(() => {
    if (!isWorkspaceResizing) return;
    const handleMove = (event) => {
      const { startX, startSlide } = workspaceResizeMetaRef.current;
      const delta = event.clientX - startX;
      const maxSlide = Math.max(WORKSPACE_SLIDE_MIN, workspaceWidth);
      const nextSlide = clamp(startSlide + delta, WORKSPACE_SLIDE_MIN, maxSlide);
      setWorkspaceSlide(nextSlide);
    };
    const stopResizing = () => {
      setIsWorkspaceResizing(false);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stopResizing);
    window.addEventListener('pointercancel', stopResizing);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stopResizing);
      window.removeEventListener('pointercancel', stopResizing);
    };
  }, [isWorkspaceResizing, workspaceWidth]);

  useEffect(() => {
    setDrawingState((prev) => {
      if (!prev || prev.type !== 'freehand') return prev;
      if (prev.brushSize === activeBrushSize) return prev;
      return { ...prev, brushSize: activeBrushSize };
    });
  }, [activeBrushSize]);

  useEffect(() => {
    setDrawingState((prev) => {
      if (!prev || prev.type !== 'freehand') return prev;
      if (prev.opacity === activeBrushOpacity) return prev;
      return { ...prev, opacity: activeBrushOpacity };
    });
  }, [activeBrushOpacity]);

  useEffect(() => {
    setDrawingState((prev) => {
      if (!prev || prev.type !== 'freehand') return prev;
      if (prev.pressureEnabled === isPressureEnabled) return prev;
      return { ...prev, pressureEnabled: isPressureEnabled };
    });
  }, [isPressureEnabled]);

  // Helper to detect which page a selection range belongs to
  const detectSelectionPage = useCallback((range) => {
    if (!range) return null;
    const rect = range.getBoundingClientRect();
    if (!rect || rect.width < 2 || rect.height < 2) return null;
    
    // Check each overlay to see which one contains the selection
    const selectionCenterX = rect.left + rect.width / 2;
    const selectionCenterY = rect.top + rect.height / 2;
    
    for (const [pageNumStr, overlay] of Object.entries(overlayRefs.current)) {
      if (!overlay) continue;
      const overlayRect = overlay.getBoundingClientRect();
      if (
        selectionCenterX >= overlayRect.left &&
        selectionCenterX <= overlayRect.right &&
        selectionCenterY >= overlayRect.top &&
        selectionCenterY <= overlayRect.bottom
      ) {
        const pageNum = parseInt(pageNumStr, 10);
        return isNaN(pageNum) ? null : pageNum;
      }
    }
    return null;
  }, []);

  // ---------- selection capture ----------
  useEffect(() => {
    const captureSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.getRangeAt(0).collapsed) {
        currentSelectionRef.current = { text: '', range: null, pageNumber: null };
        setSelectionMenu(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const detectedPage = detectSelectionPage(range);
      const normalizedText = normalizeClippingText(sel.toString());
      currentSelectionRef.current = {
        text: normalizedText,
        range: range.cloneRange(),
        pageNumber: detectedPage,
      };
      const rect = range.getBoundingClientRect();
      if (!rect || rect.width < 2 || rect.height < 2) {
        setSelectionMenu(null);
        return;
      }
      setSelectionMenu({
        x: rect.left + rect.width / 2,
        y: Math.max(rect.top - 40, 12),
        quote: normalizedText,
      });
    };
    document.addEventListener('selectionchange', captureSelection);
    document.addEventListener('mousedown', captureSelection);
    document.addEventListener('touchstart', captureSelection);
    return () => {
      document.removeEventListener('selectionchange', captureSelection);
      document.removeEventListener('mousedown', captureSelection);
      document.removeEventListener('touchstart', captureSelection);
    };
  }, [detectSelectionPage]);

  // ---------- PDF load ----------
  const onDocumentLoadSuccess = useCallback((pdfInstance) => {
    setNumPages(pdfInstance.numPages);
    pdfProxyRef.current = pdfInstance;
    setIsPdfReady(true);
  }, []);

  // ---------- Automatic OCR ----------
  // Run OCR automatically when user navigates to a page (if not already processed)
  // useEffect(() => {
  //   if (!isPdfReady || !primaryPage || !pdfProxyRef.current || isOcrRunning) return;
  //   // Only run OCR if we don't already have results for this page
  //   if (!ocrResults[primaryPage]) {
  //     runOcrOnPage(primaryPage);
  //   }
  // }, [isPdfReady, primaryPage, ocrResults, isOcrRunning, runOcrOnPage]);

useEffect(() => {
  if (isPdfReady && pdfProxyRef.current) {
    runOcrOnAllPages();
  }
}, [isPdfReady, pdfProxyRef]);



  // ---------- annotation helpers ----------
  const toggleAnnotationFilter = useCallback((type) => {
    setAnnotationFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const filteredAnnotations = useMemo(
    () => annotations.filter((a) => annotationFilters[a.type] && !a.isTemporary),
    [annotations, annotationFilters]
  );

  // Calculate highlight bounding boxes per page for highlight view
  const highlightBoundsPerPage = useMemo(() => {
    const bounds = {};
    const highlightRectsPerPage = {}; // Store individual annotation rectangles per page
    
    // First pass: collect all individual annotation rectangles (all types)
    filteredAnnotations.forEach((ann) => {
      const pageNum = ann.pageNumber;
      if (!highlightRectsPerPage[pageNum]) {
        highlightRectsPerPage[pageNum] = [];
        bounds[pageNum] = { minX: 1, minY: 1, maxX: 0, maxY: 0, hasHighlights: false };
      }
      
      // Handle different annotation types
      if (ann.type === 'highlight') {
        if (ann.position) {
          const { x, y, width, height } = ann.position;
          highlightRectsPerPage[pageNum].push({ top: y, bottom: y + height, left: x, right: x + width });
          bounds[pageNum].minX = Math.min(bounds[pageNum].minX, x);
          bounds[pageNum].minY = Math.min(bounds[pageNum].minY, y);
          bounds[pageNum].maxX = Math.max(bounds[pageNum].maxX, x + width);
          bounds[pageNum].maxY = Math.max(bounds[pageNum].maxY, y + height);
          bounds[pageNum].hasHighlights = true;
        } else if (ann.rects && ann.rects.length > 0) {
          ann.rects.forEach((r) => {
            highlightRectsPerPage[pageNum].push({ top: r.y, bottom: r.y + r.height, left: r.x, right: r.x + r.width });
            bounds[pageNum].minX = Math.min(bounds[pageNum].minX, r.x);
            bounds[pageNum].minY = Math.min(bounds[pageNum].minY, r.y);
            bounds[pageNum].maxX = Math.max(bounds[pageNum].maxX, r.x + r.width);
            bounds[pageNum].maxY = Math.max(bounds[pageNum].maxY, r.y + r.height);
            bounds[pageNum].hasHighlights = true;
          });
        }
      } else if (ann.type === 'underline' || ann.type === 'strike') {
        // For underline/strike, use lines to calculate bounds
        if (ann.lines && ann.lines.length > 0) {
          const lineYs = ann.lines.map(l => l.y1);
          const lineXs = ann.lines.flatMap(l => [l.x1, l.x2]);
          const minY = Math.min(...lineYs);
          const maxY = Math.max(...lineYs);
          const minX = Math.min(...lineXs);
          const maxX = Math.max(...lineXs);
          const height = Math.max(0.01, maxY - minY); // Minimum height for lines
          highlightRectsPerPage[pageNum].push({ top: minY, bottom: maxY + height, left: minX, right: maxX });
          bounds[pageNum].minX = Math.min(bounds[pageNum].minX, minX);
          bounds[pageNum].minY = Math.min(bounds[pageNum].minY, minY);
          bounds[pageNum].maxX = Math.max(bounds[pageNum].maxX, maxX);
          bounds[pageNum].maxY = Math.max(bounds[pageNum].maxY, maxY + height);
          bounds[pageNum].hasHighlights = true;
        }
      } else if (ann.type === 'freehand') {
        // For freehand, use points to calculate bounds
        if (ann.points && ann.points.length > 0) {
          const xs = ann.points.map(p => p.x);
          const ys = ann.points.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const strokeWidth = (ann.strokeWidth || DEFAULT_BRUSH_SIZE) / 100; // Normalize stroke width
          highlightRectsPerPage[pageNum].push({ 
            top: Math.max(0, minY - strokeWidth), 
            bottom: Math.min(1, maxY + strokeWidth), 
            left: Math.max(0, minX - strokeWidth), 
            right: Math.min(1, maxX + strokeWidth) 
          });
          bounds[pageNum].minX = Math.min(bounds[pageNum].minX, Math.max(0, minX - strokeWidth));
          bounds[pageNum].minY = Math.min(bounds[pageNum].minY, Math.max(0, minY - strokeWidth));
          bounds[pageNum].maxX = Math.max(bounds[pageNum].maxX, Math.min(1, maxX + strokeWidth));
          bounds[pageNum].maxY = Math.max(bounds[pageNum].maxY, Math.min(1, maxY + strokeWidth));
          bounds[pageNum].hasHighlights = true;
        }
      } else if (ann.type === 'comment') {
        // For comments, use position
        if (ann.position) {
          const { x, y, width, height } = ann.position;
          highlightRectsPerPage[pageNum].push({ top: y, bottom: y + height, left: x, right: x + width });
          bounds[pageNum].minX = Math.min(bounds[pageNum].minX, x);
          bounds[pageNum].minY = Math.min(bounds[pageNum].minY, y);
          bounds[pageNum].maxX = Math.max(bounds[pageNum].maxX, x + width);
          bounds[pageNum].maxY = Math.max(bounds[pageNum].maxY, y + height);
          bounds[pageNum].hasHighlights = true;
        }
      }
    });
    
    // LiquidText behavior: 
    // - Only crop height (top/bottom), not width (left/right)
    // - Gradual cropping based on zoom: more zoom = tighter crop until only highlights show
    // - At minimum zoom (1.0): show full page
    // - As zoom increases: gradually crop top/bottom until only highlights visible
    // - When cropping, exclude gaps between highlight groups (non-highlighted text between highlights)
    Object.keys(bounds).forEach((pageNum) => {
      const b = bounds[pageNum];
      if (!b.hasHighlights) return;
      
      // Group highlights that are close together vertically (within 2% of page height)
      // This helps identify contiguous highlight regions vs gaps
      const GAP_THRESHOLD = 0.02; // 2% of page height
      const rects = highlightRectsPerPage[pageNum];
      
      // Sort rectangles by top position
      rects.sort((a, b) => a.top - b.top);
      
      // Group contiguous highlights
      const highlightGroups = [];
      let currentGroup = null;
      
      rects.forEach((rect) => {
        if (!currentGroup) {
          currentGroup = { top: rect.top, bottom: rect.bottom };
        } else {
          // Check if this rect is close to the current group (within threshold)
          const gap = rect.top - currentGroup.bottom;
          if (gap <= GAP_THRESHOLD) {
            // Extend the current group
            currentGroup.bottom = Math.max(currentGroup.bottom, rect.bottom);
          } else {
            // Start a new group
            highlightGroups.push(currentGroup);
            currentGroup = { top: rect.top, bottom: rect.bottom };
          }
        }
      });
      if (currentGroup) {
        highlightGroups.push(currentGroup);
      }
      
      // Calculate the highlight region (top and bottom bounds of all groups)
      // But we'll use mask to exclude gaps between groups
      const highlightTop = b.minY;
      const highlightBottom = b.maxY;
      const highlightHeight = highlightBottom - highlightTop;
      
      // Calculate crop progress based on highlight view crop zoom (separate from page scale)
      // At cropZoom 1.0: cropProgress = 0 (show full page)
      // At cropZoom 1.5: cropProgress = 0.5 (crop halfway)
      // At cropZoom 2.0+: cropProgress = 1.0 (crop to highlights only)
      const minZoom = 1.0;
      const maxZoom = 2.0; // At 2x crop zoom, fully crop to highlights
      const cropZoom = isHighlightView ? highlightViewCropZoom : 1.0;
      const normalizedScale = Math.max(minZoom, Math.min(cropZoom, maxZoom));
      const cropProgress = (normalizedScale - minZoom) / (maxZoom - minZoom);
      
      // Calculate how much to crop from top and bottom
      // At cropProgress = 0: no crop (show full page)
      // At cropProgress = 1: crop to highlight bounds only
      const topCrop = highlightTop * cropProgress;
      const bottomCrop = (1 - highlightBottom) * cropProgress;
      
      // Calculate final visible region (only height is cropped, width stays full)
      b.visibleTop = topCrop;
      b.visibleBottom = 1 - bottomCrop;
      b.visibleHeight = b.visibleBottom - b.visibleTop;
      
      // Store highlight groups for mask generation
      b.highlightGroups = highlightGroups;
      
      // For clip-path: we only crop top and bottom, left and right stay at 0% and 100%
      // But we'll also use mask-image to exclude gaps between highlight groups
      b.clipTop = b.visibleTop * 100;
      b.clipBottom = (1 - b.visibleBottom) * 100;
      b.cropProgress = cropProgress; // Store crop progress for spacing calculation
      
      // Generate mask-image gradient that shows only highlight groups (excludes gaps)
      // Apply mask when there are multiple highlight groups (gaps between them) and we're cropping
      if (cropProgress > 0 && highlightGroups.length > 0) {
        // Only apply mask if there are gaps to exclude between highlight groups
        // The mask will exclude non-highlighted text between highlight groups on the same page
        if (highlightGroups.length > 1) {
          // Multiple highlight groups means there are gaps between them
          // Build a linear gradient mask that gradually excludes gaps based on crop progress
          // At cropProgress = 0: show everything (gaps visible)
          // At cropProgress = 1: show only highlights (gaps hidden)
          // Strategy: Gradually shrink gaps by making them transparent as crop progress increases
          const maskStops = [];
          
          // Start from the top of the page
          let currentPos = 0;
          
          highlightGroups.forEach((group) => {
            const groupTopPercent = group.top * 100;
            const groupBottomPercent = group.bottom * 100;
            
            // Calculate gap before this group
            if (groupTopPercent > currentPos) {
              const gapStart = currentPos;
              const gapEnd = groupTopPercent;
              const gapSize = gapEnd - gapStart;
              
              // Gradually hide the gap based on crop progress
              // At cropProgress=0: gap is fully visible (black = visible in mask)
              // At cropProgress=1: gap is fully hidden (transparent)
              // Smoothly shrink the visible portion from center
              const visibleGapSize = gapSize * Math.max(0, 1 - cropProgress);
              const visibleGapStart = gapStart + (gapSize - visibleGapSize) / 2;
              const visibleGapEnd = visibleGapStart + visibleGapSize;
              
              if (visibleGapSize > 0.01) {
                // Gap is partially visible - show center portion, hide edges
                maskStops.push(`transparent ${gapStart}%`);
                maskStops.push(`transparent ${visibleGapStart}%`);
                maskStops.push(`black ${visibleGapStart}%`);
                maskStops.push(`black ${visibleGapEnd}%`);
                maskStops.push(`transparent ${visibleGapEnd}%`);
                maskStops.push(`transparent ${gapEnd}%`);
              } else {
                // Gap is fully hidden
                maskStops.push(`transparent ${gapStart}%`);
                maskStops.push(`transparent ${gapEnd}%`);
              }
            }
            
            // Add black (fully visible) region for this highlight group
            maskStops.push(`black ${groupTopPercent}%`);
            maskStops.push(`black ${groupBottomPercent}%`);
            
            currentPos = groupBottomPercent;
          });
          
          // Add transparent region after last group (if any)
          if (currentPos < 100) {
            const gapStart = currentPos;
            const gapEnd = 100;
            const gapSize = gapEnd - gapStart;
            const visibleGapSize = gapSize * Math.max(0, 1 - cropProgress);
            const visibleGapStart = gapStart + (gapSize - visibleGapSize) / 2;
            const visibleGapEnd = visibleGapStart + visibleGapSize;
            
            if (visibleGapSize > 0.01) {
              // Gap is partially visible - show center portion, hide edges
              maskStops.push(`transparent ${gapStart}%`);
              maskStops.push(`transparent ${visibleGapStart}%`);
              maskStops.push(`black ${visibleGapStart}%`);
              maskStops.push(`black ${visibleGapEnd}%`);
              maskStops.push(`transparent ${visibleGapEnd}%`);
              maskStops.push(`transparent ${gapEnd}%`);
            } else {
              // Gap is fully hidden
              maskStops.push(`transparent ${gapStart}%`);
              maskStops.push(`transparent ${gapEnd}%`);
            }
          }
          
          // Apply mask to exclude gaps gradually
          b.maskImage = `linear-gradient(to bottom, ${maskStops.join(', ')})`;
          // Store mask strength based on crop progress
          b.maskStrength = cropProgress;
        } else {
          // Single highlight group - no gaps to exclude, clip-path handles top/bottom cropping
          b.maskImage = null;
          b.maskStrength = null;
        }
      } else {
        b.maskImage = null;
        b.maskStrength = null;
      }
    });
    
    // Calculate overall crop progress for spacing (average of all pages with highlights)
    const pagesWithHighlights = Object.values(bounds).filter(b => b.hasHighlights);
    const avgCropProgress = pagesWithHighlights.length > 0
      ? pagesWithHighlights.reduce((sum, b) => sum + (b.cropProgress || 0), 0) / pagesWithHighlights.length
      : 0;
    
    return { bounds, avgCropProgress };
  }, [filteredAnnotations, isHighlightView, highlightViewCropZoom]);

  const liveFreehandStrokeWidth =
    drawingState?.type === 'freehand'
      ? (drawingState.brushSize || activeBrushSize || DEFAULT_BRUSH_SIZE) *
        (drawingState.pressureEnabled ? (drawingState.pressure || 1) : 1)
      : null;

  const liveFreehandOpacity =
    drawingState?.type === 'freehand'
      ? (typeof drawingState.opacity === 'number' ? drawingState.opacity : activeBrushOpacity || DEFAULT_BRUSH_OPACITY)
      : null;

  const workspaceVisibleWidth = Math.max(workspaceWidth - workspaceSlide, 0);
  const documentRightPadding = workspaceVisibleWidth + WORKSPACE_RESIZER_WIDTH;
  const updateAnnotations = useCallback((updater) => {
    setAnnotations((prev) => updater(prev).sort((a, b) => a.pageNumber - b.pageNumber));
  }, []);
  const eraseAnnotationsAtPoint = useCallback((pageNumber, point, overlayRect) => {
    if (!pageNumber || !point) return false;
    const overlayDimensions = overlayRect
      ? { width: overlayRect.width || 0, height: overlayRect.height || 0 }
      : null;
    let didErase = false;
    setAnnotations((prev) => {
      let changed = false;
      const next = [];
      for (let i = 0; i < prev.length; i += 1) {
        const annotation = prev[i];
        if (
          !changed &&
          annotation.pageNumber === pageNumber &&
          doesAnnotationHitPoint(annotation, point, overlayDimensions)
        ) {
          changed = true;
          didErase = true;
          continue;
        }
        next.push(annotation);
      }
      if (!changed) return prev;
      return next;
    });
    return didErase;
  }, [setAnnotations]);

  const handleCreateWorkspaceComment = useCallback(
    ({ sourceRect, pageNumber, sourceType = 'text', quoteText = '', createAnnotation = false }) => {
      if (!sourceRect) {
        window.alert('Unable to locate the selected content for this comment.');
        return false;
      }
      const body = window.prompt('Add comment', quoteText ? `Selection: "${quoteText.substring(0, 80)}"...` : '');
      if (!body || !body.trim()) {
        return false;
      }
      const content = body.trim();
      const createdAt = new Date().toISOString();
      const newComment = {
        id: `comment-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        content,
        quoteText,
        pageNumber,
        sourceRect,
        sourceType,
        color: activeColor,
        createdAt,
      };
      setWorkspaceComments((prev) => [newComment, ...prev]);
      setWorkspaceItems((prev) => {
        const commentCount = prev.filter((it) => getWorkspaceItemType(it) === 'comment').length;
        const baseY = 0.18 + ((commentCount * 0.14) % 0.6);
        const leftOffset = clamp(
          WORKSPACE_LEFT_STACK_X + (commentCount % 3) * (WORKSPACE_LEFT_STACK_SPREAD / 2) + Math.random() * 0.01,
          0.02,
          0.2,
        );
        const item = {
          id: createWorkspaceItemId(),
          type: 'comment',
          sourceId: newComment.id,
          x: leftOffset,
          y: clamp(baseY, 0.05, 0.92),
          createdAt,
        };
        return [item, ...prev];
      });
      if (createAnnotation) {
        const annotationId = createAnnotationId();
        const position = {
          x: clamp(sourceRect.x + (sourceRect.width || 0) / 2, 0.05, 0.95),
          y: clamp(sourceRect.y + (sourceRect.height || 0) / 2, 0.05, 0.95),
        };
        updateAnnotations((prev) => [
          ...prev,
          {
            id: annotationId,
            type: 'comment',
            pageNumber,
            color: activeColor,
            createdAt,
            content,
            linkedText: quoteText || null,
            position,
          },
        ]);
      }
      return true;
    },
    [activeColor, setWorkspaceComments, setWorkspaceItems, updateAnnotations],
  );

  const handleCreateCommentFromSelection = useCallback(() => {
    const stored = currentSelectionRef.current;
    if (!stored?.range || !stored.text || !stored.pageNumber) return;
    const pageNum = stored.pageNumber;
    const overlay = overlayRefs.current[pageNum];
    if (!overlay) return;
    const rangeRect = stored.range.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    if (!rangeRect || !overlayRect.width || !overlayRect.height) return;
    const sourceRect = {
      x: clamp((rangeRect.left - overlayRect.left) / overlayRect.width, 0, 0.98),
      y: clamp((rangeRect.top - overlayRect.top) / overlayRect.height, 0, 0.98),
      width: clamp(rangeRect.width / overlayRect.width, 0.02, 1),
      height: clamp(rangeRect.height / overlayRect.height, 0.02, 1),
    };
    const created = handleCreateWorkspaceComment({
      sourceRect,
      pageNumber: pageNum,
      sourceType: 'text',
      quoteText: stored.text,
    });
    if (created) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      currentSelectionRef.current = { text: '', range: null, pageNumber: null };
      setSelectionMenu(null);
    }
  }, [handleCreateWorkspaceComment]);

  // ---------- apply text annotations (unchanged) ----------
  const applyLineAnnotation = useCallback((type) => {
    const stored = currentSelectionRef.current;
    const hasSelection = !!stored.text && stored.range && stored.pageNumber;
    
    // If we have a selection, use its page number; otherwise use primaryPage for click-based annotations
    const targetPage = hasSelection ? stored.pageNumber : primaryPage;
    const overlay = overlayRefs.current[targetPage];
    if (!overlay) return;

    if (type === 'comment') {
      let x, y, linkedText = '';
      if (hasSelection) {
        const rect = stored.range.getClientRects()[0];
        if (!rect) return;
        const canvasRect = overlay.getBoundingClientRect();
        x = (rect.left + rect.width / 2 - canvasRect.left) / canvasRect.width;
        y = (rect.top + rect.height / 2 - canvasRect.top) / canvasRect.height;
        linkedText = stored.text;
      } else {
        const p = getNormalizedPoint({ clientX: overlay._lastX || 0, clientY: overlay._lastY || 0 }, overlay);
        x = p.x;
        y = p.y;
      }
      const content = window.prompt('Add note', linkedText || '');
      if (!content) return;
      updateAnnotations((prev) => [
        ...prev,
        {
          id: createAnnotationId(),
          type: 'comment',
          pageNumber: targetPage,
          color: activeColor,
          createdAt: new Date().toISOString(),
          content,
          linkedText: linkedText || null,
          position: { x: clamp(x, 0.05, 0.95), y: clamp(y, 0.05, 0.95) },
        },
      ]);
      currentSelectionRef.current = { text: '', range: null, pageNumber: null };
      window.getSelection().removeAllRanges();
      return;
    }

    if (!hasSelection) {
      window.alert('Please select some text first.');
      return;
    }

    const clientRects = Array.from(stored.range.getClientRects()).filter(
      (r) => r.width >= 2 && r.height >= 2,
    );
    if (clientRects.length === 0) return;
    const canvasRect = overlay.getBoundingClientRect();

    if (type === 'textHighlight') {
      const rects = clientRects.map((rect) => ({
        x: (rect.left - canvasRect.left) / canvasRect.width,
        y: (rect.top - canvasRect.top) / canvasRect.height,
        width: rect.width / canvasRect.width,
        height: rect.height / canvasRect.height,
      }));
      updateAnnotations((prev) => [
        ...prev,
        {
          id: createAnnotationId(),
          type: 'highlight',
          subtype: 'text',
          pageNumber: targetPage,
          color: activeColor,
          createdAt: new Date().toISOString(),
          text: stored.text,
          rects,
        },
      ]);
    }
    if (type === 'underline' || type === 'strike') {
      const lines = clientRects.map((rect) => {
        const x = (rect.left - canvasRect.left) / canvasRect.width;
        const y = (rect.top - canvasRect.top) / canvasRect.height;
        const width = rect.width / canvasRect.width;
        const height = rect.height / canvasRect.height;
        const lineY = type === 'underline' ? y + height * 0.9 : y + height * 0.5;
        return { x1: x, y1: lineY, x2: x + width, y2: lineY };
      });
      updateAnnotations((prev) => [
        ...prev,
        {
          id: createAnnotationId(),
          type,
          pageNumber: targetPage,
          color: activeColor,
          createdAt: new Date().toISOString(),
          lines,
          text: stored.text,
        },
      ]);
    }
    currentSelectionRef.current = { text: '', range: null, pageNumber: null };
    window.getSelection().removeAllRanges();
  }, [activeColor, primaryPage, updateAnnotations]);

  // ---------- drawing finalize ----------
  const finalizeDrawing = useCallback((endPoint, overlayKey) => {
    if (!drawingState) return;
    const { type, start, points, pageNumber, brushSize, pressure, mode, pressureEnabled, opacity } = drawingState;
    
    // Handle clipping area selection
    if (type === 'clip') {
      const w = Math.abs(endPoint.x - start.x);
      const h = Math.abs(endPoint.y - start.y);
      if (w < 0.01 || h < 0.01) { 
        setDrawingState(null);
        return;
      }
      const clipRect = {
        x: Math.min(start.x, endPoint.x),
        y: Math.min(start.y, endPoint.y),
        width: w,
        height: h,
      };
      setDrawingState(null);
      // Trigger OCR extraction for this area
      handleExtractClipFromArea(clipRect, pageNumber);
      return;
    }
    
    if (!type || !['highlight', 'freehand'].includes(type)) {
      setDrawingState(null);
      return;
    }
    const base = { id: createAnnotationId(), type, pageNumber, color: activeColor, createdAt: new Date().toISOString() };
    let annotation = null;
    if (type === 'highlight') {
      const w = Math.abs(endPoint.x - start.x);
      const h = Math.abs(endPoint.y - start.y);
      if (w < 0.01 || h < 0.01) { setDrawingState(null); return; }
      annotation = { ...base, subtype: 'area', position: { x: Math.min(start.x, endPoint.x), y: Math.min(start.y, endPoint.y), width: w, height: h } };
    } else if (type === 'freehand') {
      let merged;
      if (mode === 'straight') {
        const anchor = points[0] || start;
        merged = anchor ? [anchor, endPoint] : [start, endPoint];
      } else {
        merged = [...points, endPoint];
      }
      if (merged.length < 2) { setDrawingState(null); return; }
      const baseSize = brushSize || activeBrushSize || DEFAULT_BRUSH_SIZE;
      const pressureFactor = pressureEnabled ? (pressure || 1) : 1;
      const strokeWidth = baseSize * pressureFactor;
      const strokeOpacity = typeof opacity === 'number' ? opacity : activeBrushOpacity || DEFAULT_BRUSH_OPACITY;
      annotation = {
        ...base,
        points: merged,
        strokeWidth,
        brushSize: baseSize,
        mode: mode || 'freehand',
        pressureFactor,
        pressureEnabled,
        opacity: strokeOpacity,
      };
      if (isFreehandCommentMode) {
        const bounds = getBoundingRectFromPoints(merged);
        if (bounds) {
          handleCreateWorkspaceComment({
            sourceRect: bounds,
            pageNumber,
            sourceType: 'freehand',
            quoteText: 'Freehand sketch',
          });
        }
      }
    }
    if (annotation) updateAnnotations((prev) => [...prev, annotation]);
    setDrawingState(null);
  }, [drawingState, updateAnnotations, activeColor, handleExtractClipFromArea, activeBrushSize, activeBrushOpacity, handleCreateWorkspaceComment, isFreehandCommentMode]);

  // ---------- BOOKMARK TOOL ----------
  const addBookmark = useCallback((event, pageNumber, overlayKey) => {
    const overlay = overlayRefs.current[overlayKey];
    if (!overlay) return;

    const point = getNormalizedPoint(event, overlay);
    const note = window.prompt('Bookmark note (optional)', '')?.trim();

    const newBookmark = {
      id: createBookmarkId(),
      pageNumber,
      position: { x: clamp(point.x, 0.05, 0.95), y: clamp(point.y, 0.1, 0.9) },
      color: activeColor,
      note: note || null,
      createdAt: new Date().toISOString(),
    };

    setBookmarks(prev => [...prev, newBookmark]);
    setActiveTool('select'); // auto return to select tool
  }, [activeColor]);

  // ---------- POINTER EVENTS (per-page overlay) ----------
  const handlePointerDown = useCallback((event, pageNumber, overlayKey) => {
    const overlay = overlayRefs.current[overlayKey] || overlayRefs.current[pageNumber];
    if (!overlay) return;

    overlay._lastX = event.clientX;
    overlay._lastY = event.clientY;

    if (activeTool === WORKSPACE_ERASER_TOOL_ID) {
      event.preventDefault();
      const point = getNormalizedPoint(event, overlay);
      const overlayRect = overlay.getBoundingClientRect();
      eraseAnnotationsAtPoint(pageNumber, point, overlayRect);
      setDrawingState({
        type: 'eraser',
        pageNumber,
        overlayKey,
      });
      if (event.target && event.target.setPointerCapture) {
        try {
          event.target.setPointerCapture(event.pointerId);
        } catch {
          // ignore
        }
      }
      return;
    }

    // bookmark creation
    if (activeTool === 'bookmark') {
      event.preventDefault();
      addBookmark(event, pageNumber, overlayKey);
      return;
    }

    // drawing tools and clipping
    if (['highlight', 'freehand', 'clip'].includes(activeTool)) {
      event.preventDefault();
      const p = getNormalizedPoint(event, overlay);
      if (activeTool === 'freehand') {
        const initialPressure = getPointerPressure(event, isPressureEnabled);
        setDrawingState({
          type: 'freehand',
          pageNumber,
          overlayKey,
          points: freehandMode === 'straight' ? [p, p] : [p],
          brushSize: activeBrushSize,
          mode: freehandMode,
          pressureEnabled: isPressureEnabled,
          pressure: initialPressure,
          opacity: activeBrushOpacity,
        });
      } else {
        setDrawingState({
          type: activeTool,
          pageNumber,
          overlayKey,
          start: p,
        });
      }
      return;
    }

    // comment tool - create page note annotation
    if (activeTool === 'comment') {
      event.preventDefault();
      const point = getNormalizedPoint(event, overlay);
      const stored = currentSelectionRef.current;
      const hasSelection = !!stored.text && stored.range && stored.pageNumber;
      
      // Use the page number from the selection if available, otherwise use the current overlay's page
      const targetPage = hasSelection && stored.pageNumber ? stored.pageNumber : pageNumber;
      const targetOverlay = hasSelection && stored.pageNumber ? overlayRefs.current[stored.pageNumber] : overlay;
      
      let x, y, linkedText = '';
      if (hasSelection && targetOverlay) {
        const rect = stored.range.getClientRects()[0];
        if (rect) {
          const canvasRect = targetOverlay.getBoundingClientRect();
          x = (rect.left + rect.width / 2 - canvasRect.left) / canvasRect.width;
          y = (rect.top + rect.height / 2 - canvasRect.top) / canvasRect.height;
          linkedText = stored.text;
        } else {
          x = point.x;
          y = point.y;
        }
      } else {
        x = point.x;
        y = point.y;
      }
      
      const content = window.prompt('Add note', linkedText || '');
      if (!content) return;
      
      updateAnnotations((prev) => [
        ...prev,
        {
          id: createAnnotationId(),
          type: 'comment',
          pageNumber: targetPage,
          color: activeColor,
          createdAt: new Date().toISOString(),
          content,
          linkedText: linkedText || null,
          position: { x: clamp(x, 0.05, 0.95), y: clamp(y, 0.05, 0.95) },
        },
      ]);
      
      // Clear selection
      currentSelectionRef.current = { text: '', range: null, pageNumber: null };
      window.getSelection()?.removeAllRanges();
      setActiveTool('select');
      return;
    }
  }, [activeTool, addBookmark, applyLineAnnotation, activeBrushSize, freehandMode, isPressureEnabled, activeBrushOpacity, activeColor, updateAnnotations, eraseAnnotationsAtPoint]);

  const handlePointerMove = useCallback((event, overlayKey, pageNumber) => {
    const overlay = overlayRefs.current[overlayKey] || overlayRefs.current[pageNumber];
    
    // dragging comment note - handle globally for smooth dragging
    if (draggingAnnotationId.current) {
      event.preventDefault();
      if (!overlay) {
        // Try to find overlay from any page
        const pageNum = draggingAnnotationMetaRef.current.pageNumber;
        const fallbackOverlay = overlayRefs.current[pageNum];
        if (!fallbackOverlay) return;
        const p = getNormalizedPoint(event, fallbackOverlay);
        const { offsetX, offsetY, pageNumber } = draggingAnnotationMetaRef.current;
        updateAnnotations((prev) =>
          prev.map((a) =>
            a.id === draggingAnnotationId.current && a.pageNumber === pageNumber && a.type === 'comment'
              ? { ...a, position: { x: clamp(p.x - offsetX, 0.02, 0.92), y: clamp(p.y - offsetY, 0.02, 0.92) } }
              : a,
          ),
        );
        return;
      }
      const p = getNormalizedPoint(event, overlay);
      const { offsetX, offsetY, pageNumber } = draggingAnnotationMetaRef.current;
      updateAnnotations((prev) =>
        prev.map((a) =>
          a.id === draggingAnnotationId.current && a.pageNumber === pageNumber && a.type === 'comment'
            ? { ...a, position: { x: clamp(p.x - offsetX, 0.02, 0.92), y: clamp(p.y - offsetY, 0.02, 0.92) } }
            : a,
        ),
      );
      return;
    }

    // dragging bookmark - handle globally for smooth dragging
    if (draggingBookmarkId.current) {
      event.preventDefault();
      if (!overlay) {
        // Try to find overlay from any page
        const bookmark = bookmarks.find(b => b.id === draggingBookmarkId.current);
        if (!bookmark) return;
        const fallbackOverlay = overlayRefs.current[bookmark.pageNumber];
        if (!fallbackOverlay) return;
        const p = getNormalizedPoint(event, fallbackOverlay);
        const { offsetX, offsetY } = draggingBookmarkMetaRef.current;
        setBookmarks(prev =>
          prev.map(bm =>
            bm.id === draggingBookmarkId.current
              ? {
                  ...bm,
                  position: {
                    x: clamp(p.x - offsetX, 0.05, 0.95),
                    y: clamp(p.y - offsetY, 0.05, 0.95),
                  },
                }
              : bm
          )
        );
        return;
      }
      const p = getNormalizedPoint(event, overlay);
      const { offsetX, offsetY } = draggingBookmarkMetaRef.current;
      setBookmarks(prev =>
        prev.map(bm =>
          bm.id === draggingBookmarkId.current
            ? {
                ...bm,
                position: {
                  x: clamp(p.x - offsetX, 0.05, 0.95),
                  y: clamp(p.y - offsetY, 0.05, 0.95),
                },
              }
            : bm
        )
      );
      return;
    }

    if (
      drawingState?.type === 'eraser' &&
      (drawingState.pageNumber === pageNumber || drawingState.overlayKey === overlayKey)
    ) {
      const eraserOverlay =
        overlay || overlayRefs.current[drawingState.overlayKey] || overlayRefs.current[drawingState.pageNumber];
      if (!eraserOverlay) return;
      event.preventDefault();
      const point = getNormalizedPoint(event, eraserOverlay);
      const overlayRect = eraserOverlay.getBoundingClientRect();
      eraseAnnotationsAtPoint(drawingState.pageNumber, point, overlayRect);
      return;
    }

    if (!overlay) return;

    // drawing moves - check if this is the page we're drawing on
    if (!drawingState || (drawingState.pageNumber !== pageNumber && drawingState.overlayKey !== overlayKey)) return;
    const p = getNormalizedPoint(event, overlay);
    if (drawingState.type === 'freehand') {
      const pressureValue = getPointerPressure(event, drawingState.pressureEnabled);
      setDrawingState((prev) => {
        if (!prev) return prev;
        if (prev.mode === 'straight') {
          const anchor = prev.points[0] || p;
          return { ...prev, points: [anchor, p], lastPoint: p, pressure: pressureValue };
        }
        return { ...prev, points: [...prev.points, p], lastPoint: p, pressure: pressureValue };
      });
    } else if (drawingState.type === 'highlight' || drawingState.type === 'clip') {
      setDrawingState((prev) => ({ ...prev, lastPoint: p }));
    }
  }, [drawingState, eraseAnnotationsAtPoint, updateAnnotations]);

  const handlePointerUp = useCallback((event, overlayKey, pageNumber) => {
    const overlay = overlayRefs.current[overlayKey] || overlayRefs.current[pageNumber];
    
    // Release pointer capture
    if (event.target && event.target.releasePointerCapture) {
      try {
        event.target.releasePointerCapture(event.pointerId);
      } catch (e) {
        // Ignore errors
      }
    }

    if (draggingAnnotationId.current) { 
      draggingAnnotationId.current = null; 
      return; 
    }
    if (draggingBookmarkId.current) { 
      draggingBookmarkId.current = null; 
      return; 
    }

    if (!overlay) {
      setDrawingState(null);
      return;
    }

    if (drawingState?.type === 'eraser') {
      const eraserOverlay =
        overlay || overlayRefs.current[drawingState.overlayKey] || overlayRefs.current[drawingState.pageNumber];
      if (eraserOverlay) {
        const point = getNormalizedPoint(event, eraserOverlay);
        const overlayRect = eraserOverlay.getBoundingClientRect();
        eraseAnnotationsAtPoint(drawingState.pageNumber, point, overlayRect);
      }
      setDrawingState(null);
      return;
    }

    // Check if this is the page we're drawing on
    if (!drawingState || (drawingState.pageNumber !== pageNumber && drawingState.overlayKey !== overlayKey)) { 
      setDrawingState(null); 
      return; 
    }

    finalizeDrawing(getNormalizedPoint(event, overlay), overlayKey);
  }, [drawingState, finalizeDrawing, eraseAnnotationsAtPoint]);

  // ---------- DRAG START handlers for notes/bookmarks ----------
  const handleStartDraggingNote = useCallback((event, annotation) => {
    if (activeTool !== 'select') return;
    event.preventDefault();
    event.stopPropagation();
    const overlay = event.currentTarget.closest('[data-overlay]');
    if (!overlay) return;
    const p = getNormalizedPoint(event, overlay);
    draggingAnnotationMetaRef.current = {
      offsetX: p.x - annotation.position.x,
      offsetY: p.y - annotation.position.y,
      pageNumber: annotation.pageNumber,
    };
    draggingAnnotationId.current = annotation.id;
    // Capture pointer for smooth dragging
    if (event.target && event.target.setPointerCapture) {
      event.target.setPointerCapture(event.pointerId);
    }
  }, [activeTool]);

  const handleStartDraggingBookmark = useCallback((event, bookmark) => {
    if (activeTool !== 'select') return;
    event.preventDefault();
    event.stopPropagation();
    const overlay = event.currentTarget.closest('[data-overlay]');
    if (!overlay) return;
    const p = getNormalizedPoint(event, overlay);
    draggingBookmarkMetaRef.current = {
      offsetX: p.x - bookmark.position.x,
      offsetY: p.y - bookmark.position.y,
    };
    draggingBookmarkId.current = bookmark.id;
    // Capture pointer for smooth dragging
    if (event.target && event.target.setPointerCapture) {
      event.target.setPointerCapture(event.pointerId);
    }
  }, [activeTool]);

  // ---------- clipboard/clipping logic (captures source rect) ----------
  const handleClipSelection = useCallback(() => {
    const sel = window.getSelection();
    const raw = sel?.toString() ?? '';
    const text = normalizeClippingText(raw);
    
    // If no text selected, show alert
    if (!text) {
      window.alert('Select text to clip, or use the Clip Area tool for scanned documents.');
      return;
    }

    const stored = currentSelectionRef.current;
    if (!stored?.range || !stored.pageNumber) {
      window.alert('Unable to detect which page the selection belongs to.');
      return;
    }

    const pageNum = stored.pageNumber;
    const overlay = overlayRefs.current[pageNum];
    
    // compute source rect normalized relative to overlay (if range exists)
    let sourceRect = null;
    if (overlay) {
      const rect = stored.range.getClientRects()[0];
      if (rect) {
        const canvasRect = overlay.getBoundingClientRect();
        sourceRect = {
          x: (rect.left - canvasRect.left) / canvasRect.width,
          y: (rect.top - canvasRect.top) / canvasRect.height,
          width: rect.width / canvasRect.width,
          height: rect.height / canvasRect.height,
        };
      }
    }

    const newClip = {
      id: createClippingId(),
      content: text,
      createdAt: new Date().toISOString(),
      sourcePage: pageNum,
      sourceRect, // may be null if selection couldn't be measured
      source: 'PDF',
    };

    setClippings((prev) => [newClip, ...prev]);
    setSelectedClippings([]);
    sel.removeAllRanges();
    currentSelectionRef.current = { text: '', range: null, pageNumber: null };
    setSelectionMenu(null);
    const normalizedY = numPages ? clamp(pageNum / numPages, 0.08, 0.9) : undefined;
    addClipToWorkspace(newClip.id, { preferredY: normalizedY });
  }, [ocrResults, numPages, addClipToWorkspace]);

  const toggleClippingSelection = useCallback((id) => {
    setSelectedClippings((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleReorderClipping = useCallback((id, dir) => {
    setClippings((prev) => {
      const i = prev.findIndex(c => c.id === id);
      if (i === -1) return prev;
      const swap = clamp(i + dir, 0, prev.length - 1);
      const copy = [...prev];
      [copy[i], copy[swap]] = [copy[swap], copy[i]];
      return copy;
    });
  }, []);

  const handleCombineClippings = useCallback(() => {
    if (selectedClippings.length < 2) return;
    let newCombinedClipId = null;
    setClippings((prev) => {
      const selected = prev.filter(c => selectedClippings.includes(c.id));
      if (selected.length < 2) return prev;
      const segments = selected.map((clip, idx) => ({
        id: clip.id,
        label: `Segment ${idx + 1}`,
        content: clip.content,
        sourcePage: clip.sourcePage,
        sourceRect: clip.sourceRect,
      }));
      const combined = {
        id: createClippingId(),
        content: segments.map(seg => `${seg.label}: ${seg.content}`).join('\n'),
        createdAt: new Date().toISOString(),
        sourcePage: segments.map(seg => seg.sourcePage).join(', '),
        sourceRect: segments[0]?.sourceRect || null,
        segments,
        type: 'combined',
      };
      newCombinedClipId = combined.id;
      return [combined, ...prev.filter(c => !selectedClippings.includes(c.id))];
    });
    setWorkspaceItems(prev => {
      // Remove originals
      const filtered = prev.filter(
        (it) =>
          getWorkspaceItemType(it) !== 'clip' ||
          !selectedClippings.includes(getWorkspaceItemSourceId(it)),
      );
      // Only add combined clip if at least one original was in the workspace
      const hadOriginalsInWorkspace = prev.some(
        (it) => getWorkspaceItemType(it) === 'clip' && selectedClippings.includes(getWorkspaceItemSourceId(it))
      );
      if (newCombinedClipId && hadOriginalsInWorkspace) {
        const clipCount = filtered.filter((it) => getWorkspaceItemType(it) === 'clip').length;
        const leftOffset = clamp(
          WORKSPACE_LEFT_STACK_X + (clipCount % 4) * (WORKSPACE_LEFT_STACK_SPREAD / 2) + Math.random() * 0.01,
          0.02,
          0.22,
        );
        const pointerY = 0.5; // Centered by default
        const createdAt = new Date().toISOString();
        const newItem = {
          id: createWorkspaceItemId(),
          type: 'clip',
          sourceId: newCombinedClipId,
          x: leftOffset,
          y: pointerY,
          createdAt,
        };
        return [newItem, ...filtered];
      }
      return filtered;
    });
    setSelectedClippings([]);
  }, [selectedClippings]);

  const handleUncombineClipping = useCallback((clipId) => {
    const combinedClip = clippings.find((c) => c.id === clipId && c.type === 'combined');
    if (!combinedClip || !combinedClip.segments) return;

    setClippings((prev) => {
      const restored = combinedClip.segments.map((seg) => ({
        id: seg.id,
        content: seg.content,
        createdAt: new Date().toISOString(),
        sourcePage: seg.sourcePage,
        sourceRect: seg.sourceRect,
        type: undefined,
      }));
      return [...restored, ...prev.filter((c) => c.id !== clipId)];
    });

    setWorkspaceItems((prev) => {
      const filtered = prev.filter(
        (it) =>
          !(getWorkspaceItemType(it) === 'clip' && getWorkspaceItemSourceId(it) === clipId),
      );
      const hadCombinedInWorkspace = prev.some(
        (it) => getWorkspaceItemType(it) === 'clip' && getWorkspaceItemSourceId(it) === clipId,
      );
      if (!hadCombinedInWorkspace || !combinedClip.segments?.length) {
        return filtered;
      }
      const baseClipCount = filtered.filter((it) => getWorkspaceItemType(it) === 'clip').length;
      const newItems = combinedClip.segments.map((seg, idx) => {
        const clipCount = baseClipCount + idx;
        const leftOffset = clamp(
          WORKSPACE_LEFT_STACK_X + (clipCount % 4) * (WORKSPACE_LEFT_STACK_SPREAD / 2) + Math.random() * 0.01,
          0.02,
          0.22,
        );
        return {
          id: createWorkspaceItemId(),
          type: 'clip',
          sourceId: seg.id,
          x: leftOffset,
          y: 0.5,
          createdAt: new Date().toISOString(),
        };
      });
      return [...newItems, ...filtered];
    });
  }, [clippings]);

  // ---------- SEARCH (DOM-based text layer highlight, Edge-style) ----------
  const handleSearch = useCallback(async () => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    const runId = ++searchRunIdRef.current;

    if (!normalizedTerm || !numPages) {
      setSearchResults([]);
      setActiveSearchResultIndex(-1);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const matches = [];

    for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
      if (runId !== searchRunIdRef.current) {
        break;
      }

      const pageNode = pageRefs.current[pageNumber];
      const overlayNode = overlayRefs.current[pageNumber];
      if (!pageNode || !overlayNode) continue;

      const overlayRect = overlayNode.getBoundingClientRect();
      if (!overlayRect.width || !overlayRect.height) continue;

      // Search text layer
      const textLayer = pageNode.querySelector('.react-pdf__Page__textContent');
      if (textLayer) {
        const spanNodes = textLayer.querySelectorAll('span');
        if (spanNodes.length > 0) {
          let fullText = '';
          const spanRanges = [];

          spanNodes.forEach((span) => {
            const str = span.textContent || '';
            if (!str.length) return;
            const start = fullText.length;
            fullText += str;
            const end = fullText.length;
            spanRanges.push({ span, start, end });
          });

          const lowerFullText = fullText.toLowerCase();
          if (lowerFullText) {
            let searchIndex = 0;
            while (searchIndex <= lowerFullText.length - normalizedTerm.length) {
              const foundIndex = lowerFullText.indexOf(normalizedTerm, searchIndex);
              if (foundIndex === -1) break;
              const matchEnd = foundIndex + normalizedTerm.length;

              const rects = [];

              spanRanges.forEach((range) => {
                if (range.end <= foundIndex || range.start >= matchEnd) return;
                const overlapStart = Math.max(range.start, foundIndex);
                const overlapEnd = Math.min(range.end, matchEnd);
                if (overlapStart >= overlapEnd) return;

                const localStart = overlapStart - range.start;
                const localEnd = overlapEnd - range.start;

                const textNode = range.span.firstChild;
                if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

                try {
                  const domRange = document.createRange();
                  domRange.setStart(textNode, localStart);
                  domRange.setEnd(textNode, localEnd);

                  const clientRects = Array.from(domRange.getClientRects()).filter(
                    (r) => r.width > 0 && r.height > 0,
                  );

                  clientRects.forEach((r) => {
                    rects.push({
                      x: clamp((r.left - overlayRect.left) / overlayRect.width, 0, 1),
                      y: clamp((r.top - overlayRect.top) / overlayRect.height, 0, 1),
                      width: clamp(r.width / overlayRect.width, 0.002, 1),
                      height: clamp(r.height / overlayRect.height, 0.003, 1),
                    });
                  });
                } catch (error) {
                  // Ignore invalid DOM range errors
                }
              });

              if (rects.length > 0) {
                matches.push({
                  id: `search-text-${pageNumber}-${foundIndex}`,
                  pageNumber,
                  rects,
                });
              }

              searchIndex = foundIndex + 1;
            }
          }
        }
      }

      // Search OCR layer (character-level matching)
      // Only search OCR layer if it's not native PDF text (native text is handled by text layer search above)
      const ocrPageResult = ocrResults[pageNumber];
      if (ocrPageResult && !ocrPageResult.isPdfText && ocrPageResult.words && ocrPageResult.words.length > 0) {
        // Build character-level index from OCR words
        const charIndex = [];
        let charOffset = 0;

        ocrPageResult.words.forEach((word, wordIdx) => {
          const wordText = word.text || '';
          if (!wordText) return;

          for (let i = 0; i < wordText.length; i++) {
            charIndex.push({
              char: wordText[i],
              charIndex: i,
              wordIndex: wordIdx,
              word,
              globalIndex: charOffset + i,
            });
          }
          charOffset += wordText.length;
          // Add space between words (except after last word)
          if (wordIdx < ocrPageResult.words.length - 1) {
            charIndex.push({
              char: ' ',
              charIndex: -1, // Not part of word
              wordIndex: wordIdx,
              word,
              globalIndex: charOffset,
            });
            charOffset += 1;
          }
        });

        // Build searchable text string
        const ocrFullText = charIndex.map(c => c.char).join('');
        const lowerOcrText = ocrFullText.toLowerCase();
        
        if (lowerOcrText) {
          let searchIndex = 0;
          while (searchIndex <= lowerOcrText.length - normalizedTerm.length) {
            const foundIndex = lowerOcrText.indexOf(normalizedTerm, searchIndex);
            if (foundIndex === -1) break;
            const matchEnd = foundIndex + normalizedTerm.length;

            // Group characters by word for more accurate bounding box calculation
            const wordGroups = new Map();
            
            for (let i = foundIndex; i < matchEnd; i++) {
              if (i >= charIndex.length) break;
              const charInfo = charIndex[i];
              if (!charInfo || !charInfo.word || !charInfo.word.bbox) continue;

              const wordKey = charInfo.wordIndex;
              if (!wordGroups.has(wordKey)) {
                wordGroups.set(wordKey, {
                  word: charInfo.word,
                  charIndices: [],
                });
              }
              wordGroups.get(wordKey).charIndices.push(charInfo.charIndex);
            }

            const rects = [];

            // Calculate bounding boxes for each word group
            wordGroups.forEach((group) => {
              const { word, charIndices } = group;
              const { bbox } = word;
              const wordText = word.text || '';
              
              if (!wordText || wordText.length === 0 || !bbox) return;

              // Filter out space characters (charIndex === -1)
              const validCharIndices = charIndices.filter(idx => idx >= 0);
              
              if (validCharIndices.length === 0) {
                // Only spaces - skip or use minimal width
                return;
              }

              // Find the range of characters in this word
              const minCharIdx = Math.min(...validCharIndices);
              const maxCharIdx = Math.max(...validCharIndices);

              // Calculate character position ratios (assuming proportional character widths)
              const charStartRatio = minCharIdx / wordText.length;
              const charEndRatio = (maxCharIdx + 1) / wordText.length;

              // Calculate bounding box for this character range
              const charWidth = bbox.x1 - bbox.x0;
              const charX0 = bbox.x0 + charWidth * charStartRatio;
              const charX1 = bbox.x0 + charWidth * charEndRatio;

              rects.push({
                x: clamp(charX0, 0, 1),
                y: clamp(bbox.y0, 0, 1),
                width: clamp(charX1 - charX0, 0.001, 1),
                height: clamp(bbox.y1 - bbox.y0, 0.001, 1),
              });
            });

            // Merge overlapping or adjacent rects on the same line
            if (rects.length > 0) {
              // Sort rects by y position, then x position
              rects.sort((a, b) => {
                const yDiff = a.y - b.y;
                if (Math.abs(yDiff) > 0.01) return yDiff;
                return a.x - b.x;
              });

              const mergedRects = [];
              let currentRect = { ...rects[0] };

              for (let i = 1; i < rects.length; i++) {
                const rect = rects[i];
                
                // Check if rects are on the same line (similar y position)
                const yDiff = Math.abs(rect.y - currentRect.y);
                const isSameLine = yDiff < 0.01;

                // Check if rects are adjacent or overlapping
                const xGap = rect.x - (currentRect.x + currentRect.width);
                const isAdjacent = xGap <= 0.002; // Small threshold for adjacent rects

                if (isSameLine && isAdjacent) {
                  // Merge: extend current rect
                  currentRect.width = Math.max(
                    currentRect.width,
                    rect.x + rect.width - currentRect.x
                  );
                  currentRect.height = Math.max(currentRect.height, rect.height);
                } else {
                  // New rect
                  mergedRects.push(currentRect);
                  currentRect = { ...rect };
                }
              }
              mergedRects.push(currentRect);

              if (mergedRects.length > 0) {
                matches.push({
                  id: `search-ocr-${pageNumber}-${foundIndex}`,
                  pageNumber,
                  rects: mergedRects,
                });
              }
            }

            searchIndex = foundIndex + 1;
          }
        }
      }
    }

    if (runId === searchRunIdRef.current) {
      setSearchResults(matches);
      setActiveSearchResultIndex(matches.length ? 0 : -1);
      setIsSearching(false);
    }
  }, [searchTerm, numPages, ocrResults]);

  // Auto-trigger search on every keystroke; run immediately when text changes
  useEffect(() => {
    handleSearch();
  }, [searchTerm, handleSearch]);

  // Don't re-run search on zoom changes - search results use normalized coordinates (0-1)
  // which are independent of zoom level. The highlights will automatically scale correctly.
  // Only re-run search when search term changes.

  useEffect(() => {
    if (activeSearchResultIndex < 0 || activeSearchResultIndex >= searchResults.length) return;
    const result = searchResults[activeSearchResultIndex];
    if (!result) return;

    setPrimaryPage(result.pageNumber);

    const scrollToMatch = () => {
      const wrapper = viewerZoomWrapperRef.current;
      const pageEl = pageRefs.current[result.pageNumber];
      if (!wrapper || !pageEl) return;

      const rect = result.rects?.[0];
      const pageRect = pageEl.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const pageHeight = pageRect.height || pageEl.offsetHeight || 0;
      if (!rect || pageHeight === 0) return;

      const matchCenterWithinPage = pageHeight * (rect.y + rect.height / 2);
      const pageOffsetRelativeToWrapper = pageRect.top - wrapperRect.top + wrapper.scrollTop;
      const targetScroll = pageOffsetRelativeToWrapper + matchCenterWithinPage - wrapper.clientHeight / 2;

      wrapper.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    };

    const timeoutId = window.setTimeout(scrollToMatch, 160);
    return () => window.clearTimeout(timeoutId);
  }, [activeSearchResultIndex, searchResults, setPrimaryPage]);

  const goToNextSearchResult = useCallback(() => {
    if (!searchResults.length) return;
    setActiveSearchResultIndex((prev) => {
      if (prev < 0) return 0;
      return (prev + 1) % searchResults.length;
    });
  }, [searchResults.length]);

  const goToPreviousSearchResult = useCallback(() => {
    if (!searchResults.length) return;
    setActiveSearchResultIndex((prev) => {
      if (prev <= 0) {
        return searchResults.length - 1;
      }
      return prev - 1;
    });
  }, [searchResults.length]);

  const searchHighlightOverlays = useMemo(() => {
    if (!searchResults.length) return [];
    return searchResults.flatMap((result, resultIndex) =>
      (result.rects || []).map((rect, rectIndex) => ({
        id: `${result.id}-rect-${rectIndex}`,
        type: 'highlight',
        subtype: 'area',
        pageNumber: result.pageNumber,
        color: resultIndex === activeSearchResultIndex ? 'rgba(249, 115, 22, 0.85)' : 'rgba(250, 204, 21, 0.6)',
        rects: [rect],
        isSearchHighlight: true,
      })),
    );
  }, [searchResults, activeSearchResultIndex]);

  // Handle clicking on annotation card - jump to page and highlight
  const handleAnnotationJump = useCallback((annotation) => {
    if (!annotation) return;

    const pageNumber = annotation.pageNumber;
    setPrimaryPage(pageNumber);

    // Scroll to the page and highlight
    setTimeout(() => {
      const pageEl = pageRefs.current[pageNumber];
      if (pageEl && viewerZoomWrapperRef.current) {
        const pageRect = pageEl.getBoundingClientRect();
        const wrapperRect = viewerZoomWrapperRef.current.getBoundingClientRect();
        const scrollTop = viewerZoomWrapperRef.current.scrollTop;
        const targetY = pageRect.top - wrapperRect.top + scrollTop - 100;
        viewerZoomWrapperRef.current.scrollTo({
          top: Math.max(0, targetY),
          behavior: 'smooth',
        });
      }

      // Create a temporary highlight at the annotation position
      if (annotation.position) {
        const tmpHighlight = {
          id: createAnnotationId(),
          type: 'highlight',
          subtype: 'area',
          pageNumber: pageNumber,
          color: '#bef264',
          position: { ...annotation.position },
          createdAt: new Date().toISOString(),
          isTemporary: true
        };
        setAnnotations((prev) => [tmpHighlight, ...prev]);
        setTimeout(() => {
          setAnnotations((prev) => prev.filter((a) => a.id !== tmpHighlight.id));
        }, 2000);
      } else if (annotation.rects && annotation.rects.length > 0) {
        // Handle annotations with multiple rects (like text highlights)
        const firstRect = annotation.rects[0];
        const tmpHighlight = {
          id: createAnnotationId(),
          type: 'highlight',
          subtype: 'area',
          pageNumber: pageNumber,
          color: '#bef264',
          position: { ...firstRect },
          createdAt: new Date().toISOString(),
          isTemporary: true
        };
        setAnnotations((prev) => [tmpHighlight, ...prev]);
        setTimeout(() => {
          setAnnotations((prev) => prev.filter((a) => a.id !== tmpHighlight.id));
        }, 2000);
      }
    }, 100);
  }, []);

  const annotationDescriptions = useMemo(() => ({
    highlight: 'Highlight',
    underline: 'Underline',
    strike: 'Strike-through',
    freehand: 'Freehand drawing',
    comment: 'Sticky note',
  }), []);

  // ---------- WORKSPACE: drag from clipping panel TO workspace ----------
  // Drag start on clipping card
  const handleClippingDragStart = useCallback((e, clipId) => {
    // set html5 drag data and fallback ref id
    e.dataTransfer?.setData?.('text/plain', clipId);
    draggingWorkspaceItemId.current = null;
  }, []);

  // Allow drops on workspace container
  const workspaceRef = useRef(null);

  const addClipToWorkspace = useCallback((clipId, { preferredY } = {}) => {
    if (!clipId) return;
    const createdAt = new Date().toISOString();
    setWorkspaceItems((prev) => {
      const clipCount = prev.filter((it) => getWorkspaceItemType(it) === 'clip').length;
      const leftOffset = clamp(
        WORKSPACE_LEFT_STACK_X + (clipCount % 4) * (WORKSPACE_LEFT_STACK_SPREAD / 2) + Math.random() * 0.01,
        0.02,
        0.22,
      );
      const yPosition = typeof preferredY === 'number'
        ? clamp(preferredY, 0.05, 0.95)
        : clamp(0.2 + ((clipCount * 0.18) % 0.6), 0.08, 0.92);
      const newItem = {
        id: createWorkspaceItemId(),
        type: 'clip',
        sourceId: clipId,
        x: leftOffset,
        y: yPosition,
        createdAt,
      };
      return [newItem, ...prev];
    });
  }, []);
  const pulseTemporaryHighlight = useCallback(
    ({ pageNumber, position, color = '#ffe58a', duration = 1000 }) => {
      if (!pageNumber || !position) return;
      const highlight = {
        id: createAnnotationId(),
        type: 'highlight',
        subtype: 'area',
        pageNumber,
        color,
        position: { ...position },
        createdAt: new Date().toISOString(),
        isTemporary: true,
      };
      setAnnotations((prev) => [highlight, ...prev]);
      setTimeout(() => {
        setAnnotations((prev) => prev.filter((ann) => ann.id !== highlight.id));
      }, duration);
    },
    [setAnnotations],
  );

  useEffect(() => {
    const root = workspaceRef.current;
    if (!root) return;
    const handleDragOver = (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
    };
    const handleDrop = (ev) => {
      ev.preventDefault();
      const clipId = ev.dataTransfer.getData('text/plain') || ev.dataTransfer?.getData?.('text/clipping') || null;
      const clip = clippings.find(c => c.id === clipId);
      if (!clip) return;
      const rect = root.getBoundingClientRect();
      if (!rect) return;
      const pointerY = clamp((ev.clientY - rect.top) / rect.height, 0.02, 0.98);
      addClipToWorkspace(clipId, { preferredY: pointerY });
      const firstSegmentPage = clip.segments?.[0]?.sourcePage;
      const targetPage = getPrimaryPageFromSource(firstSegmentPage || clip.sourcePage || primaryPage);
      setPrimaryPage(targetPage);
    };
    root.addEventListener('dragover', handleDragOver);
    root.addEventListener('drop', handleDrop);
    return () => {
      root.removeEventListener('dragover', handleDragOver);
      root.removeEventListener('drop', handleDrop);
    };
}, [clippings, primaryPage, addClipToWorkspace]);

  // remove workspace items whose clips no longer exist
  useEffect(() => {
    setWorkspaceItems((prev) =>
      prev.filter((item) => {
        if (getWorkspaceItemType(item) === 'comment') return true;
        const sourceId = getWorkspaceItemSourceId(item);
        return clippings.some((c) => c.id === sourceId);
      }),
    );
  }, [clippings]);

  // ---------- WORKSPACE: dragging items to reposition ----------
  const startMoveWorkspaceItem = useCallback((ev, item) => {
    ev.preventDefault();
    ev.stopPropagation();
    // pointer capture approach
    draggingWorkspaceItemId.current = item.id;
    const workspaceCanvas = workspaceRef.current;
    if (!workspaceCanvas) return;
    const rect = workspaceCanvas.getBoundingClientRect();
    if (!rect) return;
    const p = { x: (ev.clientX - rect.left) / rect.width, y: (ev.clientY - rect.top) / rect.height };
    draggingWorkspaceMetaRef.current = { offsetX: p.x - item.x, offsetY: p.y - item.y };
    // capture pointer for smooth dragging (works for touch as well)
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
  }, []);

  const handleWorkspacePointerMove = useCallback((ev) => {
    if (!draggingWorkspaceItemId.current) return;
    ev.preventDefault();
    const workspaceCanvas = workspaceRef.current;
    if (!workspaceCanvas) return;
    const rect = workspaceCanvas.getBoundingClientRect();
    if (!rect) return;
    const p = { x: (ev.clientX - rect.left) / rect.width, y: (ev.clientY - rect.top) / rect.height };
    const { offsetX, offsetY } = draggingWorkspaceMetaRef.current;
    const newX = clamp(p.x - offsetX, 0.02, 0.98);
    const newY = clamp(p.y - offsetY, 0.02, 0.98);
    setWorkspaceItems(prev => prev.map(it => it.id === draggingWorkspaceItemId.current ? { ...it, x: newX, y: newY } : it));
  }, []);

  const endMoveWorkspaceItem = useCallback(() => {
    draggingWorkspaceItemId.current = null;
    if (workspaceRef.current) {
      workspaceRef.current.style.cursor = 'default';
    }
  }, []);

  // Helper to check if a page is visible in the viewport
  const isPageVisible = useCallback((pageNumber) => {
    const scrollContainer = viewerZoomWrapperRef.current;
    if (!scrollContainer) return false;
    
    const pageEl = pageRefs.current[pageNumber];
    if (!pageEl) return false;
    
    const containerRect = scrollContainer.getBoundingClientRect();
    const pageRect = pageEl.getBoundingClientRect();
    const containerBottom = containerRect.bottom;
    const containerTop = containerRect.top;
    const pageBottom = pageRect.bottom;
    const pageTop = pageRect.top;
    
    // Page is visible if it intersects with viewport (no buffer - disappear immediately when out of view)
    return (pageBottom >= containerTop) && (pageTop <= containerBottom);
  }, []);

  // ---------- CONNECTORS: compute lines from clipping.sourceRect center to workspace item ----------
  const computeConnectorPoints = useCallback((item, source) => {
    const viewerDeck = viewerDeckRef.current;
    const workspaceRect = workspaceRef.current?.getBoundingClientRect();
    if (!viewerDeck || !workspaceRect) return [];

    const deckRect = viewerDeck.getBoundingClientRect();
    const to = {
      x: workspaceRect.left + item.x * workspaceRect.width - deckRect.left,
      y: workspaceRect.top + item.y * workspaceRect.height - deckRect.top,
    };

    // Helper to find the page element and calculate connector position
    const buildConnectorForPage = (sourceRect, pageNumber) => {
      if (!sourceRect || !pageNumber) return null;
      
      // Only show connector if the page is visible in the viewport
      if (!isPageVisible(pageNumber)) return null;
      
      // Find the page element for this page
      const pageEl = pageRefs.current[pageNumber];
      if (!pageEl) return null;
      
      const pageRect = pageEl.getBoundingClientRect();
      const scrollContainer = viewerZoomWrapperRef.current;
      if (!scrollContainer) return null;
      
      // Calculate source position within the page (normalized to page dimensions)
      let sx = sourceRect.x + (sourceRect.width || 0) / 2;
      let sy = sourceRect.y + (sourceRect.height || 0) / 2;
      
      // Convert normalized coordinates to absolute position relative to deck
      // fromX: relative to document pane (left edge)
      // fromY: relative to deck top (using getBoundingClientRect which gives viewport coordinates)
      const fromX = pageRect.left - deckRect.left + sx * pageRect.width;
      const fromY = pageRect.top - deckRect.top + sy * pageRect.height;
      
      return {
        from: {
          x: fromX,
          y: fromY,
        },
        to,
      };
    };

    const itemType = getWorkspaceItemType(item);

    if (itemType === 'comment') {
      if (!source || !source.pageNumber) return [];
      const connector = buildConnectorForPage(source.sourceRect, source.pageNumber);
      return connector ? [connector] : [];
    }

    if (itemType === 'clip' && source?.segments?.length) {
      // Return connectors only for segments whose pages are visible
      return source.segments
        .map(seg => {
          const pageNum = getPrimaryPageFromSource(seg.sourcePage);
          return buildConnectorForPage(seg.sourceRect, pageNum);
        })
        .filter(Boolean);
    }

    // Single clip - connect to its source page (only if visible)
    if (itemType === 'clip' && source) {
      const pageNum = getPrimaryPageFromSource(source.sourcePage);
      const single = buildConnectorForPage(source.sourceRect, pageNum);
      return single ? [single] : [];
    }
    
    return [];
  }, [pagePositions, isPageVisible]);

  // when clicking workspace item: jump to source page and pulse highlight
  const handleWorkspaceItemClick = useCallback((item) => {
    const itemType = getWorkspaceItemType(item);
    const sourceId = getWorkspaceItemSourceId(item);
    
    if (itemType === 'comment') {
      const comment = workspaceComments.find((c) => c.id === sourceId);
      if (!comment) return;
      setPrimaryPage(comment.pageNumber);
      
      // Scroll to the page
      setTimeout(() => {
        const pageEl = pageRefs.current[comment.pageNumber];
        if (pageEl && viewerZoomWrapperRef.current) {
          const pageRect = pageEl.getBoundingClientRect();
          const wrapperRect = viewerZoomWrapperRef.current.getBoundingClientRect();
          const scrollTop = viewerZoomWrapperRef.current.scrollTop;
          const targetY = pageRect.top - wrapperRect.top + scrollTop - 100; // Offset for better visibility
          viewerZoomWrapperRef.current.scrollTo({
            top: Math.max(0, targetY),
            behavior: 'smooth',
          });
        }
      }, 100);
      
      const highlightRect = comment.sourceRect;
      if (highlightRect) {
        pulseTemporaryHighlight({
          pageNumber: comment.pageNumber,
          position: highlightRect,
          color: '#bef264',
        });
      }
      return;
    }
    
    const clip = clippings.find(c => c.id === sourceId);
    if (!clip) return;
    
    // For clips, jump to the first segment or main source page (not filtered by primaryPage)
    const targetSegment = clip.segments?.[0];
    const targetPage = targetSegment ? getPrimaryPageFromSource(targetSegment.sourcePage) : (clip.sourcePage || getPrimaryPageFromSource(clip.sourcePage));
    
    if (targetPage) {
      setPrimaryPage(targetPage);
      
      // Scroll to the page
      setTimeout(() => {
        const pageEl = pageRefs.current[targetPage];
        if (pageEl && viewerZoomWrapperRef.current) {
          const pageRect = pageEl.getBoundingClientRect();
          const wrapperRect = viewerZoomWrapperRef.current.getBoundingClientRect();
          const scrollTop = viewerZoomWrapperRef.current.scrollTop;
          const targetY = pageRect.top - wrapperRect.top + scrollTop - 100; // Offset for better visibility
          viewerZoomWrapperRef.current.scrollTo({
            top: Math.max(0, targetY),
            behavior: 'smooth',
          });
        }
      }, 100);
    }
    
    const highlightRect = targetSegment?.sourceRect || clip.sourceRect;
    if (highlightRect && targetPage) {
      pulseTemporaryHighlight({
        pageNumber: targetPage,
        position: highlightRect,
      });
    }
  }, [clippings, workspaceComments, pulseTemporaryHighlight]);

  // ---------- PAGE POSITION TRACKING & VIEWPORT STATE ----------

  // Detect when the PDF content starts moving out of the horizontal viewport so we can
  // switch away from justify-content: center (which causes awkward scrolling when zoomed in).
  const updatePdfViewportState = useCallback(() => {
    const wrapper = viewerZoomWrapperRef.current;
    if (!wrapper) return;

    const { scrollWidth, clientWidth, scrollLeft } = wrapper;

    // If content is wider than the viewport and we are scrolled away from the centered position,
    // consider the PDF "out of viewport" horizontally.
    const hasHorizontalOverflow = scrollWidth > clientWidth + 1;
    if (!hasHorizontalOverflow) {
      if (isPdfOutOfViewport) {
        setIsPdfOutOfViewport(false);
      }
      return;
    }

    const epsilon = 2;
    const atExtremeLeft = scrollLeft <= epsilon;
    const atExtremeRight = scrollLeft + clientWidth >= scrollWidth - epsilon;

    // Out of viewport if we are panned somewhere between the extremes (i.e., user is actively panning)
    const outOfViewport = !(atExtremeLeft || atExtremeRight);
    if (outOfViewport !== isPdfOutOfViewport) {
      setIsPdfOutOfViewport(outOfViewport);
    }
  }, [isPdfOutOfViewport]);
  const measurePagePositions = useCallback(() => {
    const positions = {};
    const scrollContainer = viewerZoomWrapperRef.current;
    if (!scrollContainer) return;
    const containerRect = scrollContainer.getBoundingClientRect();
    const scrollTop = scrollContainer.scrollTop;
    
    Object.keys(pageRefs.current).forEach((pageNumStr) => {
      const pageEl = pageRefs.current[pageNumStr];
      if (!pageEl) return;
      const rect = pageEl.getBoundingClientRect();
      // Store absolute position within scroll container
      positions[pageNumStr] = {
        top: rect.top - containerRect.top + scrollTop,
        height: rect.height,
      };
    });
    setPagePositions(positions);
  }, []);

  // Re-measure on render, scroll, zoom, resize
  useEffect(() => {
    if (!isPdfReady || !numPages) return;
    // Initial measure after pages render
    const timeout = setTimeout(() => {
      measurePagePositions();
      updatePdfViewportState();
    }, 100);
    return () => clearTimeout(timeout);
  }, [isPdfReady, numPages, primaryScale, measurePagePositions, updatePdfViewportState]);

  useEffect(() => {
    const wrapper = viewerZoomWrapperRef.current;
    if (!wrapper) return;
    const handleScroll = () => {
      measurePagePositions();
      updatePdfViewportState();
    };
    const handleResize = () => {
      measurePagePositions();
      updatePdfViewportState();
    };
    wrapper.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      wrapper.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [measurePagePositions, updatePdfViewportState]);

  // ---------- ZOOM & PAN ----------
  // Zoom now affects individual pages, not a single canvas
  // The scale is applied via react-pdf's scale prop on each Page component

  // wheel zoom (Ctrl + wheel for fine zoom) - only affects document pages
  useEffect(() => {
    const wrapper = viewerZoomWrapperRef.current;
    if (!wrapper) return;

    let isPointerDownPan = false;
    let panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };

    const onWheel = (ev) => {
      // zoom when ctrlKey
      if (ev.ctrlKey) {
        ev.preventDefault();
        const delta = -ev.deltaY;
        const step = delta > 0 ? 0.05 : -0.05;
        
        if (isHighlightView) {
          // In highlight view: control crop zoom, not page scale
          setHighlightViewCropZoom(prev => clamp(+(prev + step).toFixed(2), 1.0, 2.5));
        } else {
          // Normal mode: control page scale
          setPrimaryScale(prev => clamp(+(prev + step).toFixed(2), 0.5, 3));
          // Re-measure after zoom
          setTimeout(measurePagePositions, 50);
        }
      }
    };

    const onPointerDown = (ev) => {
      // pan with middle button or while holding Spacebar (common in LT)
      if (ev.button === 1 || ev.shiftKey || ev.code === 'Space') { // shift/space detection for pointerDown is heuristic
        isPointerDownPan = true;
        panStart = { x: ev.clientX, y: ev.clientY, scrollLeft: wrapper.scrollLeft, scrollTop: wrapper.scrollTop };
        wrapper.setPointerCapture?.(ev.pointerId);
      }
    };
    const onPointerMove = (ev) => {
      if (!isPointerDownPan) return;
      ev.preventDefault();
      const dx = ev.clientX - panStart.x;
      const dy = ev.clientY - panStart.y;
      wrapper.scrollLeft = panStart.scrollLeft - dx;
      wrapper.scrollTop = panStart.scrollTop - dy;
    };
    const onPointerUp = (ev) => {
      if (isPointerDownPan) {
        isPointerDownPan = false;
        try { wrapper.releasePointerCapture?.(ev.pointerId); } catch {}
      }
    };

    wrapper.addEventListener('wheel', onWheel, { passive: false });
    
    return () => {
      wrapper.removeEventListener('wheel', onWheel);
      wrapper.removeEventListener('pointerdown', onPointerDown);
      wrapper.removeEventListener('pointermove', onPointerMove);
      wrapper.removeEventListener('pointerup', onPointerUp);
      wrapper.removeEventListener('pointercancel', onPointerUp);
    };
  }, [measurePagePositions, isHighlightView]);

  // ---------- small helpers ----------
  const handleDeleteAnnotation = useCallback((id) => {
    updateAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, [updateAnnotations]);

  const handleToggleRightPanel = useCallback(() => {
    setIsRightPanelCollapsed(prev => !prev);
  }, []);

  const handleToggleClippingsPanel = useCallback(() => {
    setIsClippingsPanelCollapsed(prev => !prev);
  }, []);

  const handleWorkspaceResizeStart = useCallback((event) => {
    event.preventDefault();
    workspaceResizeMetaRef.current = {
      startX: event.clientX,
      startSlide: workspaceSlide,
    };
    setIsWorkspaceResizing(true);
  }, [workspaceSlide]);

  const handleWorkspaceResizeKeyDown = useCallback((event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 40 : -40;
    const maxSlide = Math.max(WORKSPACE_SLIDE_MIN, workspaceWidth);
    setWorkspaceSlide((prev) => clamp(prev + delta, WORKSPACE_SLIDE_MIN, maxSlide));
  }, [workspaceWidth]);

  const handleManualZoom = useCallback((direction) => {
    setPrimaryScale(prev => {
      const delta = direction === 'in' ? 0.05 : -0.05;
      return clamp(+(prev + delta).toFixed(2), 0.5, 3);
    });
  }, []);

  const handleRemoveClipping = useCallback((clippingId) => {
    setClippings(prev => prev.filter(c => c.id !== clippingId));
    setWorkspaceItems((prev) =>
      prev.filter(
        (it) =>
          getWorkspaceItemType(it) !== 'clip' ||
          getWorkspaceItemSourceId(it) !== clippingId,
      ),
    );
    setSelectedClippings(prev => prev.filter(id => id !== clippingId));
  }, []);

  const handleRemoveBookmark = useCallback((bookmarkId) => {
    setBookmarks((prev) => prev.filter((bookmark) => bookmark.id !== bookmarkId));
  }, []);

  const handleDeleteWorkspaceComment = useCallback((commentId) => {
    if (!commentId) return;
    setWorkspaceComments((prev) => prev.filter((c) => c.id !== commentId));
    setWorkspaceItems((prev) =>
      prev.filter(
        (it) =>
          getWorkspaceItemType(it) !== 'comment' ||
          getWorkspaceItemSourceId(it) !== commentId,
      ),
    );
  }, []);

  const handleToolSelect = useCallback((toolId) => {
    if (toolId === 'freehand') {
      if (activeTool === 'freehand') {
        setIsFreehandPaletteOpen(prev => !prev);
      } else {
        setActiveTool('freehand');
        dismissFreehandPalette();
      }
      return;
    }
    dismissFreehandPalette();

    if (toolId === 'underline') {
      applyLineAnnotation('underline');
      return;
    }
    if (toolId === 'strike') {
      applyLineAnnotation('strike');
      return;
    }
    if (toolId === 'textHighlight') {
      applyLineAnnotation('textHighlight');
      return;
    }
    if (toolId === 'comment') {
      setActiveTool('comment');
      return;
    }
    setActiveTool(toolId);
  }, [activeTool, applyLineAnnotation, dismissFreehandPalette]);

  // ---------- Global pointer handlers for smooth dragging ----------
  useEffect(() => {
    const handleGlobalPointerMove = (event) => {
      if (draggingAnnotationId.current) {
        const { pageNumber } = draggingAnnotationMetaRef.current;
        const overlay = overlayRefs.current[pageNumber];
        if (overlay) {
          handlePointerMove(event, pageNumber, pageNumber);
        }
      }
      if (draggingBookmarkId.current) {
        const bookmark = bookmarks.find(b => b.id === draggingBookmarkId.current);
        if (bookmark) {
          const overlay = overlayRefs.current[bookmark.pageNumber];
          if (overlay) {
            handlePointerMove(event, bookmark.pageNumber, bookmark.pageNumber);
          }
        }
      }
    };

    const handleGlobalPointerUp = (event) => {
      if (draggingAnnotationId.current) {
        const { pageNumber } = draggingAnnotationMetaRef.current;
        handlePointerUp(event, pageNumber, pageNumber);
      }
      if (draggingBookmarkId.current) {
        const bookmark = bookmarks.find(b => b.id === draggingBookmarkId.current);
        if (bookmark) {
          handlePointerUp(event, bookmark.pageNumber, bookmark.pageNumber);
        }
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [handlePointerMove, handlePointerUp, bookmarks]);

  const ocrApi = useMemo(() => ({
    isRunning: isOcrRunning,
    isClippingRunning: isClippingOcrRunning,
    progress: ocrProgress,
    results: ocrResults,
  }), [isOcrRunning, isClippingOcrRunning, ocrProgress, ocrResults]);

  const selectionApi = useMemo(() => ({
    menu: selectionMenu,
    createCommentFromSelection: handleCreateCommentFromSelection,
    createClipFromSelection: handleClipSelection,
  }), [selectionMenu, handleCreateCommentFromSelection, handleClipSelection]);

  const handleToggleSearchBar = useCallback(() => {
    setIsSearchBarOpen(prev => !prev);
  }, []);

  const handleCloseSearchBar = useCallback(() => {
    setIsSearchBarOpen(false);
  }, []);

  const toolbarApi = useMemo(() => ({
    activeTool,
    selectTool: handleToolSelect,
    manualZoom: handleManualZoom,
    primaryScale,
    color: activeColor,
    setColor: setActiveColor,
    brushSize: activeBrushSize,
    setBrushSize: setActiveBrushSize,
    brushOpacity: activeBrushOpacity,
    setBrushOpacity: setActiveBrushOpacity,
    freehandMode,
    setFreehandMode,
    isPressureEnabled,
    setIsPressureEnabled,
    isPaletteOpen: isFreehandPaletteOpen,
    dismissPalette: dismissFreehandPalette,
    isFreehandCommentMode,
    setIsFreehandCommentMode,
    searchTerm,
    setSearchTerm,
    isHighlightView,
    setIsHighlightView,
    highlightViewCropZoom,
    setHighlightViewCropZoom,
    isTablet,
    isSearchBarOpen,
    toggleSearchBar: handleToggleSearchBar,
    closeSearchBar: handleCloseSearchBar,
  }), [
    activeTool,
    handleToolSelect,
    handleManualZoom,
    primaryScale,
    activeColor,
    activeBrushSize,
    activeBrushOpacity,
    freehandMode,
    isPressureEnabled,
    isFreehandPaletteOpen,
    dismissFreehandPalette,
    isFreehandCommentMode,
    searchTerm,
    isHighlightView,
    highlightViewCropZoom,
    isTablet,
    isSearchBarOpen,
    handleToggleSearchBar,
    handleCloseSearchBar,
  ]);

  const clippingsApi = useMemo(() => ({
    items: clippings,
    selectedIds: selectedClippings,
    createFromSelection: handleClipSelection,
    combineSelected: handleCombineClippings,
    toggleSelection: toggleClippingSelection,
    startDrag: handleClippingDragStart,
    reorder: handleReorderClipping,
    remove: handleRemoveClipping,
    uncombine: handleUncombineClipping,
    jumpToPage: setPrimaryPage,
    resolvePrimaryPage: getPrimaryPageFromSource,
    isCollapsed: isClippingsPanelCollapsed,
    toggleCollapse: handleToggleClippingsPanel,
  }), [
    clippings,
    selectedClippings,
    handleClipSelection,
    handleCombineClippings,
    toggleClippingSelection,
    handleClippingDragStart,
    handleReorderClipping,
    handleRemoveClipping,
    handleUncombineClipping,
    setPrimaryPage,
    isClippingsPanelCollapsed,
    handleToggleClippingsPanel,
  ]);

  const searchApi = useMemo(() => ({
    isSearching,
    results: searchResults,
    activeIndex: activeSearchResultIndex,
    goToNextResult: goToNextSearchResult,
    goToPreviousResult: goToPreviousSearchResult,
  }), [isSearching, searchResults, activeSearchResultIndex, goToNextSearchResult, goToPreviousSearchResult]);

  const rightPanelApi = useMemo(() => ({
    isCollapsed: isRightPanelCollapsed,
    toggleCollapse: handleToggleRightPanel,
    annotationFilters,
    toggleAnnotationFilter,
    annotationDescriptions,
    filteredAnnotations,
    onAnnotationJump: handleAnnotationJump,
    onDeleteAnnotation: handleDeleteAnnotation,
    bookmarks,
    onBookmarkJump: setPrimaryPage,
    onBookmarkRemove: handleRemoveBookmark,
  }), [
    isRightPanelCollapsed,
    handleToggleRightPanel,
    annotationFilters,
    toggleAnnotationFilter,
    annotationDescriptions,
    filteredAnnotations,
    handleAnnotationJump,
    handleDeleteAnnotation,
    bookmarks,
    setPrimaryPage,
    handleRemoveBookmark,
  ]);

  const workspaceApi = useMemo(() => ({
    slide: workspaceSlide,
    visibleWidth: workspaceVisibleWidth,
    width: workspaceWidth,
    items: workspaceItems,
    comments: workspaceComments,
    ref: workspaceRef,
    draggingItemIdRef: draggingWorkspaceItemId,
    startMoveItem: startMoveWorkspaceItem,
    moveItem: handleWorkspacePointerMove,
    endMoveItem: endMoveWorkspaceItem,
    clickItem: handleWorkspaceItemClick,
    deleteComment: handleDeleteWorkspaceComment,
    removeClipping: handleRemoveClipping,
    pulseHighlight: pulseTemporaryHighlight,
    onJumpToPage: setPrimaryPage,
    isResizing: isWorkspaceResizing,
    resizeStart: handleWorkspaceResizeStart,
    resizeKeyDown: handleWorkspaceResizeKeyDown,
    activeTool,
    activeColor,
    activeBrushSize,
    activeBrushOpacity,
    freehandMode,
    isPressureEnabled,
  }), [
    workspaceSlide,
    workspaceVisibleWidth,
    workspaceWidth,
    workspaceItems,
    workspaceComments,
    workspaceRef,
    draggingWorkspaceItemId,
    startMoveWorkspaceItem,
    handleWorkspacePointerMove,
    endMoveWorkspaceItem,
    handleWorkspaceItemClick,
    handleDeleteWorkspaceComment,
    handleRemoveClipping,
    pulseTemporaryHighlight,
    setPrimaryPage,
    isWorkspaceResizing,
    handleWorkspaceResizeStart,
    handleWorkspaceResizeKeyDown,
    activeTool,
    activeColor,
    activeBrushSize,
    activeBrushOpacity,
    freehandMode,
    isPressureEnabled,
  ]);

  const documentApi = useMemo(() => ({
    numPages,
    onDocumentLoadSuccess,
    viewerDeckRef,
    viewerZoomWrapperRef,
    isPdfOutOfViewport,
    overlayRefs,
    pageRefs,
    primaryScale,
    activeTool,
    activeColor,
    filteredAnnotations,
    searchHighlights: searchHighlightOverlays,
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
    highlightViewCropZoom,
  }), [
    numPages,
    onDocumentLoadSuccess,
    viewerDeckRef,
    viewerZoomWrapperRef,
    isPdfOutOfViewport,
    overlayRefs,
    pageRefs,
    primaryScale,
    activeTool,
    activeColor,
    filteredAnnotations,
    searchHighlightOverlays,
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
    highlightViewCropZoom,
  ]);

  const connectorsApi = useMemo(() => ({
    items: workspaceItems,
    comments: workspaceComments,
    clippings,
    computePoints: computeConnectorPoints,
  }), [workspaceItems, workspaceComments, clippings, computeConnectorPoints]);

  return {
    ocr: ocrApi,
    selection: selectionApi,
    toolbar: toolbarApi,
    clippings: clippingsApi,
    search: searchApi,
    rightPanel: rightPanelApi,
    workspace: workspaceApi,
    document: documentApi,
    connectors: connectorsApi,
  };
};

export default useDocumentWorkspaceController;
