import React, { useState } from 'react';
import { MdChevronLeft, MdChevronRight, MdBookmark, MdChatBubble, MdClose, MdArrowRight, MdChat, MdAccessTime, MdFormatQuote, MdContentCut } from 'react-icons/md';
import styles from '../documentWorkspace.module.css';

const OutlineItem = ({ outline, onJump, depth = 0 }) => {
  return (
    <div key={outline.dest || outline.title}>
      <div
        className={styles.annotationCard}
        style={{ paddingLeft: `${12 + depth * 16}px`, cursor: 'pointer' }}
        onClick={() => onJump(outline)}
      >
        <div className={styles.annotationTitle}>
          <MdArrowRight size={14} style={{ marginRight: '4px', opacity: 0.5 }} />
          <span>{outline.title}</span>
        </div>
      </div>
      {outline.items && outline.items.length > 0 && (
        outline.items.map((child) => (
          <OutlineItem
            key={child.dest || child.title}
            outline={child}
            onJump={onJump}
            depth={depth + 1}
          />
        ))
      )}
    </div>
  );
};

const CommentCard = ({ comment, onJump, pageLabel = 'Page', children }) => {
  const timeStr = comment.createdAt
    ? new Date(comment.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    : null;

  return (
    <div
      className={styles.commentNavCard}
      onClick={() => onJump(comment)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onJump(comment)}
    >
      {/* Header row */}
      <div className={styles.commentNavCardHeader}>
        <div className={styles.commentNavCardBadge}>
          <MdChat size={11} />
          <span>{pageLabel}</span>
        </div>
        <div className={styles.commentNavCardPage}>
          Pg {comment.pageNumber}
        </div>
      </div>

      {/* Quote text */}
      {(comment.quoteText || comment.linkedText) && (
        <div className={styles.commentNavCardQuote}>
          <MdFormatQuote size={13} style={{ opacity: 0.5, flexShrink: 0, marginTop: 1 }} />
          <span>{(comment.quoteText || comment.linkedText).substring(0, 120)}
            {(comment.quoteText || comment.linkedText).length > 120 ? '…' : ''}</span>
        </div>
      )}

      {/* Content */}
      {comment.content && (
        <p className={styles.commentNavCardContent}>{comment.content}</p>
      )}

      {/* Footer */}
      {timeStr && (
        <div className={styles.commentNavCardFooter}>
          <MdAccessTime size={11} />
          <span>{timeStr}</span>
        </div>
      )}

      {children}
    </div>
  );
};

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
  pdfOutlines,
  onOutlineJump,
  workspaceComments,
  onCommentJump,
  clippings,
  onClippingJump,
  onRemoveClipping,
  getPrimaryPageFromSource,
  workspaceItems,
  pageRefs,
  viewerZoomWrapperRef,
}) => {
  // Start with no panel selected — panel is initially collapsed per controller
  const [activePanel, setActivePanel] = useState(null);

  const pdfComments = filteredAnnotations.filter(a => a.type === 'comment');

  const handleNavIconClick = (panel) => {
    if (isCollapsed) {
      onToggleCollapse();
    }
    setActivePanel(prev => (prev === panel && !isCollapsed) ? prev : panel);
  };

  const handleBookmarkClick = (pageNumber) => {
    onBookmarkJump(pageNumber);
    // Scroll to the page
    setTimeout(() => {
      if (pageRefs && pageRefs.current) {
        const pageEl = pageRefs.current[pageNumber];
        if (pageEl && viewerZoomWrapperRef && viewerZoomWrapperRef.current) {
          const pageRect = pageEl.getBoundingClientRect();
          const wrapperRect = viewerZoomWrapperRef.current.getBoundingClientRect();
          const scrollTop = viewerZoomWrapperRef.current.scrollTop;
          const targetY = pageRect.top - wrapperRect.top + scrollTop - 100;
          viewerZoomWrapperRef.current.scrollTo({
            top: Math.max(0, targetY),
            behavior: 'smooth',
          });
        }
      }
    }, 100);
  };

  const handleCommentClick = (comment) => {
    if (comment.id && onCommentJump) {
      onCommentJump(comment.id);
    }
    onAnnotationJump(comment);
  };

  const handleOutlineClick = (outline) => {
    onOutlineJump(outline);
  };

  const handleClippingClick = (clip) => {
    // Find the workspace item that corresponds to this clip
    const wsItem = workspaceItems?.find((item) => item.sourceId === clip.id && item.type === 'clip');
    if (wsItem) {
      onClippingJump(wsItem);
    } else {
      // Fallback: try passing a synthetic workspace item
      onClippingJump({ id: `ws-item-clip-${clip.id}`, type: 'clip', sourceId: clip.id });
    }
  };

  return (
    <aside className={`${styles.rightPanel} ${isCollapsed ? styles.rightPanelCollapsed : ''} ${!isCollapsed && activePanel ? styles.rightPanelExpanded : ''}`}>
      {isCollapsed ? (
        <div className={styles.collapsedNav}>
          <button
            type="button"
            className={`${styles.navIconButton} ${activePanel === 'bookmarks' ? styles.navIconButtonActive : ''}`}
            onClick={() => handleNavIconClick('bookmarks')}
            title="Bookmarks"
          >
            <MdBookmark size={22} />
          </button>
          <button
            type="button"
            className={`${styles.navIconButton} ${activePanel === 'comments' ? styles.navIconButtonActive : ''}`}
            onClick={() => handleNavIconClick('comments')}
            title="Comments"
          >
            <MdChatBubble size={22} />
          </button>
          <button
            type="button"
            className={`${styles.navIconButton} ${activePanel === 'clippings' ? styles.navIconButtonActive : ''}`}
            onClick={() => handleNavIconClick('clippings')}
            title="Clips"
          >
            <MdContentCut size={22} />
          </button>
        </div>
      ) : (
        <>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderContent}>
              <h2 className={styles.panelTitle}>
                {activePanel === 'bookmarks' ? 'Bookmarks' : activePanel === 'comments' ? 'Comments' : activePanel === 'clippings' ? 'All Clips' : 'Navigation'}
              </h2>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  type="button"
                  className={`${styles.panelIconButton} ${activePanel === 'bookmarks' ? styles.panelIconButtonActive : ''}`}
                  onClick={() => setActivePanel('bookmarks')}
                  title="Bookmarks"
                >
                  <MdBookmark size={18} />
                </button>
                <button
                  type="button"
                  className={`${styles.panelIconButton} ${activePanel === 'comments' ? styles.panelIconButtonActive : ''}`}
                  onClick={() => setActivePanel('comments')}
                  title="Comments"
                >
                  <MdChatBubble size={18} />
                </button>
                <button
                  type="button"
                  className={`${styles.panelIconButton} ${activePanel === 'clippings' ? styles.panelIconButtonActive : ''}`}
                  onClick={() => setActivePanel('clippings')}
                  title="Clips"
                >
                  <MdContentCut size={18} />
                </button>
                <button type="button" className={styles.panelClose} onClick={onToggleCollapse} title="Close panel">
                  <MdClose size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className={styles.panelContent}>
            {/* ── BOOKMARKS PANEL ── */}
            {activePanel === 'bookmarks' && (
              <>
                {pdfOutlines.length === 0 && bookmarks.length === 0 ? (
                  <div className={styles.emptyState}>
                    No bookmarks available. PDF outlines will appear here when present.
                  </div>
                ) : (
                  <div className={styles.annotationList}>
                    {pdfOutlines.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div className={styles.navSectionLabel}>PDF Outlines</div>
                        {pdfOutlines.map((outline) => (
                          <OutlineItem
                            key={outline.dest || outline.title}
                            outline={outline}
                            onJump={handleOutlineClick}
                          />
                        ))}
                      </div>
                    )}
                    {bookmarks.length > 0 && (
                      <div>
                        <div className={styles.navSectionLabel} style={{ marginTop: pdfOutlines.length > 0 ? '8px' : 0 }}>
                          User Bookmarks
                        </div>
                        {[...bookmarks]
                          .sort((a, b) => a.pageNumber - b.pageNumber || a.createdAt.localeCompare(b.createdAt))
                          .map((bookmark) => (
                            <div
                              key={bookmark.id}
                              className={styles.annotationCard}
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleBookmarkClick(bookmark.pageNumber)}
                            >
                              <div className={styles.annotationTitle}>
                                <span style={{ color: bookmark.color || '#d4af37' }}>
                                  <MdBookmark size={14} style={{ marginRight: 4 }} />
                                  Bookmark
                                </span>
                                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
                                  Page {bookmark.pageNumber}
                                </span>
                              </div>
                              {bookmark.note && (
                                <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                                  {bookmark.note}
                                </p>
                              )}
                              <div className={styles.annotationCardMeta}>
                                <span>
                                  {new Date(bookmark.createdAt).toLocaleDateString()}{' '}
                                  {new Date(bookmark.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <button
                                  type="button"
                                  className={styles.linkButton}
                                  style={{ color: '#ef4444', fontSize: '11px' }}
                                  onClick={(e) => { e.stopPropagation(); onBookmarkRemove(bookmark.id); }}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── COMMENTS PANEL ── */}
            {activePanel === 'comments' && (
              <>
                {pdfComments.length === 0 && workspaceComments.length === 0 ? (
                  <div className={styles.emptyState}>
                    No comments yet. Use the comment tool to add notes.
                  </div>
                ) : (
                  <div className={styles.annotationList}>
                    {workspaceComments.length > 0 && (
                      <div>
                        <div className={styles.navSectionLabel}>Workspace Comments</div>
                        {workspaceComments.map((comment) => (
                          <CommentCard
                            key={comment.id}
                            comment={comment}
                            onJump={handleCommentClick}
                            pageLabel="Workspace"
                          />
                        ))}
                      </div>
                    )}
                    {pdfComments.length > 0 && (
                      <div style={{ marginTop: workspaceComments.length > 0 ? '8px' : 0 }}>
                        <div className={styles.navSectionLabel}>PDF Comments</div>
                        {pdfComments.map((annotation) => (
                          <CommentCard
                            key={annotation.id}
                            comment={{
                              ...annotation,
                              quoteText: annotation.linkedText,
                            }}
                            onJump={handleCommentClick}
                            pageLabel="PDF"
                          >
                            <button
                              type="button"
                              className={styles.commentNavCardDeleteBtn}
                              onClick={(e) => { e.stopPropagation(); onDeleteAnnotation(annotation.id); }}
                            >
                              Delete
                            </button>
                          </CommentCard>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── CLIPS PANEL ── */}
            {activePanel === 'clippings' && (
              <>
                {clippings.length === 0 ? (
                  <div className={styles.emptyState}>
                    No clips yet. Use the "Clip Area" tool or select text and click "Create clipping".
                  </div>
                ) : (
                  <div className={styles.annotationList}>
                    <div className={styles.navSectionLabel}>All Clips ({clippings.length})</div>
                    {clippings.map((clip) => (
                      <div
                        key={clip.id}
                        className={styles.annotationCard}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleClippingClick(clip)}
                      >
                        <div className={styles.annotationTitle}>
                          <span style={{ color: clip.color || '#d4af37' }}>
                            <MdContentCut size={14} style={{ marginRight: 4 }} />
                            Clip
                          </span>
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
                            Page {clip.segments
                              ? Array.from(new Set(clip.segments.map(seg => getPrimaryPageFromSource(seg.sourcePage)))).join(', ')
                              : getPrimaryPageFromSource(clip.sourcePage)}
                          </span>
                        </div>
                        {clip.segments ? (
                          <div style={{ margin: '8px 0' }}>
                            {clip.segments.map(seg => (
                              <p key={seg.id} style={{ margin: '4px 0', fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                                <strong>{seg.label}:</strong> {seg.content.substring(0, 100)}{seg.content.length > 100 ? '…' : ''}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: '8px 0', fontSize: '12px', color: '#475569', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {clip.content?.substring(0, 150)}{clip.content?.length > 150 ? '…' : ''}
                          </p>
                        )}
                        <div className={styles.annotationCardMeta}>
                          <span>
                            {clip.createdAt ? new Date(clip.createdAt).toLocaleDateString() : ''}
                          </span>
                          <button
                            type="button"
                            className={styles.linkButton}
                            style={{ color: '#ef4444', fontSize: '11px' }}
                            onClick={(e) => { e.stopPropagation(); onRemoveClipping(clip.id); }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!activePanel && (
              <div className={styles.emptyState}>
                Select <MdBookmark size={13} style={{ verticalAlign: 'middle' }} />,{' '}
                <MdChatBubble size={13} style={{ verticalAlign: 'middle' }} />, or{' '}
                <MdContentCut size={13} style={{ verticalAlign: 'middle' }} /> above to navigate
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
};

export default RightPanel;
