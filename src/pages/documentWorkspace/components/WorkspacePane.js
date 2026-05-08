import React, { useRef, useEffect } from 'react';
import { MdBookmark, MdClose } from 'react-icons/md';
import WorkspaceFreehandLayer from './WorkspaceFreehandLayer';
import styles from '../documentWorkspace.module.css';
import {
  DEFAULT_BRUSH_OPACITY,
  DEFAULT_BRUSH_SIZE,
  WORKSPACE_ERASER_TOOL_ID,
} from '../constants';
import {
  getPrimaryPageFromSource,
  getWorkspaceItemSourceId,
  getWorkspaceItemType,
} from '../utils';

const WorkspacePane = ({
  workspaceSlide,
  workspaceWidth,
  workspaceItems,
  workspaceComments,
  workspaceRef,
  clippings,
  draggingWorkspaceItemIdRef,
  startMoveWorkspaceItem,
  handleWorkspacePointerMove,
  endMoveWorkspaceItem,
  handleWorkspaceItemClick,
  handleRemoveClipping,
  handleDeleteWorkspaceComment,
  onJumpToPage,
  onPulseHighlight,
  activeTool,
  activeColor,
  activeBrushSize,
  activeBrushOpacity,
  freehandMode,
  isPressureEnabled,
  eraserToolId = WORKSPACE_ERASER_TOOL_ID,

  selectedClipIds = [],
  onToggleClipSelection,
  workspaceZoom = 1,
  workspacePan = { x: 0, y: 0 },
  onWorkspaceWheel,
  onWorkspacePanStart,
  onWorkspacePanMove,
  onWorkspacePanEnd,
  workspaceContainerRef,
  tempHighlightItemId, // Add missing prop
}) => {
  const draggingWorkspaceItemId = draggingWorkspaceItemIdRef?.current;
  const pointerMetaRef = useRef({});
  // Use the containerRef passed from the controller (for coordinate math)
  // Fall back to a local ref if not provided
  const localContainerRef = useRef(null);
  const containerRef = workspaceContainerRef || localContainerRef;
  const freehandLayerRef = useRef(null);

  // Attach non-passive wheel listener for Ctrl+Zoom to work properly
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
      onWorkspaceWheel?.(e);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [onWorkspaceWheel]);

  const renderClipContent = (clip, itemId) => {
    if (clip?.segments) {
      return clip.segments.map((seg) => (
        <div
          key={seg.id}
          className={styles.workspaceSegment}
          onPointerDown={(e) => {
            // Do not stop propagation so the card can be dragged by its segments
          }}
          onClick={(e) => {
            e.stopPropagation();
            
            // Check if it was a drag or a click
            const meta = itemId ? pointerMetaRef.current[itemId] : null;
            if (meta) {
              const duration = e.timeStamp - meta.time;
              const distance = Math.hypot(e.clientX - meta.x, e.clientY - meta.y);
              if (distance > 4) {
                return; // It was a drag, ignore click
              }
            }

            const targetPage = getPrimaryPageFromSource(seg.sourcePage);
            if (targetPage) {
              onJumpToPage?.(targetPage);
            }
            if (seg.sourceRect) {
              onPulseHighlight?.({
                pageNumber: targetPage,
                position: { ...seg.sourceRect },
                color: '#ffe58a',
              });
            }
          }}
          style={{ pointerEvents: 'auto' }}
        >
          <span className={styles.workspaceSegmentLabel}>{seg.label}</span>
          <p>{seg.content}</p>
        </div>
      ));
    }
    return clip?.content;
  };

  return (
    <div
      ref={containerRef}
      className={styles.workspacePane}
      style={{
        width: `${workspaceWidth}px`,
        right: `${-workspaceSlide}px`,
        // Infinite Grid Background on the Container
        backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)',
        backgroundPosition: `${workspacePan.x}px ${workspacePan.y}px`,
        backgroundSize: `${24 * workspaceZoom}px ${24 * workspaceZoom}px`,
        backgroundColor: '#f8fafc',
        // overflow:clip (not hidden) prevents the 6000px canvas from creating
        // a scroll context — this is the key fix for scroll bleed during pan/zoom
        overflow: 'clip',
        overscrollBehavior: 'none',
        touchAction: 'none',
        cursor: (activeTool === 'freehand' || activeTool === eraserToolId) ? 'crosshair' : 'default',
      }}
      // Move pan handlers to container to work even in "void" space
      onPointerDown={(e) => {
        if (activeTool === 'freehand' || activeTool === eraserToolId) {
          freehandLayerRef.current?.handlePointerDown(e);
          return;
        }
        // Only trigger pan if not clicking strictly on an interactive item
        // (Bubbling will hit this, but we check target if needed, or rely on stopPropagation in items)
        onWorkspacePanStart?.(e);
      }}
      onPointerMove={(e) => {
        if (draggingWorkspaceItemIdRef?.current) {
          handleWorkspacePointerMove(e);
        } else if ((activeTool === 'freehand' || activeTool === eraserToolId) && freehandLayerRef.current?.isDrawing) {
          freehandLayerRef.current?.handlePointerMove(e);
        } else {
          onWorkspacePanMove?.(e);
        }
      }}
      onPointerUp={(e) => {
        // Always try to end drawing if active
        if (activeTool === 'freehand' || activeTool === eraserToolId) {
          freehandLayerRef.current?.handlePointerUp(e);
        }
        endMoveWorkspaceItem(e);
        onWorkspacePanEnd?.(e);
      }}
      onPointerLeave={(e) => {
        if (activeTool === 'freehand' || activeTool === eraserToolId) {
          // Optional: end drawing on leave? Or rely on global capture?
          // freehandLayerRef.current?.handlePointerUp(e);
        }
        onWorkspacePanEnd(e);
      }}
    >
      <div
        ref={workspaceRef}
        className={styles.workspaceCanvas}
        style={{
          // Large canvas to support "infinite" panning without hitting edges
          width: '6000px',
          height: '6000px',
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginTop: '-3000px',
          marginLeft: '-3000px',
          // Transform applies pan/zoom to items
          transform: `translate(${workspacePan.x}px, ${workspacePan.y}px) scale(${workspaceZoom})`,
          transformOrigin: '50% 50%',
          // contain:layout isolates this element's layout from the container,
          // preventing the 6000px size from affecting scroll bounds
          contain: 'layout',
          willChange: 'transform',
          cursor: draggingWorkspaceItemId ? 'grabbing' : 'grab',
          // Transparent background so the container grid shows through
          background: 'transparent',
        }}
      // Remove handlers from inner div as they are now on container
      >

        {
          workspaceItems.map((item) => {
            const itemType = getWorkspaceItemType(item);
            const sourceId = getWorkspaceItemSourceId(item);
            const clip = itemType === 'clip' ? clippings.find((c) => c.id === sourceId) : null;
            const comment =
              itemType === 'comment' ? workspaceComments.find((c) => c.id === sourceId) : null;
            if (itemType === 'clip' && !clip) return null;
            if (itemType === 'comment' && !comment) return null;
            const isDragging = draggingWorkspaceItemId === item.id;
            const isClipSelected =
              itemType === 'clip' && clip && selectedClipIds?.includes(clip.id);
            // Highlight check
            const isHighlighted = item.id === tempHighlightItemId;

            return (
              <div
                key={item.id}
                className={`${styles.workspaceItem} ${isDragging ? styles.dragging : ''} ${isClipSelected ? styles.workspaceItemSelected : ''
                  } ${isHighlighted ? styles.workspaceItemHighlight : ''}`}
                data-workspace-clip={itemType === 'clip' && clip ? clip.id : undefined}
                style={{
                  left: `${item.x * 100}%`,
                  top: `${item.y * 100}%`,
                  transform: isDragging ? 'translateZ(10px) scale(1.02)' : 'none',
                  zIndex: isDragging || isHighlighted ? 1000 : 1, // Boost zIndex for highlight too
                  boxShadow: isDragging
                    ? '0 20px 40px rgba(0,0,0,0.2)'
                    : '0 4px 12px rgba(0,0,0,0.1)',
                  backgroundColor: (itemType === 'clip' ? clip?.color : comment?.color) || '#ffffff',
                  borderColor: (itemType === 'clip' ? clip?.color : comment?.color) || '#e2e8f0',
                  color: ['#ffffff', '#fff', '#FFFFFF', '#FFF'].includes((itemType === 'clip' ? clip?.color : comment?.color) || '#ffffff') ? '#000000' : '#ffffff',
                }}
                onPointerDown={(ev) => {
                  startMoveWorkspaceItem(ev, item);
                  if (itemType === 'clip' && clip) {
                    pointerMetaRef.current[item.id] = {
                      x: ev.clientX,
                      y: ev.clientY,
                      time: ev.timeStamp,
                    };
                  }
                }}
                onClick={(ev) => {
                  const meta = pointerMetaRef.current[item.id];
                  pointerMetaRef.current[item.id] = undefined;

                  if (itemType === 'clip' && clip) {
                    // Ignore double-clicks; those are handled separately
                    if (ev.detail && ev.detail > 1) {
                      return;
                    }
                    if (meta) {
                      const duration = ev.timeStamp - meta.time;
                      const distance = Math.hypot(ev.clientX - meta.x, ev.clientY - meta.y);
                      // Treat as a "click to select" only if it was quick and not dragged
                      if (duration <= 250 && distance <= 4) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        onToggleClipSelection?.(clip.id);
                        return;
                      }
                    }
                  }

                  // Fallback: regular click behaviour (jump to source for comments / clips)
                  handleWorkspaceItemClick(item);
                }}
                onDoubleClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  handleWorkspaceItemClick(item);
                }}
              >
                {itemType === 'clip' && (
                  <div
                    className={styles.workspaceClipCard}
                    style={{
                      // Styles moved to parent container
                    }}
                  >
                    <button
                      type="button"
                      className={styles.workspaceCommentDelete}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (clip?.id) {
                          handleRemoveClipping(clip.id);
                        }
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      title="Delete clip"
                      style={{ color: 'inherit', opacity: 0.7 }}
                    >
                      <MdClose size={14} />
                    </button>
                    <div className={styles.workspaceItemHeader} style={{ color: 'inherit' }}>
                      {clip?.segments ? 'Combined Clip' : 'Clip'}
                    </div>
                    <div className={styles.workspaceItemContent} style={{ color: 'inherit' }}>{renderClipContent(clip, item.id)}</div>
                  </div>
                )}

                {itemType === 'comment' && comment && (
                  <div
                    className={styles.workspaceCommentCard}
                    style={{
                      // Styles moved to parent container
                    }}
                  >
                    <button
                      type="button"
                      className={styles.workspaceCommentDelete}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (comment?.id) {
                          handleDeleteWorkspaceComment(comment.id);
                        }
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      title="Delete comment"
                      style={{ color: 'inherit', opacity: 0.7 }}
                    >
                      <MdClose size={14} />
                    </button>
                    <div className={styles.workspaceCommentHeader} style={{ color: 'inherit' }}>
                      <span>Comment</span>
                      <span className={styles.workspaceCommentPageNumber} style={{ opacity: 0.8 }}>
                        Page {comment.pageNumber}
                      </span>
                    </div>
                    {comment.quoteText && (
                      <blockquote className={styles.workspaceCommentQuote} style={{ borderColor: 'currentColor', opacity: 0.9 }}>
                        "{comment.quoteText.substring(0, 160)}
                        {comment.quoteText.length > 160 ? '…' : ''}"
                      </blockquote>
                    )}
                    <p className={styles.workspaceCommentBody} style={{ color: 'inherit' }}>{comment.content}</p>
                  </div>
                )}
              </div>
            );
          })
        }

        <WorkspaceFreehandLayer
          ref={freehandLayerRef}
          activeTool={activeTool}
          activeColor={activeColor}
          activeBrushSize={activeBrushSize}
          activeBrushOpacity={activeBrushOpacity}
          freehandMode={freehandMode}
          isPressureEnabled={isPressureEnabled}
          eraserToolId={eraserToolId}
        />
      </div>
    </div >
  );
};

export default WorkspacePane;

