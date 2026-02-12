import React, { createContext, useContext } from 'react';
import useDocumentWorkspaceController from '../hooks/useDocumentWorkspaceController';

const DocumentWorkspaceContext = createContext(null);

export const DocumentWorkspaceProvider = ({ children }) => {
  const controller = useDocumentWorkspaceController();
  return (
    <DocumentWorkspaceContext.Provider value={controller}>
      {children}
    </DocumentWorkspaceContext.Provider>
  );
};

const useDocumentWorkspaceContext = () => {
  const ctx = useContext(DocumentWorkspaceContext);
  if (!ctx) {
    throw new Error('DocumentWorkspaceContext must be used within DocumentWorkspaceProvider');
  }
  return ctx;
};

export const useOcrApi = () => useDocumentWorkspaceContext().ocr;
export const useSelectionApi = () => useDocumentWorkspaceContext().selection;
export const useToolbarApi = () => useDocumentWorkspaceContext().toolbar;
export const useClippingsApi = () => useDocumentWorkspaceContext().clippings;
export const useSearchApi = () => useDocumentWorkspaceContext().search;
export const useRightPanelApi = () => useDocumentWorkspaceContext().rightPanel;
export const useWorkspaceApi = () => useDocumentWorkspaceContext().workspace;
export const useDocumentApi = () => useDocumentWorkspaceContext().document;
export const useConnectorsApi = () => useDocumentWorkspaceContext().connectors;
export const useCommentModalApi = () => useDocumentWorkspaceContext().commentModal;

export default DocumentWorkspaceContext;

