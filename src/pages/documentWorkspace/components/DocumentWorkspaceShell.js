import styles from '../documentWorkspace.module.css';
import OcrOverlay from './OcrOverlay';
import SelectionMenu from './SelectionMenu';
import MainViewerArea from './MainViewerArea';
import RightPanelContainer from './RightPanelContainer';
import AppBarContainer from './AppBarContainer';
import SearchBarContainer from './SearchBarContainer';
import { useToolbarApi, useCommentModalApi } from '../context/DocumentWorkspaceContext';
import MultiClipCombineFab from './MultiClipCombineFab';
import CommentInputModal from './CommentInputModal';
import React from 'react';

const DocumentWorkspaceShell = () => {
  const { isTablet, isSearchBarOpen, toggleSearchBar, closeSearchBar } = useToolbarApi();
  const commentModal = useCommentModalApi();

  return (
    <div className={`${styles.workspace} ${isTablet ? styles.workspaceTablet : ''}`}>
      <AppBarContainer isSearchOpen={isSearchBarOpen} onSearchToggle={toggleSearchBar} />
      <SearchBarContainer isVisible={isSearchBarOpen} onClose={closeSearchBar} />
      <OcrOverlay />
      <SelectionMenu />
      <MainViewerArea />
      <RightPanelContainer />
      <MultiClipCombineFab />
      <CommentInputModal
        data={commentModal.data}
        onSubmit={commentModal.onSubmit}
        onCancel={commentModal.onCancel}
      />
    </div>
  );
};

export default DocumentWorkspaceShell;

