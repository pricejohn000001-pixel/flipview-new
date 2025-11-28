import React from 'react';
import styles from '../documentWorkspace.module.css';
import { useDocumentApi } from '../context/DocumentWorkspaceContext';
import FloatingToolbarContainer from './FloatingToolbarContainer';
import ConnectorSvg from './ConnectorSvg';
import DocumentPane from './DocumentPane';
import WorkspaceResizer from './WorkspaceResizer';
import WorkspacePaneContainer from './WorkspacePaneContainer';

const MainViewerArea = () => {
  const { viewerDeckRef } = useDocumentApi();

  return (
    <main className={styles.viewerArea}>
      <FloatingToolbarContainer />
      <div className={styles.viewerDeck} ref={viewerDeckRef}>
        <ConnectorSvg />
        <DocumentPane />
        <WorkspaceResizer />
        <WorkspacePaneContainer />
      </div>
    </main>
  );
};

export default MainViewerArea;

