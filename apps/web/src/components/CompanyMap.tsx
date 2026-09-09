"use client";

import { useCallback, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "@matos/ui";
import type { DepartmentDTO, MapPayload, SkillDTO, SkillStatus } from "@/lib/types";
import type { Selection } from "./DetailPanel";

type MapNodeData = {
  label: string;
  subtitle?: string;
  kind: "company" | "department" | "skill";
  selected?: boolean;
  expanded?: boolean;
  status?: SkillStatus;
  department?: DepartmentDTO;
  skill?: SkillDTO;
  dimmed?: boolean;
};

type MapNode = Node<MapNodeData>;

function statusTone(status?: SkillStatus): "citron" | "muted" | "danger" {
  if (status === "authored") return "citron";
  if (status === "missing") return "danger";
  return "muted";
}

function statusLabel(status?: SkillStatus): string {
  if (status === "authored") return "Authored";
  if (status === "missing") return "Missing";
  return "Planned";
}

function CompanyNode({ data }: NodeProps<MapNode>) {
  return (
    <div
      className={`min-w-[200px] rounded-xl border bg-matos-panel px-3.5 py-3 text-center shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${
        data.selected ? "border-matos-citron shadow-citron" : "border-[#3a4050]"
      } ${data.dimmed ? "opacity-35" : ""}`}
    >
      <Handle type="source" position={Position.Top} className="!bg-matos-citron !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-matos-citron !border-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-matos-citron !border-0" />
      <Handle type="source" position={Position.Left} className="!bg-matos-citron !border-0" />
      <h3 className="text-[13px] font-semibold tracking-tight">{data.label}</h3>
      <p className="mt-1 text-[11px] text-matos-muted">{data.subtitle}</p>
      <div className="mt-2 inline-block rounded-full bg-matos-citron px-2 py-0.5 text-[10px] font-bold text-[#0b0c0e]">
        LIVE
      </div>
    </div>
  );
}

function DeptNode({ data }: NodeProps<MapNode>) {
  return (
    <div
      className={`min-w-[170px] rounded-xl border bg-matos-panel px-3.5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${
        data.selected ? "border-matos-citron shadow-citron" : "border-matos-border"
      } ${data.dimmed ? "opacity-35" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#3a4050] !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-matos-citron !border-0" />
      <h3 className="text-[13px] font-semibold tracking-tight">{data.label}</h3>
      <p className="mt-1 text-[11px] text-matos-muted">{data.subtitle}</p>
      <span
        className={`mt-2 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
          data.selected
            ? "bg-[rgba(214,243,31,0.14)] text-matos-citron"
            : "bg-[#1c2030] text-matos-muted"
        }`}
      >
        {data.expanded ? "Hide skills" : "Show skills"}
      </span>
    </div>
  );
}

function SkillNode({ data }: NodeProps<MapNode>) {
  return (
    <div
      className={`min-w-[148px] rounded-xl border bg-matos-panel px-3.5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${
        data.selected ? "border-matos-citron shadow-citron" : "border-[#33384a]"
      } ${data.dimmed ? "opacity-35" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#3a4050] !border-0" />
      <h3 className="font-mono text-[12px] font-semibold tracking-tight">
        {data.label}
      </h3>
      <div className="mt-2">
        <Badge tone={statusTone(data.status)}>{statusLabel(data.status)}</Badge>
      </div>
    </div>
  );
}

const nodeTypes = {
  company: CompanyNode,
  department: DeptNode,
  skill: SkillNode,
};

function matchesQuery(
  query: string,
  ...parts: Array<string | undefined | null>
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return parts.some((p) => (p ?? "").toLowerCase().includes(q));
}

export function CompanyMap({
  map,
  selection,
  search,
  onSelect,
  onToggleExpand,
}: {
  map: MapPayload;
  selection: Selection;
  search: string;
  onSelect: (s: Selection) => void;
  onToggleExpand: (departmentId: string) => void;
}) {
  const { company, departments } = map;
  const q = search.trim();

  const selectedId =
    selection?.kind === "skill"
      ? selection.skill.id
      : selection?.kind === "department"
        ? selection.department.id
        : selection?.kind === "company"
          ? company.id
          : null;

  const { nodes, edges } = useMemo(() => {
    const ns: MapNode[] = [
      {
        id: company.id,
        type: "company",
        position: { x: company.posX, y: company.posY },
        data: {
          label: company.name,
          subtitle: company.summary,
          kind: "company",
          selected: selectedId === company.id,
          dimmed: q.length > 0,
        },
        draggable: false,
      },
    ];

    const es: Edge[] = [];

    for (const dept of departments) {
      const deptMatch = matchesQuery(q, dept.name, dept.summary, dept.slug);
      const matchingSkills = dept.skills.filter((s) =>
        matchesQuery(q, s.slug, s.title, s.description, s.status),
      );
      const showSkills =
        dept.expanded || (q.length > 0 && matchingSkills.length > 0);
      const skillList = q.length > 0 ? matchingSkills : dept.skills;
      const dimDept = q.length > 0 && !deptMatch && matchingSkills.length === 0;

      ns.push({
        id: dept.id,
        type: "department",
        position: { x: dept.posX, y: dept.posY },
        data: {
          label: dept.name,
          subtitle: `${dept.skills.length} skills${
            showSkills && skillList.length ? " · expanded" : ""
          }`,
          kind: "department",
          selected: selectedId === dept.id,
          expanded: showSkills,
          department: dept,
          dimmed: dimDept,
        },
        draggable: false,
      });

      es.push({
        id: `e-${company.id}-${dept.id}`,
        source: company.id,
        target: dept.id,
        style: {
          stroke: "#3a4050",
          opacity: dimDept ? 0.25 : 1,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#3a4050",
          width: 16,
          height: 16,
        },
      });

      if (showSkills) {
        skillList.forEach((skill, index) => {
          const pos =
            skill.posX != null && skill.posY != null
              ? { x: skill.posX, y: skill.posY }
              : {
                  x: dept.posX + 240,
                  y: dept.posY + index * 90 - 10,
                };
          ns.push({
            id: skill.id,
            type: "skill",
            position: pos,
            data: {
              label: skill.slug,
              kind: "skill",
              selected: selectedId === skill.id,
              status: skill.status,
              skill,
              dimmed: q.length > 0 && !matchesQuery(q, skill.slug, skill.title),
            },
            draggable: false,
          });
          es.push({
            id: `e-${dept.id}-${skill.id}`,
            source: dept.id,
            target: skill.id,
            style: { stroke: "#D6F31F", strokeOpacity: 0.7 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#D6F31F",
              width: 14,
              height: 14,
            },
          });
        });
      }
    }

    return { nodes: ns, edges: es };
  }, [company, departments, selectedId, q]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: MapNode) => {
      if (node.data.kind === "company") {
        onSelect({ kind: "company" });
        return;
      }
      if (node.data.kind === "department" && node.data.department) {
        onToggleExpand(node.data.department.id);
        onSelect({ kind: "department", department: node.data.department });
        return;
      }
      if (node.data.kind === "skill" && node.data.skill) {
        onSelect({ kind: "skill", skill: node.data.skill });
      }
    },
    [onSelect, onToggleExpand],
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.35}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
      >
        <Background color="#2a2e3a" gap={22} size={1} />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  );
}
