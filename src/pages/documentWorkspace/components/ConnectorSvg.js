import React from 'react';
import styles from '../documentWorkspace.module.css';
import { useConnectorsApi } from '../context/DocumentWorkspaceContext';
import { getWorkspaceItemType, getWorkspaceItemSourceId } from '../utils';

const ConnectorSvg = () => {
  const {
    items,
    comments,
    clippings,
    computePoints,
    workspacePan,
    workspaceZoom,
    workspaceWidth
  } = useConnectorsApi();

  const isItemVisible = (item) => {
    if (!item) return false;
    // Constants matching WorkspacePane.js
    const CANVAS_SIZE = 6000;
    const CENTER_OFFSET = 3000;

    // Estimate workspace height (viewport height)
    // In a real scenario we might want exact ref height, but window height is a safe upper bound approximation for visibility
    // or we can assume it fills the screen minus header.
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight - 40 : 800;

    // Calculate item's screen position relative to WorkspacePane container top-left
    // Formula derived from WorkspacePane transform origin at 50% 50%
    // center X of pane = workspaceWidth / 2
    // center Y of pane = viewportHeight / 2

    const itemX = item.x * CANVAS_SIZE;
    const itemY = item.y * CANVAS_SIZE;

    const vectorX = (itemX - CENTER_OFFSET) * workspaceZoom + workspacePan.x;
    const vectorY = (itemY - CENTER_OFFSET) * workspaceZoom + workspacePan.y;

    const screenX = vectorX + workspaceWidth / 2;
    const screenY = vectorY + viewportHeight / 2;

    // Check if within bounds with some buffer for the item size itself (e.g. 100px)
    const padding = 50;
    return (
      screenX >= -padding &&
      screenX <= workspaceWidth + padding &&
      screenY >= -padding &&
      screenY <= viewportHeight + padding
    );
  };

  return (
    <svg className={styles.connectorSvg}>
      {items.map((item) => {
        // Optimization: Skip invisible items
        // We only check visibility if we have the workspace state available
        if (workspaceWidth && workspacePan && !isItemVisible(item)) {
          return null;
        }

        const itemType = getWorkspaceItemType(item);
        const sourceId = getWorkspaceItemSourceId(item);
        const source =
          itemType === 'comment'
            ? comments.find((comment) => comment.id === sourceId)
            : clippings.find((clip) => clip.id === sourceId);

        if (!source) return null;

        // Also check if source (clip/comment) is effectively the item itself for visibility purposes?
        // Actually, we just need to know if the *workspace item* is visible.
        // But strictly speaking, the user said "hide connectors if ANY is out of view".
        // The other end of the connector is the *PDF* highlight?
        // Or is it a workspace-to-workspace connector?
        // Currently, connectors are rendered from Workspace Item -> ... ?
        // computePoints likely uses the item and the source (which has PDF coordinates).
        // If the workspace item is out of view, we hide it.
        // If the *PDF* part is out of view, that's trickier to know here without PDF viewer state.
        // Assuming "hide the connectors if any is out of view" refers to the workspace item being out of view.

        const connectors = computePoints(item, source);
        if (!connectors || !connectors.length) return null;

        return connectors.map((points, idx) => {
          const { from, to } = points;
          const midX = (from.x + to.x) / 2;
          const path = `M ${from.x} ${from.y} C ${midX} ${from.y} ${midX} ${to.y} ${to.x} ${to.y}`;
          const stroke =
            itemType === 'comment'
              ? 'rgba(16, 185, 129, 0.6)'
              : 'rgba(99, 102, 241, 0.35)';
          return (
            <g key={`connector-${item.id}-${idx}`}>
              <path
                d={path}
                stroke={stroke}
                strokeWidth={1.8}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Dots at ends */}
              <circle cx={from.x} cy={from.y} r={3} fill={stroke} />
              <circle cx={to.x} cy={to.y} r={3} fill={stroke} />
            </g>
          );
        });
      })}
    </svg>
  );
};

export default ConnectorSvg;

