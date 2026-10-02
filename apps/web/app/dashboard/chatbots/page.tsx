"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { 
  ReactFlow, 
  ReactFlowProvider, 
  Controls, 
  Background, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge,
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  useReactFlow,
  Handle,
  Position
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { v4 as uuidv4 } from "uuid";
import { chatbotsAPI, ChatbotFlow } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";
import styles from "./page.module.css";

// ── Node Palette ──────────────────────────────────────────────────────
const nodePalette = [
  { type: "trigger", label: "Trigger", icon: "⚡", color: "#6366F1", description: "Keyword, event, or ad click" },
  { type: "message", label: "Send Message", icon: "💬", color: "#3B82F6", description: "Text, image, video, or template" },
  { type: "condition", label: "Condition", icon: "🔀", color: "#F59E0B", description: "Branch by response or value" },
  { type: "action", label: "Action", icon: "⚙️", color: "#EC4899", description: "Tag, assign, or update CRM" },
  { type: "ai_agent", label: "AI Agent", icon: "🤖", color: "#10B981", description: "GPT-powered response from Knowledge Base" },
  { type: "catalog", label: "Catalog", icon: "🛍️", color: "#8B5CF6", description: "Send WhatsApp Product Catalog" },
];

// ── Custom Node Components ────────────────────────────────────────────

const CustomNode = ({ data, type }: { data: any, type: string }) => {
  const palette = nodePalette.find(p => p.type === type);
  return (
    <div className={styles.canvasNode} style={{ width: 250 }}>
      {type !== 'trigger' && <Handle type="target" position={Position.Top} />}
      <div className={styles.nodeHeader} style={{ borderLeftColor: palette?.color || "#6366F1" }}>
        <span className={styles.nodeIcon}>{palette?.icon}</span>
        <span className={styles.nodeLabel}>{data.label || palette?.label}</span>
      </div>
      <div className={styles.nodeBody}>
        {data.config?.text && <div className={styles.nodePreview}>{data.config.text}</div>}
        {data.config?.keyword && <div className={styles.nodePreview}>Keywords: {data.config.keyword}</div>}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const nodeTypes = {
  trigger: (props: any) => <CustomNode {...props} type="trigger" />,
  message: (props: any) => <CustomNode {...props} type="message" />,
  condition: (props: any) => <CustomNode {...props} type="condition" />,
  action: (props: any) => <CustomNode {...props} type="action" />,
  ai_agent: (props: any) => <CustomNode {...props} type="ai_agent" />,
  catalog: (props: any) => <CustomNode {...props} type="catalog" />,
};

// ── Builder Component ─────────────────────────────────────────────────

type CustomNodeData = { label?: string; config?: Record<string, any> };
type AppNode = Node<CustomNodeData>;

const FlowBuilder = ({ 
  initialFlow, 
  onBack,
  workspaceId
}: { 
  initialFlow: ChatbotFlow | null; 
  onBack: () => void;
  workspaceId: string;
}) => {
  const [nodes, setNodes] = useState<AppNode[]>(initialFlow?.flowData?.nodes || []);
  const [edges, setEdges] = useState<Edge[]>(initialFlow?.flowData?.edges || []);
  const [flowName, setFlowName] = useState(initialFlow?.name || "New Flow");
  const [isActive, setIsActive] = useState(initialFlow?.isActive || false);
  const [triggerValue, setTriggerValue] = useState(initialFlow?.triggerValue || "");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const paletteItem = nodePalette.find((n) => n.type === type);
      const newNode: AppNode = {
        id: uuidv4(),
        type,
        position,
        data: { label: paletteItem?.label, config: {} },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleSave = async () => {
    try {
      const payload: Partial<ChatbotFlow> = {
        name: flowName,
        isActive,
        triggerType: "KEYWORD",
        triggerValue: triggerValue,
        flowData: { nodes, edges },
      };

      if (initialFlow?.id) {
        await chatbotsAPI.update(initialFlow.id, workspaceId, payload);
      } else {
        await chatbotsAPI.create(workspaceId, payload);
      }
      alert("Flow saved successfully!");
    } catch (err) {
      console.error("Failed to save flow", err);
      alert("Error saving flow.");
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const updateNodeConfig = (key: string, value: any) => {
    setNodes(nds => nds.map(n => {
      if (n.id === selectedNodeId) {
        return { ...n, data: { ...n.data, config: { ...(n.data.config || {}), [key]: value } } };
      }
      return n;
    }));
  };

  return (
    <div className={styles.builder}>
      <div className={styles.builderTopbar}>
        <div className={styles.builderLeft}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
          <input className={styles.flowNameInput} value={flowName} onChange={(e) => setFlowName(e.target.value)} placeholder="Flow Name" />
          <label style={{marginLeft: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500}}>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Active
          </label>
        </div>
        <div className={styles.builderActions}>
          <button className={styles.primaryBtn} onClick={handleSave}>Save Flow</button>
        </div>
      </div>

      <div className={styles.builderBody}>
        {/* Node Palette */}
        <div className={styles.palette}>
          <h4 className={styles.paletteTitle}>Nodes</h4>
          {nodePalette.map((n) => (
            <div
              key={n.type}
              className={styles.paletteItem}
              draggable
              onDragStart={(e) => onDragStart(e, n.type)}
            >
              <div className={styles.paletteIcon} style={{ background: n.color }}>{n.icon}</div>
              <div className={styles.paletteInfo}>
                <span className={styles.paletteName}>{n.label}</span>
                <span className={styles.paletteDesc}>{n.description}</span>
              </div>
            </div>
          ))}
          
          <div style={{marginTop: 32}}>
             <h4 className={styles.paletteTitle}>Trigger Settings</h4>
             <div className={styles.propField}>
               <label>Trigger Keywords (comma separated)</label>
               <input value={triggerValue} onChange={e => setTriggerValue(e.target.value)} placeholder="e.g. pricing, help" />
             </div>
          </div>
        </div>

        {/* Canvas */}
        <div className={styles.canvas} ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
          >
            <Background color="#E5E7EB" gap={16} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Properties Panel */}
        {selectedNode && (
          <div className={styles.propsPanel}>
            <div className={styles.propsHeader}>
              <h4>Node Properties</h4>
              <button className={styles.closeBtn} onClick={() => setSelectedNodeId(null)}>✕</button>
            </div>
            <div className={styles.propsBody}>
              <div className={styles.propField}>
                <label>Label</label>
                <input 
                  value={selectedNode.data.label || ""} 
                  onChange={(e) => setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, label: e.target.value } } : n))} 
                />
              </div>
              <div className={styles.propField}>
                <label>Type</label>
                <div className={styles.typePill}>{selectedNode.type}</div>
              </div>
              
              {selectedNode.type === "message" && (
                <div className={styles.propField}>
                  <label>Message Text</label>
                  <textarea 
                    value={(selectedNode.data.config?.text as string) || ""} 
                    onChange={e => updateNodeConfig("text", e.target.value)}
                    rows={5} 
                  />
                </div>
              )}

              <button className={styles.deleteNodeBtn} onClick={() => {
                setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
                setSelectedNodeId(null);
              }}>
                🗑️ Delete Node
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Page Component ───────────────────────────────────────────────

export default function ChatbotsPage() {
  const { workspaces } = useAuth();
  const currentWorkspace = workspaces[0];
  
  const [view, setView] = useState<"list" | "builder">("list");
  const [flows, setFlows] = useState<ChatbotFlow[]>([]);
  const [activeFlow, setActiveFlow] = useState<ChatbotFlow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFlows = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const res = await chatbotsAPI.list(currentWorkspace.id);
      if (res.ok) setFlows(res.data.flows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlows();
  }, [currentWorkspace]);

  if (!currentWorkspace) return <div>Loading workspace...</div>;

  if (view === "builder") {
    return (
      <ReactFlowProvider>
        <FlowBuilder 
          initialFlow={activeFlow} 
          workspaceId={currentWorkspace.id}
          onBack={() => {
            setView("list");
            fetchFlows();
          }} 
        />
      </ReactFlowProvider>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.pageTitle}>Bot Studio</h1>
          <p className={styles.pageSubtitle}>Build no-code WhatsApp chatbot flows</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => {
          setActiveFlow(null);
          setView("builder");
        }}>+ Create Flow</button>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Your flows</h3>
          {loading ? (
            <p>Loading flows...</p>
          ) : flows.length === 0 ? (
            <div className={styles.emptyState}>No flows created yet.</div>
          ) : (
            <div className={styles.flowList}>
              {flows.map((f) => (
                <div key={f.id} className={styles.flowCard} onClick={() => {
                  setActiveFlow(f);
                  setView("builder");
                }}>
                  <div className={styles.flowCardLeft}>
                    <div className={styles.flowCardHeader}>
                      <span className={styles.flowCardName}>{f.name}</span>
                      <span className={`${styles.flowStatus} ${f.isActive ? styles.statusActive : styles.statusDraft}`}>
                        {f.isActive ? "ACTIVE" : "DRAFT"}
                      </span>
                    </div>
                    <div className={styles.flowCardMeta}>
                      <span>Keywords: <strong>{f.triggerValue || "None"}</strong></span>
                      <span>•</span>
                      <span>Edited {new Date(f.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
