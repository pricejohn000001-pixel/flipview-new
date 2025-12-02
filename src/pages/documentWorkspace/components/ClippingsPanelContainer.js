import React from 'react';
import ClippingsPanel from './ClippingsPanel';
import { useClippingsApi } from '../context/DocumentWorkspaceContext';

const ClippingsPanelContainer = () => {
  const {
    items,
    selectedIds,
    createFromSelection,
    combineSelected,
    toggleSelection,
    startDrag,
    reorder,
    remove,
    uncombine,
    jumpToPage,
    resolvePrimaryPage,
    isCollapsed,
    toggleCollapse,
  } = useClippingsApi();

  return (
    <ClippingsPanel
      clippings={items}
      selectedClippings={selectedIds}
      onCreateClipping={createFromSelection}
      onCombineClippings={combineSelected}
      onToggleClippingSelection={toggleSelection}
      onClippingDragStart={startDrag}
      onReorderClipping={reorder}
      onRemoveClipping={remove}
      onJumpToPage={jumpToPage}
      getPrimaryPageFromSource={resolvePrimaryPage}
      onUncombineClipping={uncombine}
      isCollapsed={isCollapsed}
      onToggleCollapse={toggleCollapse}
    />
  );
};

export default ClippingsPanelContainer;

