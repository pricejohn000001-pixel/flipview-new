import React from 'react';
import styles from '../documentWorkspace.module.css';
import { useConnectorsApi } from '../context/DocumentWorkspaceContext';
import { getWorkspaceItemType, getWorkspaceItemSourceId } from '../utils';

const ConnectorSvg = () => {
  const { items, comments, clippings, computePoints } = useConnectorsApi();

  return (
    <svg className={styles.connectorSvg}>
      {items.map((item) => {
        const itemType = getWorkspaceItemType(item);
        const sourceId = getWorkspaceItemSourceId(item);
        const source =
          itemType === 'comment'
            ? comments.find((comment) => comment.id === sourceId)
            : clippings.find((clip) => clip.id === sourceId);

        if (!source) return null;

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
            <path
              key={`connector-${item.id}-${idx}`}
              d={path}
              stroke={stroke}
              strokeWidth={1.8}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        });
      })}
    </svg>
  );
};

export default ConnectorSvg;

