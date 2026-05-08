import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import DocumentWorkspacePage from './pages/documentWorkspace/DocumentWorkspacePage';
import { PdfProvider, usePdf } from './utils/helpers/pdfContext';

const WorkspaceInitializer = ({ config }) => {
  const { setPdfData } = usePdf();

  useEffect(() => {
    if (config.pdfUrl && config.pdfId) {
      setPdfData(config.pdfUrl, config.pdfId);
    }
  }, [config, setPdfData]);

  return <DocumentWorkspacePage />;
};

/**
 * Initializes the Document Workspace module inside a specific DOM element.
 * 
 * @param {string} elementId - The ID of the HTML element to mount React into.
 * @param {Object} config - Configuration object passed from Laravel.
 * @param {string} config.pdfUrl - The URL of the PDF to load.
 * @param {string|number} config.pdfId - The unique ID of the PDF document.
 * @param {string} config.apiBaseUrl - Optional: The base URL for API calls (default: /api).
 */
window.initDocumentWorkspace = (elementId, config = {}) => {
  const container = document.getElementById(elementId);
  if (!container) {
    console.error(`Element with ID "${elementId}" not found.`);
    return;
  }

  // Set global config for the API utility to pick up
  window.WORKSPACE_CONFIG = {
    apiBaseUrl: config.apiBaseUrl || '/api',
    ...config
  };

  const root = createRoot(container);
  root.render(
    <PdfProvider>
      <WorkspaceInitializer config={config} />
    </PdfProvider>
  );
};
