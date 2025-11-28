import DocumentWorkspaceShell from './components/DocumentWorkspaceShell';
import { DocumentWorkspaceProvider } from './context/DocumentWorkspaceContext';
import React from 'react';

const DocumentWorkspacePage = () => (
  <DocumentWorkspaceProvider>
    <DocumentWorkspaceShell />
  </DocumentWorkspaceProvider>
);

export default DocumentWorkspacePage;

