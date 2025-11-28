import React from 'react';
import RightPanel from './RightPanel';
import { ANNOTATION_TYPES } from '../constants';
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
  } = useRightPanelApi();

  return (
    <RightPanel
      isCollapsed={isCollapsed}
      onToggleCollapse={toggleCollapse}
      annotationTypes={ANNOTATION_TYPES}
      annotationFilters={annotationFilters}
      toggleAnnotationFilter={toggleAnnotationFilter}
      annotationDescriptions={annotationDescriptions}
      filteredAnnotations={filteredAnnotations}
      onAnnotationJump={onAnnotationJump}
      onDeleteAnnotation={onDeleteAnnotation}
      bookmarks={bookmarks}
      onBookmarkJump={onBookmarkJump}
      onBookmarkRemove={onBookmarkRemove}
    />
  );
};

export default RightPanelContainer;

