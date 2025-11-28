import React from 'react';
import styles from '../documentWorkspace.module.css';
import { WORKSPACE_FIXED_WIDTH_PX, WORKSPACE_RESIZER_WIDTH } from '../constants';
import { useWorkspaceApi } from '../context/DocumentWorkspaceContext';

const WorkspaceResizer = () => {
  const {
    visibleWidth,
    isResizing,
    resizeStart,
    resizeKeyDown,
  } = useWorkspaceApi();

  return (
    <div
      className={`${styles.workspaceResizer} ${isResizing ? styles.workspaceResizerActive : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={WORKSPACE_FIXED_WIDTH_PX}
      aria-valuenow={Math.round(visibleWidth)}
      tabIndex={0}
      onPointerDown={resizeStart}
      onKeyDown={resizeKeyDown}
      style={{ right: `${visibleWidth}px`, width: `${WORKSPACE_RESIZER_WIDTH}px` }}
    >
      <span className={styles.workspaceResizerHandle} />
    </div>
  );
};

export default WorkspaceResizer;

