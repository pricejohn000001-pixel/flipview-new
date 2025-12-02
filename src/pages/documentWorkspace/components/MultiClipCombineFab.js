import React, { useCallback, useEffect, useState } from 'react';
import styles from '../documentWorkspace.module.css';
import { useClippingsApi } from '../context/DocumentWorkspaceContext';

const MultiClipCombineFab = () => {
  const {
    items = [],
    selectedIds = [],
    combineSelected,
    uncombine,
  } = useClippingsApi();
  const [position, setPosition] = useState(null);
  const [action, setAction] = useState(null); // { type: 'combine' | 'uncombine', clipId, count }

  const resolveTargetRect = useCallback((clipId) => {
    if (!clipId) return null;
    const target =
      document.querySelector(`[data-workspace-clip="${clipId}"]`) ||
      document.querySelector(`[data-clipping-card="${clipId}"]`);
    if (!target) return null;
    return target.getBoundingClientRect();
  }, []);

  const updateState = useCallback(() => {
    if (!selectedIds.length) {
      setPosition(null);
      setAction(null);
      return;
    }

    let nextAction = null;
    let anchorClipId = null;

    if (selectedIds.length >= 2) {
      anchorClipId = selectedIds[selectedIds.length - 1];
      nextAction = { type: 'combine', clipId: anchorClipId, count: selectedIds.length };
    } else {
      const clip = items.find((c) => c.id === selectedIds[0]);
      if (clip?.type === 'combined') {
        anchorClipId = clip.id;
        nextAction = { type: 'uncombine', clipId: anchorClipId, count: 1 };
      }
    }

    if (!nextAction || !anchorClipId) {
      setPosition(null);
      setAction(null);
      return;
    }

    const rect = resolveTargetRect(anchorClipId);
    if (!rect) {
      setPosition(null);
      setAction(null);
      return;
    }

    setAction(nextAction);
    setPosition({
      left: rect.right + 12,
      top: rect.top + rect.height / 2,
    });
  }, [items, selectedIds, resolveTargetRect]);

  useEffect(() => {
    updateState();
  }, [updateState]);

  useEffect(() => {
    if (!action) return undefined;
    const handle = () => updateState();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [action, updateState]);

  if (!action || !position) return null;

  const label =
    action.type === 'combine'
      ? `Combine ${action.count} clips`
      : 'Uncombine clip';

  const handleClick = () => {
    if (action.type === 'combine') {
      combineSelected?.();
    } else if (action.type === 'uncombine') {
      uncombine?.(action.clipId);
    }
  };

  return (
    <div
      className={styles.workspaceCombineHover}
      style={{ left: position.left, top: position.top }}
    >
      <button type="button" onClick={handleClick}>
        {label}
      </button>
    </div>
  );
};

export default MultiClipCombineFab;

