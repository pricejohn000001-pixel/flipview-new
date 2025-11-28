import React from 'react';
import FloatingToolbar from './FloatingToolbar';
import {
  TOOL_TYPES,
  COLOR_OPTIONS,
  BRUSH_SIZES,
  FREEHAND_COLORS,
} from '../constants';
import { useToolbarApi, useSearchApi } from '../context/DocumentWorkspaceContext';

const FloatingToolbarContainer = () => {
  const {
    activeTool,
    selectTool,
    manualZoom,
    primaryScale,
    color,
    setColor,
    brushSize,
    setBrushSize,
    brushOpacity,
    setBrushOpacity,
    freehandMode,
    setFreehandMode,
    isPressureEnabled,
    setIsPressureEnabled,
    isPaletteOpen,
    dismissPalette,
    isFreehandCommentMode,
    setIsFreehandCommentMode,
    searchTerm,
    setSearchTerm,
    isHighlightView,
    setIsHighlightView,
    setHighlightViewCropZoom,
  } = useToolbarApi();

  const {
    isSearching,
    results,
    activeIndex,
    goToNextResult,
    goToPreviousResult,
  } = useSearchApi();

  const handleToggleHighlightView = () => {
    setIsHighlightView((prev) => {
      const next = !prev;
      if (!next) {
        setHighlightViewCropZoom(1.0);
      }
      return next;
    });
  };

  const totalResults = results?.length || 0;
  const activeResultNumber = totalResults && activeIndex >= 0 ? activeIndex + 1 : 0;

  return (
    <FloatingToolbar
      toolTypes={TOOL_TYPES}
      activeTool={activeTool}
      onToolClick={selectTool}
      onManualZoom={manualZoom}
      primaryScale={primaryScale}
      colorOptions={COLOR_OPTIONS}
      activeColor={color}
      onColorSelect={setColor}
      brushSizeOptions={BRUSH_SIZES}
      activeBrushSize={brushSize}
      onBrushSizeSelect={setBrushSize}
      activeBrushOpacity={brushOpacity}
      onBrushOpacityChange={setBrushOpacity}
      freehandColorOptions={FREEHAND_COLORS}
      freehandMode={freehandMode}
      onFreehandModeChange={setFreehandMode}
      isPressureEnabled={isPressureEnabled}
      onTogglePressure={setIsPressureEnabled}
      isFreehandPaletteVisible={isPaletteOpen}
      onFreehandPaletteDismiss={dismissPalette}
      isFreehandCommentMode={isFreehandCommentMode}
      onToggleFreehandCommentMode={() =>
        setIsFreehandCommentMode((prev) => !prev)
      }
      searchTerm={searchTerm}
      onSearchTermChange={setSearchTerm}
      isSearching={isSearching}
      totalResults={totalResults}
      activeResultNumber={activeResultNumber}
      onNextResult={goToNextResult}
      onPreviousResult={goToPreviousResult}
      isHighlightView={isHighlightView}
      onToggleHighlightView={handleToggleHighlightView}
    />
  );
};

export default FloatingToolbarContainer;

