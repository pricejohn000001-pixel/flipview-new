import React, { useRef } from 'react';
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
}) => {
  const draggingWorkspaceItemId = draggingWorkspaceItemIdRef?.current;
  const pointerMetaRef = useRef({});

  const renderClipContent = (clip) => {
    if (clip?.segments) {
      return clip.segments.map((seg) => (
        <div
          key={seg.id}
          className={styles.workspaceSegment}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
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
      className={styles.workspacePane}
      style={{
        width: `${workspaceWidth}px`,
        right: `${-workspaceSlide}px`,
      }}
    >
      <div
        ref={workspaceRef}
        className={styles.workspaceCanvas}
        onPointerMove={handleWorkspacePointerMove}
        onPointerUp={endMoveWorkspaceItem}
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
            return (
              <div
                key={item.id}
                 className={`${styles.workspaceItem} ${isDragging ? styles.dragging : ''} ${
                   isClipSelected ? styles.workspaceItemSelected : ''
                 }`}
                 data-workspace-clip={itemType === 'clip' && clip ? clip.id : undefined}
                style={{
                  left: `${item.x * 100}%`,
                  top: `${item.y * 100}%`,
                  transform: isDragging ? 'translateZ(10px) scale(1.02)' : 'none',
                  zIndex: isDragging ? 1000 : 1,
                  boxShadow: isDragging
                    ? '0 20px 40px rgba(0,0,0,0.2)'
                    : '0 4px 12px rgba(0,0,0,0.1)',
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
                  <div className={styles.workspaceClipCard}>
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
                    >
                      <MdClose size={14} />
                    </button>
                    <div className={styles.workspaceItemHeader}>
                      {clip?.segments ? 'Combined Clip' : 'Clip'}
                    </div>
                    <div className={styles.workspaceItemContent}>{renderClipContent(clip)}</div>
                  </div>
                )}

                {itemType === 'comment' && comment && (
                  <div className={styles.workspaceCommentCard}>
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
                    >
                      <MdClose size={14} />
                    </button>
                    <div className={styles.workspaceCommentHeader}>
                      <span>Comment</span>
                      <span className={styles.workspaceCommentPageNumber}>
                        Page {comment.pageNumber}
                      </span>
                    </div>
                    {comment.quoteText && (
                      <blockquote className={styles.workspaceCommentQuote}>
                        "{comment.quoteText.substring(0, 160)}
                        {comment.quoteText.length > 160 ? '…' : ''}"
                      </blockquote>
                    )}
                    <p className={styles.workspaceCommentBody}>{comment.content}</p>
                  </div>
                )}
              </div>
            );
          })
        }

        <WorkspaceFreehandLayer
          activeTool={activeTool}
          activeColor={activeColor}
          activeBrushSize={activeBrushSize}
          activeBrushOpacity={activeBrushOpacity}
          freehandMode={freehandMode}
          isPressureEnabled={isPressureEnabled}
          eraserToolId={eraserToolId}
        />
      </div>
    </div>
  );
};

export default WorkspacePane;

