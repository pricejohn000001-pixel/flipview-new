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
    isTablet,
    primaryScale,
    manualZoom,
  } = useToolbarApi();
  const { isSearchBarOpen, toggleSearchBar } = useToolbarApi();

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
    primaryScale,
    onManualZoom: manualZoom,
    onSearchClick: toggleSearchBar,
    isSearchOpen: isSearchBarOpen,
  };

  return (
    <div className={styles.floatingToolbarContainerBottom}>
      <FloatingToolbar {...toolbarProps} />
    </div>
  );
};

export default FloatingToolbarContainer;

