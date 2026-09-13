// Draws the classic org-chart connector for exactly two children: a stub
// down from the parent, an L-shaped bar spanning to each child's center,
// and a stub up into each child — relies on the two slots being equal
// width (flex-1), not on measuring pixel positions.
export function BinaryConnector({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-primary/40 h-6 w-0.5" />
      <div className="flex w-full">
        <div className="flex flex-1 justify-end">
          <div className="border-primary/40 h-6 w-1/2 border-t-2 border-r-2" />
        </div>
        <div className="flex flex-1 justify-start">
          <div className="border-primary/40 h-6 w-1/2 border-t-2 border-l-2" />
        </div>
      </div>
      <div className="flex gap-8">
        <div className="flex flex-col items-center">
          <div className="bg-primary/40 h-6 w-0.5" />
          {left}
        </div>
        <div className="flex flex-col items-center">
          <div className="bg-primary/40 h-6 w-0.5" />
          {right}
        </div>
      </div>
    </div>
  );
}
