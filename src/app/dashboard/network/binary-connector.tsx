// Draws the classic org-chart connector for exactly two children: a stub
// down from the parent, then two equal columns, each carrying its half of
// the horizontal bar (from its center towards the middle) and a stub down
// into its child — so the bar always meets the children's centers,
// without measuring pixel positions. The columns size to their content
// (never squeezed: a deep tree scrolls sideways instead), and every node
// has the same width (tree-node.tsx), so both columns match.
export function BinaryConnector({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-primary/40 h-5 w-0.5" />
      <div className="grid grid-cols-[auto_auto]">
        <div className="flex flex-col items-center">
          <div className="relative h-5 w-full">
            <div className="border-primary/40 absolute top-0 right-0 left-1/2 border-t-2" />
            <div className="bg-primary/40 absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2" />
          </div>
          <div className="px-1 sm:px-3">{left}</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="relative h-5 w-full">
            <div className="border-primary/40 absolute top-0 right-1/2 left-0 border-t-2" />
            <div className="bg-primary/40 absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2" />
          </div>
          <div className="px-1 sm:px-3">{right}</div>
        </div>
      </div>
    </div>
  );
}
