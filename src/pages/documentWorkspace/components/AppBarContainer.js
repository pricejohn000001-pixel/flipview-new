import React from 'react';
import AppBar from './AppBar';
import { useToolbarApi } from '../context/DocumentWorkspaceContext';

const AppBarContainer = ({ isSearchOpen, onSearchToggle }) => {
  const {
    primaryScale,
    manualZoom,
  } = useToolbarApi();

  return (
    <AppBar
      primaryScale={primaryScale}
      onManualZoom={manualZoom}
      onSearchClick={onSearchToggle}
      isSearchOpen={isSearchOpen}
    />
  );
};

export default AppBarContainer;

