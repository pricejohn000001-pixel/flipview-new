import React, { useRef } from 'react';
import styles from '../documentWorkspace.module.css';
import { WORKSPACE_RESIZER_WIDTH, WORKSPACE_SLIDE_MIN, WORKSPACE_SLIDE_MAX } from '../constants';
import { useWorkspaceApi } from '../context/DocumentWorkspaceContext';

const WorkspaceResizer = () => {
  const {
    visibleWidth,
    isResizing,
    resizeStart,
    resizeKeyDown,
    width: workspaceWidth,
    slide,
    setSlide,
  } = useWorkspaceApi();
  
  const lastClickTimeRef = useRef(0);

  return (
    <div
      className={`${styles.workspaceResizer} ${isResizing ? styles.workspaceResizerActive : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={Math.round(workspaceWidth || 0)}
      aria-valuenow={Math.round(visibleWidth)}
      tabIndex={0}
      onPointerDown={(e) => {
        const now = Date.now();
        if (now - lastClickTimeRef.current < 300 && !isResizing) {
          if (slide > WORKSPACE_SLIDE_MIN + 50) {
            setSlide(WORKSPACE_SLIDE_MIN);
          } else {
            setSlide(WORKSPACE_SLIDE_MAX);
          }
          lastClickTimeRef.current = 0;
        } else {
          lastClickTimeRef.current = now;
          resizeStart(e);
        }
      }}
      onKeyDown={resizeKeyDown}
      style={{ right: `${visibleWidth}px`, width: `${WORKSPACE_RESIZER_WIDTH}px` }}
    >
      <span className={styles.workspaceResizerHandle} />
    </div>
  );
};

export default WorkspaceResizer;

