import styles from '../documentWorkspace.module.css';
import OcrOverlay from './OcrOverlay';
import SelectionMenu from './SelectionMenu';
import ClippingsPanelContainer from './ClippingsPanelContainer';
import MainViewerArea from './MainViewerArea';
import RightPanelContainer from './RightPanelContainer';
import React from 'react';

const DocumentWorkspaceShell = () => (
  <div className={styles.workspace}>
    <OcrOverlay />
    <SelectionMenu />
    <ClippingsPanelContainer />
    <MainViewerArea />
    <RightPanelContainer />
  </div>
);

export default DocumentWorkspaceShell;

