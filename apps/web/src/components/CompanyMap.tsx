"use client";

import { useCallback, useMemo, useState } from "react";
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
import {
  company,
  departments,
  skillsForDepartment,
  type Department,
  type Skill,
} from "@/data/company-map";
import type { Selection } from "./DetailPanel";

type MapNodeData = {
  label: string;
  subtitle?: string;
  kind: "company" | "department" | "skill";
  selected?: boolean;
  expanded?: boolean;
  status?: string;
  department?: Department;
  skill?: Skill;
};

type MapNode = Node<MapNodeData>;

function CompanyNode({ data }: NodeProps<MapNode>) {
  return (
    <div className="min-w-[200px] rounded-xl border border-[#3a4050] bg-matos-panel px-3.5 py-3 text-center shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
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
  const selected = data.selected;
  return (
    <div
      className={`min-w-[170px] rounded-xl border bg-matos-panel px-3.5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${
        selected
          ? "border-matos-citron shadow-citron"
          : "border-matos-border"
      }`}
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
        {data.selected ? "Selected" : data.expanded ? "Hide skills" : "Show skills"}
      </span>
    </div>
  );
}

function SkillNode({ data }: NodeProps<MapNode>) {
  return (
    <div
      className={`min-w-[148px] rounded-xl border bg-matos-panel px-3.5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${
        data.selected ? "border-matos-citron shadow-citron" : "border-[#33384a]"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#3a4050] !border-0" />
      <h3 className="font-mono text-[12px] font-semibold tracking-tight">
        {data.label}
      </h3>
      <div className="mt-2">
        <Badge>Authored</Badge>
      </div>
    </div>
  );
}

const nodeTypes = {
  company: CompanyNode,
  department: DeptNode,
  skill: SkillNode,
};

const DEPT_POSITIONS: Record<string, { x: number; y: number }> = {
  "dept-research": { x: 40, y: 40 },
  "dept-script": { x: 40, y: 220 },
  "dept-content": { x: 520, y: 20 },
  "dept-calendar": { x: 40, y: 400 },
  "dept-publish": { x: 520, y: 420 },
  "dept-monetization": { x: 520, y: 220 },
  "dept-proof": { x: 280, y: 480 },
};

export function CompanyMap({
  onSelect,
  selection,
}: {
  onSelect: (s: Selection) => void;
  selection: Selection;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["dept-content", "dept-monetization"]),
  );

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
        position: { x: 280, y: 220 },
        data: {
          label: company.name,
          subtitle: company.summary,
          kind: "company",
          selected: selectedId === company.id,
        },
        draggable: true,
      },
    ];

    const es: Edge[] = [];

    for (const dept of departments) {
      const pos = DEPT_POSITIONS[dept.id] ?? { x: 0, y: 0 };
      const isExpanded = expanded.has(dept.id);
      const skillList = skillsForDepartment(dept.id);
      ns.push({
        id: dept.id,
        type: "department",
        position: pos,
        data: {
          label: dept.name,
          subtitle: `${skillList.length || dept.skillIds.length} skills${
            isExpanded && skillList.length ? " · expanded" : ""
          }`,
          kind: "department",
          selected: selectedId === dept.id,
          expanded: isExpanded,
          department: dept,
        },
      });
      es.push({
        id: `e-${company.id}-${dept.id}`,
        source: company.id,
        target: dept.id,
        style: { stroke: "#3a4050" },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#3a4050",
          width: 16,
          height: 16,
        },
      });

      if (isExpanded) {
        skillList.forEach((skill, index) => {
          ns.push({
            id: skill.id,
            type: "skill",
            position: {
              x: pos.x + 240,
              y: pos.y + index * 90 - 10,
            },
            data: {
              label: skill.slug,
              kind: "skill",
              selected: selectedId === skill.id,
              status: skill.status,
              skill,
            },
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
  }, [expanded, selectedId]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: MapNode) => {
      if (node.data.kind === "company") {
        onSelect({ kind: "company" });
        return;
      }
      if (node.data.kind === "department" && node.data.department) {
        const id = node.data.department.id;
        setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        onSelect({ kind: "department", department: node.data.department });
        return;
      }
      if (node.data.kind === "skill" && node.data.skill) {
        onSelect({ kind: "skill", skill: node.data.skill });
      }
    },
    [onSelect],
  );

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute left-7 top-[18px] z-10 w-[260px] rounded-[9px] border border-matos-border bg-matos-panel px-3 py-2.5 text-xs text-matos-muted">
        Search skills, departments…
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background color="#2a2e3a" gap={22} size={1} />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  );
}
