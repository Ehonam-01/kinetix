// ltree labels only allow letters, digits and underscores — a raw UUID
// (which contains hyphens) is not a valid label. Stripping the hyphens
// keeps the label unique and derived deterministically from the node id.
export function toLtreeLabel(id: string): string {
  return id.replace(/-/g, "");
}

export function childPath(parentPath: string | null, label: string): string {
  return parentPath ? `${parentPath}.${label}` : label;
}
