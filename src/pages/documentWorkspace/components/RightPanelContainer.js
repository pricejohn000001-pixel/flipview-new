import React from 'react';
import RightPanel from './RightPanel';
import { useRightPanelApi } from '../context/DocumentWorkspaceContext';

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
    pageRefs,
    viewerZoomWrapperRef,
  } = useRightPanelApi();

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
      pageRefs={pageRefs}
      viewerZoomWrapperRef={viewerZoomWrapperRef}
    />
  );
};

export default RightPanelContainer;

