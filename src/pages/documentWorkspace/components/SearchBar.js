import React, { useEffect, useRef } from 'react';
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
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
        <div className={styles.searchBarStatus}>
          {isSearching
            ? 'Searching…'
            : totalResults > 0
              ? `${activeResultNumber}/${totalResults}`
              : '0/0'}
        </div>
        <div className={styles.searchBarNav}>
          <button
            type="button"
            className={styles.searchBarButton}
            onClick={onPreviousResult}
            disabled={!totalResults}
            title="Previous match (Shift+Enter)"
          >
            <MdKeyboardArrowUp size={18} />
          </button>
          <button
            type="button"
            className={styles.searchBarButton}
            onClick={onNextResult}
            disabled={!totalResults}
            title="Next match (Enter)"
          >
            <MdKeyboardArrowDown size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;

