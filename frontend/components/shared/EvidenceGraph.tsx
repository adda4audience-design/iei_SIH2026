'use client';
import { useEffect, useState } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap, Node, Edge,
  ReactFlowProvider, MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

const NODE_COLORS: Record<string, string> = {
  institution: '#3b82f6',
  application: '#8b5cf6',
  document: '#06b6d4',
  claim: '#10b981',
  finding: '#f59e0b',
  verification: '#6366f1',
};

const NODE_ICONS: Record<string, string> = {
  institution: '🏛️',
  application: '📋',
  document: '📄',
  claim: '💬',
  finding: '⚠️',
  verification: '✅',
};

function buildLayout(rawNodes: any[]): { nodes: Node[]; edges: never[] } {
  const grouped: Record<string, any[]> = {};
  rawNodes.forEach(n => {
    const t = n.type || 'other';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(n);
  });

  const nodes: Node[] = [];
  const typeOrder = ['institution', 'application', 'document', 'claim', 'finding', 'verification'];
  const colWidth = 220;
  const rowHeight = 90;

  typeOrder.forEach((type, colIdx) => {
    const group = grouped[type] || [];
    group.forEach((n, rowIdx) => {
      const color = NODE_COLORS[type] || '#64748b';
      nodes.push({
        id: n.id,
        position: { x: colIdx * colWidth, y: rowIdx * rowHeight },
        data: {
          label: (
            <div className="text-center px-2 py-1">
              <div className="text-base">{NODE_ICONS[type]}</div>
              <div className="text-xs font-semibold leading-tight mt-0.5 max-w-[150px] truncate">{n.label}</div>
              {n.data?.status && <div className="text-xs opacity-70 mt-0.5">{n.data.status}</div>}
            </div>
          ),
        },
        style: {
          background: `${color}18`,
          border: `2px solid ${color}60`,
          borderRadius: 12,
          padding: 8,
          minWidth: 140,
        },
      });
    });
  });

  return { nodes, edges: [] };
}

export default function EvidenceGraph({ applicationId }: { applicationId: string }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/applications/${applicationId}/evidence-graph`)
      .then(r => {
        const { nodes: rawNodes, edges: rawEdges } = r.data;
        const { nodes: layoutedNodes } = buildLayout(rawNodes);
        setNodes(layoutedNodes);

        const flowEdges: Edge[] = rawEdges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          type: 'smoothstep',
          animated: e.label?.includes('CONFLICT'),
          markerEnd: { type: MarkerType.ArrowClosed },
          style: {
            stroke: e.label?.includes('CONFLICT') ? '#ef4444' :
                    e.label?.includes('VERIFIED') ? '#22c55e' : '#94a3b8',
            strokeWidth: e.label?.includes('CONFLICT') ? 2.5 : 1.5,
          },
          labelStyle: { fill: '#64748b', fontSize: 10 },
          labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9 },
        }));
        setEdges(flowEdges);
      })
      .catch(() => setError('Failed to load evidence graph'))
      .finally(() => setLoading(false));
  }, [applicationId]);

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-400 gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      Building evidence graph…
    </div>
  );

  if (error) return <div className="flex items-center justify-center h-full text-red-400">{error}</div>;

  return (
    <ReactFlowProvider>
      <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.2 }}>
        <Background color="#e2e8f0" gap={20} />
        <Controls />
        <MiniMap nodeColor={n => NODE_COLORS[(n.type as string) || 'other'] || '#64748b'} />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
