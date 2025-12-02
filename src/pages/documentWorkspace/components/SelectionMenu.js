import React from 'react';
import styles from '../documentWorkspace.module.css';
import { useSelectionApi } from '../context/DocumentWorkspaceContext';

const SelectionMenu = () => {
  const { menu, createCommentFromSelection, createClipFromSelection } = useSelectionApi();

  if (!menu) return null;

  return (
    <div
      className={styles.selectionCommentMenu}
      style={{ left: menu.x, top: menu.y }}
    >
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={createCommentFromSelection}
        title="Add comment"
      >
        Comment
      </button>
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={createClipFromSelection}
        title="Create clipping"
      >
        Clip
      </button>
    </div>
  );
};

export default SelectionMenu;

