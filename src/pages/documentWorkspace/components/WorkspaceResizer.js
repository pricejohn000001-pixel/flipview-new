import React from 'react';
import styles from '../documentWorkspace.module.css';
import { WORKSPACE_RESIZER_WIDTH } from '../constants';
import { useWorkspaceApi } from '../context/DocumentWorkspaceContext';

const WorkspaceResizer = () => {
  const {
    visibleWidth,
    isResizing,
    resizeStart,
    resizeKeyDown,
    width: workspaceWidth,
  } = useWorkspaceApi();

  return (
    <div
      className={`${styles.workspaceResizer} ${isResizing ? styles.workspaceResizerActive : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={Math.round(workspaceWidth || 0)}
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

