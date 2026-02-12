// src/utils/connectors/annotationApi.js
import { apiPost, apiGet } from './api';

const ANNOTATION_ENDPOINT = 'user/pdf-anotation?action=store-anotation';
const GET_ANNOTATION_ENDPOINT = 'user/pdf-anotation?action=get-anotation';

/**
 * Transform internal annotation format to API format
 * @param {Object} annotation - Internal annotation object
 * @param {number} pdfId - PDF document ID
 * @returns {Object} API-formatted annotation data
 */
const transformAnnotationForAPI = (annotation, pdfId) => {
    const basePayload = {
        pdf_id: pdfId,
        page_number: annotation.pageNumber || parseInt(String(annotation.sourcePage).split(',')[0]) || 1,
        type: annotation.type,
        color: annotation.color || '#FFFF00',
    };

    switch (annotation.type) {
        case 'highlight': {
            // Handle both area highlights (position) and text highlights (rects)
            const rects = annotation.rects || (annotation.position ? [{
                x: annotation.position.x,
                y: annotation.position.y,
                width: annotation.position.width,
                height: annotation.position.height,
            }] : []);

            return {
                ...basePayload,
                opacity: annotation.opacity ?? 0.6,
                rects: rects.map(rect => ({
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                })),
            };
        }

        case 'underline':
        case 'strike': {
            return {
                ...basePayload,
                stroke_width: annotation.strokeWidth || 2,
                lines: (annotation.lines || []).map(line => ({
                    x1: line.x1,
                    y1: line.y1,
                    x2: line.x2,
                    y2: line.y2,
                })),
            };
        }


        case 'freehand': {
            return {
                ...basePayload,
                brush_size: annotation.brushSize || annotation.strokeWidth || 3,
                opacity: annotation.opacity ?? 1,
                points: (annotation.points || []).map(point => ({
                    x: point.x,
                    y: point.y,
                })),
            };
        }

        case 'comment': {
            const position = annotation.position || { x: 0.5, y: 0.5, width: 0.05, height: 0.05 };
            return {
                ...basePayload,
                content: annotation.content || '',
                linked_text: annotation.linkedText || null,
                position_x: position.x,
                position_y: position.y,
                position_width: position.width || 0.05,
                position_height: position.height || 0.05,
            };
        }

        case 'clipping': {
            const hasSegments = Array.isArray(annotation.segments) && annotation.segments.length > 0;
            const primaryFromSource = parseInt(String(annotation.sourcePage).split(',')[0], 10);
            let sourcePageInt = Number.isFinite(primaryFromSource) ? primaryFromSource : (annotation.pageNumber || 1);

            if (hasSegments) {
                // For combined clips / segments
                const segPrimary = parseInt(String(annotation.segments[0]?.sourcePage).split(',')[0], 10);
                if (Number.isFinite(segPrimary)) {
                    sourcePageInt = segPrimary;
                }

                return {
                    ...basePayload,
                    type: 'clipping', // Ensure type is clipping as per example
                    clipping: {
                        content: annotation.content || 'Combined clipping', // Ensure this is not empty
                        source_page: sourcePageInt,
                        source: annotation.source || 'PDF', // Default to PDF for combined
                    },
                    segments: annotation.segments.map((seg, idx) => ({
                        segment_clipping_id: seg.segmentClippingId ?? seg.id ?? seg.segment_clipping_id,
                        label: seg.label ?? `Segment ${idx + 1}`,
                        clipping_order: Number.isFinite(seg.clippingOrder) ? seg.clippingOrder : (idx + 1),
                        content: seg.content || '', // Add per-segment content
                    })),
                };
            } else {
                // For individual clippings
                const rect = annotation.sourceRect || { x: 0, y: 0, width: 0, height: 0 };
                return {
                    ...basePayload,
                    type: 'clipping',
                    clipping: {
                        content: annotation.content || '',
                        source_page: sourcePageInt,
                        source_rect_x: rect.x,
                        source_rect_y: rect.y,
                        source_rect_width: rect.width,
                        source_rect_height: rect.height,
                        source: annotation.source || 'OCR',
                        confidence: annotation.confidence ?? 0.88,
                        type: 'text',
                    },
                };
            }
        }

        default:
            console.warn(`Unknown annotation type: ${annotation.type}`);
            return null;
    }
};

/**
 * Save a single annotation to the backend
 * @param {Object} annotation - Internal annotation object
 * @param {number} pdfId - PDF document ID
 * @returns {Promise<Object>} API response
 */
export const saveAnnotation = async (annotation, pdfId) => {
    try {
        const payload = transformAnnotationForAPI(annotation, pdfId);

        if (!payload) {
            throw new Error(`Cannot transform annotation type: ${annotation.type}`);
        }

        console.log(`[AnnotationAPI] Saving ${annotation.type} annotation:`, payload);

        const response = await apiPost(ANNOTATION_ENDPOINT, payload);

        console.log(`[AnnotationAPI] Successfully saved annotation ${annotation.id}`, response);

        return {
            success: true,
            annotationId: annotation.id,
            response,
        };
    } catch (error) {
        console.error(`[AnnotationAPI] Failed to save annotation ${annotation.id}:`, error);

        return {
            success: false,
            annotationId: annotation.id,
            error: error.message || 'Unknown error',
        };
    }
};

/**
 * Save multiple annotations in batch
 * @param {Array<Object>} annotations - Array of internal annotation objects
 * @param {number} pdfId - PDF document ID
 * @returns {Promise<Array<Object>>} Array of save results
 */
export const saveAnnotations = async (annotations, pdfId) => {
    if (!Array.isArray(annotations) || annotations.length === 0) {
        return [];
    }

    console.log(`[AnnotationAPI] Batch saving ${annotations.length} annotations for PDF ${pdfId}`);

    // Save annotations sequentially to avoid overwhelming the server
    const results = [];
    for (const annotation of annotations) {
        const result = await saveAnnotation(annotation, pdfId);
        results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    console.log(`[AnnotationAPI] Batch save complete: ${successCount} succeeded, ${failureCount} failed`);

    return results;
};

/**
 * Transform API annotation format to internal format
 * @param {Object} apiAnnotation - Annotation data from API
 * @returns {Object} Internal annotation object
 */
const transformAnnotationFromAPI = (apiAnnotation) => {
    const baseAnnotation = {
        id: apiAnnotation.id || `annotation-${Date.now()}-${Math.random()}`,
        pageNumber: apiAnnotation.page_number,
        type: apiAnnotation.type,
        color: apiAnnotation.color || '#FFFF00',
        createdAt: apiAnnotation.created_at,
    };

    switch (apiAnnotation.type) {
        case 'highlight': {
            return {
                ...baseAnnotation,
                opacity: apiAnnotation.opacity ?? 0.6,
                rects: apiAnnotation.rects || [],
                position: apiAnnotation.rects?.[0] || null,
            };
        }

        case 'underline':
        case 'strike': {
            return {
                ...baseAnnotation,
                strokeWidth: apiAnnotation.stroke_width || 2,
                lines: apiAnnotation.lines || [],
            };
        }

        case 'freehand': {
            return {
                ...baseAnnotation,
                brushSize: apiAnnotation.brush_size || 3,
                strokeWidth: apiAnnotation.brush_size || 3,
                opacity: apiAnnotation.opacity ?? 1,
                points: apiAnnotation.points || [],
            };
        }

        case 'comment': {
            return {
                ...baseAnnotation,
                content: apiAnnotation.content || '',
                linkedText: apiAnnotation.linked_text || null,
                position: {
                    x: parseFloat(apiAnnotation.position_x) || 0.5,
                    y: parseFloat(apiAnnotation.position_y) || 0.5,
                    width: parseFloat(apiAnnotation.position_width) || 0.05,
                    height: parseFloat(apiAnnotation.position_height) || 0.05,
                },
            };
        }

        default:
            if (apiAnnotation.clipping || (apiAnnotation.type === 'text' && apiAnnotation.source_rect_x)) {
                const c = apiAnnotation.clipping || apiAnnotation;
                const normalizePage = (val) => {
                    const n = parseInt(val, 10);
                    if (!Number.isFinite(n)) return 1;
                    return n < 1 ? n + 1 : n;
                };
                const segments = (apiAnnotation.segments || []).map(s => {
                    const segPage = normalizePage(s.source_page ?? s.page_number ?? c.source_page);
                    const segRect = {
                        x: parseFloat(s.source_rect_x ?? c.source_rect_x) || 0,
                        y: parseFloat(s.source_rect_y ?? c.source_rect_y) || 0,
                        width: parseFloat(s.source_rect_width ?? c.source_rect_width) || 0,
                        height: parseFloat(s.source_rect_height ?? c.source_rect_height) || 0,
                    };
                    return {
                        segmentClippingId: s.segment_clipping_id,
                        id: s.segment_clipping_id,
                        label: s.label,
                        clippingOrder: s.clipping_order,
                        sourcePage: segPage,
                        sourceRect: segRect,
                        content: '',
                    };
                });
                const isCombined = segments.length > 0;
                return {
                    id: apiAnnotation.id || `clipping-${Date.now()}`,
                    type: isCombined ? 'combined' : 'clipping',
                    pageNumber: normalizePage(apiAnnotation.page_number),
                    content: c.content,
                    sourcePage: normalizePage(c.source_page),
                    sourceRect: {
                        x: parseFloat(c.source_rect_x) || 0,
                        y: parseFloat(c.source_rect_y) || 0,
                        width: parseFloat(c.source_rect_width) || 0,
                        height: parseFloat(c.source_rect_height) || 0,
                    },
                    source: c.source,
                    createdAt: apiAnnotation.created_at || new Date().toISOString(),
                    segments: isCombined ? segments : undefined,
                };
            }

            console.warn(`Unknown annotation type from API: ${apiAnnotation.type}`);
            return null;
    }
};

/**
 * Fetch annotations for a specific PDF and user
 * @param {number} pdfId - PDF document ID
 * @param {number} userId - User ID
 * @returns {Promise<Array<Object>>} Array of internal annotation objects
 */
export const fetchAnnotations = async (pdfId, userId) => {
    try {
        console.log(`[AnnotationAPI] Fetching annotations for PDF ${pdfId}, User ${userId}`);

        const response = await apiGet(GET_ANNOTATION_ENDPOINT, {
            pdf_id: pdfId,
            user_id: userId,
        });

        console.log(`[AnnotationAPI] Raw API response:`, response);

        // The axios interceptor already unwraps response.data, so response IS the data
        // Check if annotations are directly in response or nested in response.data
        const annotationsData = Array.isArray(response)
            ? response
            : (Array.isArray(response?.data) ? response.data : response?.annotations || []);

        const clippingsData = response?.clippings || [];

        const allItems = [...annotationsData, ...clippingsData];

        console.log(`[AnnotationAPI] Combined data array (annotations + clippings):`, allItems);

        // Transform API items to internal format
        const annotations = allItems.map(transformAnnotationFromAPI).filter(Boolean);

        console.log(`[AnnotationAPI] Transformed annotations:`, annotations);
        console.log(`[AnnotationAPI] Successfully loaded ${annotations.length} annotations`);

        return annotations;
    } catch (error) {
        console.error(`[AnnotationAPI] Failed to fetch annotations:`, error);
        return [];
    }
};
