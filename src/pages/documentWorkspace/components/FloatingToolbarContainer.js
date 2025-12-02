import React from 'react';
import FloatingToolbar from './FloatingToolbar';
import {
  TOOL_TYPES,
  COLOR_OPTIONS,
  BRUSH_SIZES,
  FREEHAND_COLORS,
} from '../constants';
import { useToolbarApi } from '../context/DocumentWorkspaceContext';
import styles from '../documentWorkspace.module.css';

const FloatingToolbarContainer = () => {
  const {
    activeTool,
    selectTool,
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
    isHighlightView,
    setIsHighlightView,
    setHighlightViewCropZoom,
    isTablet,
  } = useToolbarApi();

  const handleToggleHighlightView = () => {
    setIsHighlightView((prev) => {
      const next = !prev;
      if (!next) {
        setHighlightViewCropZoom(1.0);
      }
      return next;
    });
  };

  const toolbarProps = {
    toolTypes: TOOL_TYPES,
    activeTool,
    onToolClick: selectTool,
    colorOptions: COLOR_OPTIONS,
    activeColor: color,
    onColorSelect: setColor,
    brushSizeOptions: BRUSH_SIZES,
    activeBrushSize: brushSize,
    onBrushSizeSelect: setBrushSize,
    activeBrushOpacity: brushOpacity,
    onBrushOpacityChange: setBrushOpacity,
    freehandColorOptions: FREEHAND_COLORS,
    freehandMode,
    onFreehandModeChange: setFreehandMode,
    isPressureEnabled,
    onTogglePressure: setIsPressureEnabled,
    isFreehandPaletteVisible: isPaletteOpen,
    onFreehandPaletteDismiss: dismissPalette,
    isFreehandCommentMode,
    onToggleFreehandCommentMode: () =>
      setIsFreehandCommentMode((prev) => !prev),
    isHighlightView,
    onToggleHighlightView: handleToggleHighlightView,
  };

  return (
    <div className={styles.floatingToolbarContainerBottom}>
      <FloatingToolbar {...toolbarProps} />
    </div>
  );
};

export default FloatingToolbarContainer;

