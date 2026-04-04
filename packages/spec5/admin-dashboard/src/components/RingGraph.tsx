import { forceCenter, forceLink, forceManyBody, forceSimulation } from 'd3-force';
import { useEffect, useMemo, useState } from 'react';
import { FraudRing } from '../types';

interface GraphNode {
  id: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

interface RingGraphProps {
  rings: FraudRing[];
}

export function RingGraph({ rings }: RingGraphProps) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  const graph = useMemo(() => {
    const nodeSet = new Set<string>();
    const links: GraphLink[] = [];

    for (const ring of rings) {
      for (const worker of ring.worker_ids) {
        nodeSet.add(worker);
      }

      for (let i = 0; i < ring.worker_ids.length - 1; i += 1) {
        links.push({ source: ring.worker_ids[i], target: ring.worker_ids[i + 1] });
      }
    }

    const nodes: GraphNode[] = Array.from(nodeSet).map((id) => ({ id }));
    return { nodes, links };
  }, [rings]);

  useEffect(() => {
    if (graph.nodes.length === 0) {
      setPositions({});
      return;
    }

    const width = 560;
    const height = 320;

    const simulation = forceSimulation(graph.nodes)
      .force('link', forceLink(graph.links).id((d) => (d as GraphNode).id).distance(78))
      .force('charge', forceManyBody().strength(-180))
      .force('center', forceCenter(width / 2, height / 2))
      .stop();

    for (let i = 0; i < 80; i += 1) {
      simulation.tick();
    }

    const next: Record<string, { x: number; y: number }> = {};
    for (const node of graph.nodes) {
      next[node.id] = {
        x: node.x ?? width / 2,
        y: node.y ?? height / 2,
      };
    }

    setPositions(next);
    simulation.stop();
  }, [graph]);

  return (
    <section className="card">
      <h2>Syndicate Ring Visualization</h2>
      {graph.nodes.length === 0 ? (
        <p className="muted">No active rings in the recent monitoring window.</p>
      ) : (
        <svg viewBox="0 0 560 320" style={{ width: '100%', borderRadius: 12, background: '#f8faf9' }}>
          {graph.links.map((link, idx) => {
            const source = positions[link.source];
            const target = positions[link.target];
            if (!source || !target) return null;
            return (
              <line
                key={`${link.source}-${link.target}-${idx}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="#7c9488"
                strokeWidth={1.6}
              />
            );
          })}

          {graph.nodes.map((node) => {
            const point = positions[node.id];
            if (!point) return null;
            return (
              <g key={node.id}>
                <circle cx={point.x} cy={point.y} r={12} fill="#0a7a4f" opacity={0.88} />
                <text x={point.x} y={point.y + 28} textAnchor="middle" fontSize="11" fill="#1f2937">
                  {node.id}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}
