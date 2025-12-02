import styles from '../documentWorkspace.module.css';
import OcrOverlay from './OcrOverlay';
import SelectionMenu from './SelectionMenu';
import MainViewerArea from './MainViewerArea';
import RightPanelContainer from './RightPanelContainer';
import AppBarContainer from './AppBarContainer';
import SearchBarContainer from './SearchBarContainer';
import { useToolbarApi } from '../context/DocumentWorkspaceContext';
import MultiClipCombineFab from './MultiClipCombineFab';
import React from 'react';

const DocumentWorkspaceShell = () => {
  const { isTablet, isSearchBarOpen, toggleSearchBar, closeSearchBar } = useToolbarApi();
  
  return (
    <div className={`${styles.workspace} ${isTablet ? styles.workspaceTablet : ''}`}>
      <AppBarContainer isSearchOpen={isSearchBarOpen} onSearchToggle={toggleSearchBar} />
      <SearchBarContainer isVisible={isSearchBarOpen} onClose={closeSearchBar} />
      <OcrOverlay />
      <SelectionMenu />
      <MainViewerArea />
      <RightPanelContainer />
      <MultiClipCombineFab />
    </div>
  );
};

export default DocumentWorkspaceShell;

