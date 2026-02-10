import React from 'react';
import WorkspacePane from './WorkspacePane';
import { WORKSPACE_ERASER_TOOL_ID } from '../constants';
import { useWorkspaceApi, useClippingsApi } from '../context/DocumentWorkspaceContext';

const WorkspacePaneContainer = () => {
  const workspace = useWorkspaceApi();
  const {
    items: clippings,
    selectedIds,
    toggleSelection,
  } = useClippingsApi();

  return (
    <WorkspacePane
      workspaceSlide={workspace.slide}
      workspaceWidth={workspace.width}
      workspaceItems={workspace.items}
      workspaceComments={workspace.comments}
      workspaceRef={workspace.ref}
      clippings={clippings}
      selectedClipIds={selectedIds}
      onToggleClipSelection={toggleSelection}
      draggingWorkspaceItemIdRef={workspace.draggingItemIdRef}
      startMoveWorkspaceItem={workspace.startMoveItem}
      handleWorkspacePointerMove={workspace.moveItem}
      endMoveWorkspaceItem={workspace.endMoveItem}
      handleWorkspaceItemClick={workspace.clickItem}
      handleRemoveClipping={workspace.removeClipping}
      handleDeleteWorkspaceComment={workspace.deleteComment}
      onJumpToPage={workspace.onJumpToPage}
      onPulseHighlight={workspace.pulseHighlight}
      activeTool={workspace.activeTool}
      activeColor={workspace.activeColor}
      activeBrushSize={workspace.activeBrushSize}
      activeBrushOpacity={workspace.activeBrushOpacity}
      freehandMode={workspace.freehandMode}
      isPressureEnabled={workspace.isPressureEnabled}
      eraserToolId={WORKSPACE_ERASER_TOOL_ID}
    />
  );
};

export default WorkspacePaneContainer;

