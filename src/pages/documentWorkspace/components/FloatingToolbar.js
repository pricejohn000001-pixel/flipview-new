import React, { useEffect, useRef } from 'react';
import {
  MdCrop,
  MdZoomIn,
  MdZoomOut,
  MdSearch,
  MdClose,
} from 'react-icons/md';
import styles from '../documentWorkspace.module.css';
import FreehandPalette from './FreehandPalette';

const FloatingToolbar = ({
  toolTypes,
  activeTool,
  onToolClick,
  colorOptions,
  activeColor,
  onColorSelect,
  brushSizeOptions = [],
  activeBrushSize,
  onBrushSizeSelect,
  freehandColorOptions = colorOptions,
  freehandMode = 'freehand',
  onFreehandModeChange,
  isPressureEnabled = true,
  onTogglePressure,
  isFreehandPaletteVisible = false,
  onFreehandPaletteDismiss,
  activeBrushOpacity = 1,
  onBrushOpacityChange,
  isFreehandCommentMode = false,
  onToggleFreehandCommentMode,
  isHighlightView = false,
  onToggleHighlightView,
  primaryScale,
  onManualZoom,
  onSearchClick,
  isSearchOpen,
}) => {
  const paletteRef = useRef(null);
  const freehandButtonRef = useRef(null);

  useEffect(() => {
    if (!isFreehandPaletteVisible) return;
    const handlePointerDown = (event) => {
      if (paletteRef.current?.contains(event.target)) return;
      if (freehandButtonRef.current?.contains(event.target)) return;
      onFreehandPaletteDismiss?.();
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isFreehandPaletteVisible, onFreehandPaletteDismiss]);

  return (
    <div className={styles.floatingToolbarContainerBottom}>
      <div className={styles.floatingToolbarStack}>
        {isFreehandPaletteVisible && (
          <FreehandPalette
            ref={paletteRef}
            freehandMode={freehandMode}
            onFreehandModeChange={onFreehandModeChange}
            freehandColorOptions={freehandColorOptions}
            activeColor={activeColor}
            onColorSelect={onColorSelect}
            brushSizeOptions={brushSizeOptions}
            activeBrushSize={activeBrushSize}
            onBrushSizeSelect={onBrushSizeSelect}
            activeBrushOpacity={activeBrushOpacity}
            onBrushOpacityChange={onBrushOpacityChange}
            isPressureEnabled={isPressureEnabled}
            onTogglePressure={onTogglePressure}
            isFreehandCommentMode={isFreehandCommentMode}
            onToggleFreehandCommentMode={onToggleFreehandCommentMode}
          />
        )}
        <div className={styles.floatingToolbar}>
          <div className={styles.toolbarIconGroup}>
            <button
              type="button"
              className={styles.toolIconButton}
              onClick={() => onManualZoom('out')}
              title="Zoom out"
            >
              <MdZoomOut size={18} />
            </button>
            <span className={styles.zoomValue}>{Math.round(primaryScale * 100)}%</span>
            <button
              type="button"
              className={styles.toolIconButton}
              onClick={() => onManualZoom('in')}
              title="Zoom in"
            >
              <MdZoomIn size={18} />
            </button>
          </div>

          <div className={styles.toolbarDivider} />

          <div className={styles.toolbarIconGroup}>
            {toolTypes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`${styles.toolIconButton} ${activeTool === id ? styles.toolIconButtonActive : ''}`}
                onClick={() => onToolClick(id)}
                title={label}
                ref={id === 'freehand' ? freehandButtonRef : undefined}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>

          <div className={styles.toolbarDivider} />

          <div className={styles.toolbarIconGroup}>
            <div className={styles.toolbarSubGroup}>
              <div className={styles.colorSwatches}>
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`${styles.colorDot} ${activeColor === color ? styles.colorDotActive : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => onColorSelect(color)}
                  />
                ))}
              </div>
            </div>
            <div className={styles.toolbarSubGroup}>
              <button 
                type="button" 
                className={`${styles.toolIconButton} ${isHighlightView ? styles.toolIconButtonActive : ''}`} 
                onClick={onToggleHighlightView} 
                title="Highlight View (crop to highlights)"
              >
                <MdCrop size={18} />
              </button>
              <button
                type="button"
                className={`${styles.toolIconButton} ${isSearchOpen ? styles.toolIconButtonActive : ''}`}
                onClick={onSearchClick}
                title="Search"
              >
                {isSearchOpen ? <MdClose size={18} /> : <MdSearch size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingToolbar;

