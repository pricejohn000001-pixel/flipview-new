import React, { useEffect, useRef } from 'react';
import { MdKeyboardArrowUp, MdKeyboardArrowDown, MdClose, MdSearch } from 'react-icons/md';
import styles from '../documentWorkspace.module.css';

const SearchBar = ({
  isVisible,
  searchTerm,
  onSearchTermChange,
  isSearching = false,
  totalResults = 0,
  activeResultNumber = 0,
  onNextResult,
  onPreviousResult,
  onClose,
}) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className={styles.searchBar}>
      <div className={styles.searchBarContent}>
        <div className={styles.searchBarInputWrapper}>
          <MdSearch className={styles.searchBarIcon} size={20} />
          <input
            ref={inputRef}
            className={styles.searchBarInput}
            type="search"
            placeholder="Search text…"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.shiftKey) {
                  onPreviousResult?.();
                } else {
                  onNextResult?.();
                }
              } else if (e.key === 'Escape') {
                onClose?.();
              }
            }}
          />
          {searchTerm && (
            <button
              type="button"
              className={styles.searchBarClearButton}
              onClick={() => onSearchTermChange('')}
              title="Clear search"
            >
              <MdClose size={18} />
            </button>
          )}
        </div>
        
        <div className={styles.searchBarControls}>
          <div className={styles.searchBarStatus}>
            {isSearching
              ? 'Searching…'
              : totalResults > 0
                ? `${activeResultNumber} of ${totalResults}`
                : 'No results'}
          </div>
          
          <div className={styles.searchBarDivider} />
          
          <div className={styles.searchBarNav}>
            <button
              type="button"
              className={styles.searchBarButton}
              onClick={onPreviousResult}
              disabled={!totalResults}
              title="Previous match (Shift+Enter)"
            >
              <MdKeyboardArrowUp size={24} />
            </button>
            <button
              type="button"
              className={styles.searchBarButton}
              onClick={onNextResult}
              disabled={!totalResults}
              title="Next match (Enter)"
            >
              <MdKeyboardArrowDown size={24} />
            </button>
          </div>
          
          <div className={styles.searchBarDivider} />
          
          <button
            type="button"
            className={styles.searchBarCloseButton}
            onClick={onClose}
            title="Close search (Esc)"
          >
            <MdClose size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;

