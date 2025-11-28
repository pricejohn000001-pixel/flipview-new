// useOcr.js ← FINAL, COMPILATION-FIXED VERSION FOR TESSERACT.JS v6
import { useState, useRef, useCallback, useEffect } from 'react';
import { createWorker } from 'tesseract.js';

const DEFAULT_SCALE = 3.0;
const WORKER_COUNT = 3;

const useOcr = ({ pdfProxyRef }) => {
  const [ocrResults, setOcrResults] = useState({});
  const [ocrProgress, setOcrProgress] = useState({});
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [isClippingOcrRunning, setIsClippingOcrRunning] = useState(false);

  const workerPoolRef = useRef([]);
  const activeJobsRef = useRef(0);
  const isBatchRunningRef = useRef(false);

  const beginJob = useCallback(() => {
    activeJobsRef.current++;
    if (activeJobsRef.current === 1) setIsOcrRunning(true);
  }, []);

  const endJob = useCallback(() => {
    activeJobsRef.current = Math.max(0, activeJobsRef.current - 1);
    if (activeJobsRef.current === 0) setIsOcrRunning(false);
  }, []);

  // -------------------- WORKER POOL (Tesseract.js v6) --------------------
  const ensureWorkers = useCallback(async () => {
    if (workerPoolRef.current.length >= WORKER_COUNT) {
      return workerPoolRef.current;
    }

    const workers = [];
    for (let i = 0; i < WORKER_COUNT; i++) {
      const worker = await createWorker('eng', 1); // language + OEM
      workers.push(worker);
    }
    workerPoolRef.current = workers;
    return workers;
  }, []);

  // -------------------- DETECT REAL TEXT LAYER --------------------
  const hasRealTextLayer = useCallback(async (pageNumber) => {
    try {
      const page = await pdfProxyRef.current.getPage(pageNumber);
      const content = await page.getTextContent();
      const raw = content.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();

      if (!raw || raw.length < 50) return false;
      const letters = raw.match(/[A-Za-z]/g) || [];
      if (letters.length < 10 || letters.length / raw.length < 0.25) return false;
      const words = raw.split(/\s+/);
      if (words.length < 8) return false;
      return words.some(w => w.length > 5);
    } catch {
      return false;
    }
  }, [pdfProxyRef]);

  // -------------------- NATIVE PDF TEXT --------------------
  const extractPdfTextLayer = useCallback(async (pageNumber) => {
    const page = await pdfProxyRef.current.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const items = content.items.map(item => ({
      text: item.str,
      bbox: {
        x0: item.transform[4],
        x1: item.transform[4] + item.width,
        y0: item.transform[5] - item.height,
        y1: item.transform[5],
      },
      confidence: 100,
    }));

    const text = items.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
    return {
      text,
      words: items,
      isPdfText: true,
      metrics: {
        baseWidth: baseViewport.width,
        baseHeight: baseViewport.height,
        sourceWidth: baseViewport.width,
        sourceHeight: baseViewport.height,
        ocrScale: 1,
      },
    };
  }, [pdfProxyRef]);

  // -------------------- RENDER PAGE --------------------
  const renderPageToCanvas = useCallback(async (pageNumber) => {
    const page = await pdfProxyRef.current.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: DEFAULT_SCALE });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    return { canvas, viewport, baseViewport };
  }, [pdfProxyRef]);

  // -------------------- LAYOUT-PRESERVING OCR (v6) --------------------
  const recognizePageWithWorker = useCallback(async (pageNumber, worker) => {
    beginJob();
    let interval = null;

    try {
      const { canvas, viewport, baseViewport } = await renderPageToCanvas(pageNumber);

      const start = Date.now();
      interval = setInterval(() => {
        const p = Math.min(((Date.now() - start) / 7000) * 95, 95);
        setOcrProgress(prev => ({
          ...prev,
          [pageNumber]: { progress: Math.round(p), status: 'Recognizing...' }
        }));
      }, 200);

      const { data } = await worker.recognize(
        canvas.toDataURL('image/png'),
        { 
          tessedit_pageseg_mode: '1',
          preserve_interword_spaces: '1'
        },
        { hocr: true, tsv: true }
      );

      const { width: pageWidth, height: pageHeight } = viewport;
      const { width: basePageWidth, height: basePageHeight } = baseViewport || {};

      // Normalize bbox coordinates (0-1) in page space with origin at top-left.
      const convert = bbox => ({
        x0: Math.max(0, Math.min(1, bbox.x0 / pageWidth)),
        x1: Math.max(0, Math.min(1, bbox.x1 / pageWidth)),
        y0: Math.max(0, Math.min(1, bbox.y0 / pageHeight)),
        y1: Math.max(0, Math.min(1, bbox.y1 / pageHeight)),
      });

      // Primary: use data.words (available in most v6 builds)
      let words = [];
      if (data.words?.length) {
        words = data.words.map(w => ({
          text: w.text,
          confidence: Math.round(w.confidence),
          bbox: convert(w.bbox),
          font: {
            family: w.font_name || null,
            size: typeof w.font_size === 'number' ? w.font_size : null,
            isBold: Boolean(w.is_bold),
            isItalic: Boolean(w.is_italic),
            isMonospace: Boolean(w.is_monospace),
            lineHeight: typeof w.line_height === 'number' ? w.line_height : null,
          },
        }));
      } else if (data.tsv) {
        // Fallback: parse TSV manually (fixed duplicate 'line' bug)
        const tsvLines = data.tsv.split('\n').filter(l => l.trim());
        words = tsvLines.map(rawLine => {
          const cols = rawLine.split('\t');
          const level = cols[0];
          const wordText = cols[11];           // text is column 12 (0-indexed 11)
          const conf = cols[10];
          const left = parseInt(cols[6] || 0);
          const top = parseInt(cols[7] || 0);
          const width = parseInt(cols[8] || 0);
          const height = parseInt(cols[9] || 0);

          if (level === '5' && conf !== '-1' && wordText) {
            return {
              text: wordText,
              confidence: Math.round(parseFloat(conf)),
              bbox: convert({
                x0: left,
                y0: top,
                x1: left + width,
                y1: top + height,
              }),
            };
          }
          return null;
        }).filter(Boolean);
      }

      const fullText = data.text?.trim() || '';
      const avgConf = data.confidence ? Math.round(data.confidence) : 90;

      const metrics = {
        baseWidth: basePageWidth || pageWidth / DEFAULT_SCALE,
        baseHeight: basePageHeight || pageHeight / DEFAULT_SCALE,
        sourceWidth: pageWidth,
        sourceHeight: pageHeight,
        ocrScale: DEFAULT_SCALE,
      };

      setOcrResults(prev => ({
        ...prev,
        [pageNumber]: {
          text: fullText,
          confidence: avgConf,
          words,
          lines: (data.lines || []).map(l => ({ text: l.text, bbox: convert(l.bbox) })),
          hocr: data.hocr,
          isPdfText: false,
          metrics,
        }
      }));

      setOcrProgress(prev => ({
        ...prev,
        [pageNumber]: { progress: 100, status: 'Done' }
      }));

      return { text: fullText, words };

    } catch (err) {
      console.error('OCR error on page', pageNumber, err);
      setOcrProgress(prev => ({
        ...prev,
        [pageNumber]: { progress: 0, status: 'Failed' }
      }));
      return null;
    } finally {
      if (interval) clearInterval(interval);
      endJob();
    }
  }, [renderPageToCanvas, beginJob, endJob]);

  // -------------------- UNIFIED EXTRACTION --------------------
  const extractTextForPage = useCallback(async (pageNumber, worker) => {
    const hasText = await hasRealTextLayer(pageNumber);
    if (hasText) {
      const res = await extractPdfTextLayer(pageNumber);
      setOcrResults(prev => ({
        ...prev,
        [pageNumber]: {
          text: res.text,
          confidence: 100,
          words: res.words,
          lines: [],
          isPdfText: true,
          metrics: res.metrics,
        }
      }));
      setOcrProgress(prev => ({ ...prev, [pageNumber]: { progress: 100, status: 'Native text' } }));
      return res;
    }
    return recognizePageWithWorker(pageNumber, worker);
  }, [hasRealTextLayer, extractPdfTextLayer, recognizePageWithWorker]);

  // -------------------- PUBLIC API --------------------
  const runOcrOnPage = useCallback(async (pageNumber) => {
    const workers = await ensureWorkers();
    if (!workers.length) return null;
    return extractTextForPage(pageNumber, workers[0]);
  }, [ensureWorkers, extractTextForPage]);

  const runOcrOnAllPages = useCallback(async () => {
    if (!pdfProxyRef.current || isBatchRunningRef.current) return 0;
    const total = pdfProxyRef.current.numPages;
    const workers = await ensureWorkers();
    if (!workers.length) return 0;

    isBatchRunningRef.current = true;
    const tasks = [];
    for (let p = 1; p <= total; p++) {
      tasks.push(extractTextForPage(p, workers[(p - 1) % workers.length]));
    }
    await Promise.allSettled(tasks);
    isBatchRunningRef.current = false;
    return total;
  }, [pdfProxyRef, ensureWorkers, extractTextForPage]);

  const extractTextFromArea = useCallback(async (clipRect, pageNumber) => {
    if (!clipRect || !pageNumber) return null;
    setIsClippingOcrRunning(true);
    try {
      const workers = await ensureWorkers();
      const { canvas } = await renderPageToCanvas(pageNumber);
      const worker = workers[0];

      const x = clipRect.x * canvas.width;
      const y = clipRect.y * canvas.height;
      const w = clipRect.width * canvas.width;
      const h = clipRect.height * canvas.height;

      const cropped = document.createElement('canvas');
      cropped.width = w; cropped.height = h;
      cropped.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);

      const { data } = await worker.recognize(
        cropped.toDataURL('image/png'),
        {},
        { hocr: true, tsv: true }
      );

      return { text: data.text?.trim() || '', confidence: Math.round(data.confidence || 0) };
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setIsClippingOcrRunning(false);
    }
  }, [ensureWorkers, renderPageToCanvas]);

  // -------------------- CLEANUP --------------------
  useEffect(() => {
    return () => {
      workerPoolRef.current.forEach(w => w.terminate());
      workerPoolRef.current = [];
    };
  }, []);

  return {
    ocrResults,
    ocrProgress,
    isOcrRunning,
    isClippingOcrRunning,
    runOcrOnPage,
    runOcrOnAllPages,
    extractTextFromArea,
  };
};

export default useOcr;