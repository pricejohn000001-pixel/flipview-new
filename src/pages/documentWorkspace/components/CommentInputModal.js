import React, { useEffect, useRef, useState } from 'react';
import styles from '../documentWorkspace.module.css';

/**
 * Modal component for inputting comments
 * @param {Object} props
 * @param {Object|null} props.data - Modal data containing sourceRect, pageNumber, quoteText, etc.
 * @param {Function} props.onSubmit - Callback when user submits the comment (text) => void
 * @param {Function} props.onCancel - Callback when user cancels
 */
const CommentInputModal = ({ data, onSubmit, onCancel }) => {
    const [commentText, setCommentText] = useState('');
    const textareaRef = useRef(null);

    // Reset and focus when modal opens
    useEffect(() => {
        if (data) {
            setCommentText('');
            // Focus textarea after a short delay to ensure modal is rendered
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
        }
    }, [data]);

    // Don't render if no data
    if (!data) return null;

    const handleSubmit = () => {
        const trimmed = commentText.trim();
        if (!trimmed) {
            // Don't submit empty comments
            return;
        }
        onSubmit(trimmed);
        setCommentText('');
    };

    const handleCancel = () => {
        setCommentText('');
        onCancel();
    };

    const handleKeyDown = (e) => {
        // Submit on Ctrl+Enter or Cmd+Enter
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
        }
        // Cancel on Escape
        if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };

    const { quoteText } = data;

    return (
        <div className={styles.commentModalOverlay} onClick={handleCancel}>
            <div
                className={styles.commentModalContent}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.commentModalHeader}>
                    <h3>Add Comment</h3>
                </div>

                <div className={styles.commentModalBody}>
                    {quoteText && (
                        <div className={styles.commentQuotePreview}>
                            <div className={styles.commentQuoteLabel}>Selected text:</div>
                            <div className={styles.commentQuoteText}>
                                "{quoteText.substring(0, 150)}{quoteText.length > 150 ? '...' : ''}"
                            </div>
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        className={styles.commentTextarea}
                        placeholder="Enter your comment here..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={5}
                    />

                    <div className={styles.commentModalHint}>
                        Press <kbd>Ctrl+Enter</kbd> to save, <kbd>Esc</kbd> to cancel
                    </div>
                </div>

                <div className={styles.commentModalFooter}>
                    <button
                        className={styles.commentModalButtonCancel}
                        onClick={handleCancel}
                    >
                        Cancel
                    </button>
                    <button
                        className={styles.commentModalButtonSubmit}
                        onClick={handleSubmit}
                        disabled={!commentText.trim()}
                    >
                        Save Comment
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CommentInputModal;
