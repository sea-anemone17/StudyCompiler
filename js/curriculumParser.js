import { uid } from "./state.js";

export function parseCurriculumText(text, subjectId) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(line => line.replace(/\t/g, "  "))
    .filter(line => line.trim().length > 0);

  const nodes = [];
  const stack = [];

  for (const rawLine of lines) {
    const { depth, title } = parseLine(rawLine);
    if (!title) continue;

    const parent = depth > 0 ? stack[depth - 1] : null;
    const node = {
      id: uid("node"),
      subjectId,
      title,
      level: getLevelName(depth),
      parentId: parent?.id || null,
      order: nodes.length + 1
    };

    nodes.push(node);
    stack[depth] = node;
    stack.length = depth + 1;
  }

  return markLeaves(nodes);
}

export function curriculumToText(nodes) {
  const ordered = [...(nodes || [])].sort((a, b) => a.order - b.order);
  return ordered.map(node => `${"ㄴ".repeat(getDepth(node, ordered))} ${node.title}`.trim()).join("\n");
}

export function getLeafNodes(nodes) {
  const parentIds = new Set(nodes.map(node => node.parentId).filter(Boolean));
  return nodes.filter(node => !parentIds.has(node.id));
}

export function getNodePath(nodes, nodeId) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const path = [];
  let current = byId.get(nodeId);
  while (current) {
    path.unshift(current.title);
    current = byId.get(current.parentId);
  }
  return path;
}

export function renderTreeHTML(nodes) {
  if (!nodes?.length) return "<div class='empty-state'>시험범위 트리를 입력해 주세요.</div>";
  const childrenByParent = new Map();
  for (const node of nodes) {
    const key = node.parentId || "root";
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(node);
  }
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.order - b.order);
  }

  function draw(parentId = "root") {
    const children = childrenByParent.get(parentId) || [];
    if (!children.length) return "";
    return `<ul>${children.map(child => `<li><strong>${escapeHTML(child.title)}</strong> <span class='badge'>${child.level}</span>${draw(child.id)}</li>`).join("")}</ul>`;
  }

  return draw();
}

export function normalizeAITree(tree, subjectId) {
  const nodes = [];
  function walk(items, parentId = null, depth = 0) {
    if (!Array.isArray(items)) return;
    items.forEach((item, index) => {
      const node = {
        id: uid("node"),
        subjectId,
        title: item.title || item.name || `개념 ${nodes.length + 1}`,
        level: item.level || getLevelName(depth),
        parentId,
        order: nodes.length + 1,
        importance: item.importance || null,
        targetVersions: item.targetVersions || null,
        needsUserReview: Boolean(item.needs_user_review || item.needsUserReview)
      };
      nodes.push(node);
      walk(item.children || item.items || [], node.id, depth + 1);
    });
  }
  walk(tree);
  return markLeaves(nodes);
}

function parseLine(rawLine) {
  const leading = rawLine.match(/^\s*/)?.[0]?.length || 0;
  const trimmed = rawLine.trim();
  const markerMatch = trimmed.match(/^(ㄴ+|[-*]+)\s*(.*)$/);
  if (markerMatch) {
    const marker = markerMatch[1];
    const depth = marker.startsWith("ㄴ") ? marker.length : marker.length - 1;
    return { depth, title: markerMatch[2].trim() };
  }
  return { depth: Math.floor(leading / 2), title: trimmed };
}

function markLeaves(nodes) {
  const parentIds = new Set(nodes.map(node => node.parentId).filter(Boolean));
  return nodes.map(node => ({ ...node, isLeaf: !parentIds.has(node.id) }));
}

function getDepth(node, nodes) {
  let depth = 0;
  let current = node;
  const byId = new Map(nodes.map(item => [item.id, item]));
  while (current?.parentId) {
    depth += 1;
    current = byId.get(current.parentId);
  }
  return depth;
}

function getLevelName(depth) {
  return ["대단원", "중단원", "소단원", "개념"][Math.min(depth, 3)] || "개념";
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}
