import React from 'react';
import { MdZoomIn, MdZoomOut, MdSearch, MdClose } from 'react-icons/md';
import styles from '../documentWorkspace.module.css';

const AppBar = ({
  primaryScale,
  onManualZoom,
  onSearchClick,
  isSearchOpen,
}) => {
  return (
    <div className={styles.appBar}>
      <div className={styles.appBarContent}>
        <div className={styles.appBarLeft}>
          <div className={styles.zoomControls}>
            <button
              type="button"
              className={styles.appBarButton}
              onClick={() => onManualZoom('out')}
              title="Zoom out"
            >
              <MdZoomOut size={18} />
            </button>
            <span className={styles.zoomValue}>{Math.round(primaryScale * 100)}%</span>
            <button
              type="button"
              className={styles.appBarButton}
              onClick={() => onManualZoom('in')}
              title="Zoom in"
            >
              <MdZoomIn size={18} />
            </button>
          </div>
        </div>
        <div className={styles.appBarRight}>
          <button
            type="button"
            className={`${styles.appBarButton} ${isSearchOpen ? styles.appBarButtonActive : ''}`}
            onClick={onSearchClick}
            title="Search"
          >
            {isSearchOpen ? <MdClose size={18} /> : <MdSearch size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppBar;

