import React from 'react';
import { MdBookmarkAdd, MdChevronLeft, MdChevronRight } from 'react-icons/md';
import styles from '../documentWorkspace.module.css';

const RightPanel = ({
  isCollapsed,
  onToggleCollapse,
  annotationTypes,
  annotationFilters,
  toggleAnnotationFilter,
  annotationDescriptions,
  filteredAnnotations,
  onAnnotationJump,
  onDeleteAnnotation,
  bookmarks,
  onBookmarkJump,
  onBookmarkRemove,
}) => (
  <aside className={`${styles.rightPanel} ${isCollapsed ? styles.rightPanelCollapsed : ''}`}>
    <button type="button" className={styles.panelToggle} onClick={onToggleCollapse}>
      {isCollapsed ? <MdChevronLeft size={18} /> : <MdChevronRight size={18} />}
      <span>{isCollapsed ? 'Open notes' : 'Collapse notes'}</span>
    </button>

    {!isCollapsed && (
      <>
        <div className={styles.panelHeader}>Annotations</div>
        <div className={styles.panelContent}>
          <div className={styles.annotationFilters}>
            {annotationTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={`${styles.filterChip} ${annotationFilters[type] ? styles.filterChipActive : ''}`}
                onClick={() => toggleAnnotationFilter(type)}
              >
                <input type="checkbox" readOnly checked={annotationFilters[type]} />{' '}
                {annotationDescriptions[type]}
              </button>
            ))}
          </div>

          {filteredAnnotations.length === 0 ? (
            <div className={styles.emptyState}>Use tools to annotate.</div>
          ) : (
            <div className={styles.annotationList}>
              {filteredAnnotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className={styles.annotationCard}
                  onClick={() => onAnnotationJump(annotation)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.annotationTitle}>
                    <span>
                      {annotationDescriptions[annotation.type]}
                      {annotation.lines &&
                        ` (${annotation.lines.length} line${annotation.lines.length > 1 ? 's' : ''})`}
                    </span>
                    <span>Page {annotation.pageNumber}</span>
                  </div>
                  {annotation.type === 'comment' && (
                    <p>
                      <strong>Note:</strong> {annotation.content}
                    </p>
                  )}
                  {annotation.subtype === 'text' && annotation.text && (
                    <p>
                      <strong>Text:</strong> {annotation.text.substring(0, 80)}
                      {annotation.text.length > 80 ? '...' : ''}
                    </p>
                  )}
                  {annotation.linkedText && (
                    <p>
                      <strong>Linked:</strong> {annotation.linkedText}
                    </p>
                  )}
                  <small>{new Date(annotation.createdAt).toLocaleString()}</small>
                  <div
                    className={styles.clippingActions}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => onAnnotationJump(annotation)}
                    >
                      Jump
                    </button>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => onDeleteAnnotation(annotation.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panelHeader}>Bookmarks ({bookmarks.length})</div>
        <div className={styles.panelContent}>
          {bookmarks.length === 0 ? (
            <div className={styles.emptyState}>
              Click the <MdBookmarkAdd size={14} /> Bookmark tool and tap anywhere on the page
            </div>
          ) : (
            <div className={styles.annotationList}>
              {[...bookmarks]
                .sort(
                  (a, b) =>
                    a.pageNumber - b.pageNumber || a.createdAt.localeCompare(b.createdAt),
                )
                .map((bookmark) => (
                  <div key={bookmark.id} className={styles.annotationCard}>
                    <div className={styles.annotationTitle}>
                      <span style={{ color: bookmark.color }}>Bookmark</span>
                      <span>Page {bookmark.pageNumber}</span>
                    </div>
                    {bookmark.note && (
                      <p>
                        <strong>Note:</strong> {bookmark.note}
                      </p>
                    )}
                    <small>
                      {new Date(bookmark.createdAt).toLocaleDateString()}{' '}
                      {new Date(bookmark.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </small>
                    <div className={styles.clippingActions}>
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => onBookmarkJump(bookmark.pageNumber)}
                      >
                        Jump
                      </button>
                      <button
                        type="button"
                        className={styles.linkButton}
                        style={{ color: '#ef4444' }}
                        onClick={() => onBookmarkRemove(bookmark.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </>
    )}
  </aside>
);

export default RightPanel;

