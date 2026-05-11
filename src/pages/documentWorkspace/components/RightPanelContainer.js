import React from 'react';
import RightPanel from './RightPanel';
import { useRightPanelApi, useClippingsApi, useWorkspaceApi } from '../context/DocumentWorkspaceContext';

const RightPanelContainer = () => {
  const {
    isCollapsed,
    toggleCollapse,
    annotationFilters,
    toggleAnnotationFilter,
    annotationDescriptions,
    filteredAnnotations,
    onAnnotationJump,
    onDeleteAnnotation,
    bookmarks,
    onBookmarkJump,
    onBookmarkRemove,
    pdfOutlines,
    onOutlineJump,
    workspaceComments,
    onCommentJump,
    pageRefs,
    viewerZoomWrapperRef,
  } = useRightPanelApi();

  const {
    items: clippings,
    remove: onRemoveClipping,
    clickItem: onClippingJump,
    resolvePrimaryPage: getPrimaryPageFromSource,
  } = useClippingsApi();

  const {
    items: workspaceItems,
  } = useWorkspaceApi();

  return (
    <RightPanel
      isCollapsed={isCollapsed}
      onToggleCollapse={toggleCollapse}
      annotationFilters={annotationFilters}
      toggleAnnotationFilter={toggleAnnotationFilter}
      annotationDescriptions={annotationDescriptions}
      filteredAnnotations={filteredAnnotations}
      onAnnotationJump={onAnnotationJump}
      onDeleteAnnotation={onDeleteAnnotation}
      bookmarks={bookmarks}
      onBookmarkJump={onBookmarkJump}
      onBookmarkRemove={onBookmarkRemove}
      pdfOutlines={pdfOutlines}
      onOutlineJump={onOutlineJump}
      workspaceComments={workspaceComments}
      onCommentJump={onCommentJump}
      clippings={clippings}
      onClippingJump={onClippingJump}
      onRemoveClipping={onRemoveClipping}
      getPrimaryPageFromSource={getPrimaryPageFromSource}
      workspaceItems={workspaceItems}
      pageRefs={pageRefs}
      viewerZoomWrapperRef={viewerZoomWrapperRef}
    />
  );
};

export default RightPanelContainer;

