import type { NetworkChild, NetworkView } from "@/repositories/network";
import { BinaryConnector } from "./binary-connector";
import { TreeNode } from "./tree-node";
import { CenteredScroll } from "./centered-scroll";

function levelName(
  code: number | null,
  levelNameByCode: Record<number, string>,
) {
  return code ? (levelNameByCode[code] ?? `Niveau ${code}`) : null;
}

function Branch({
  node,
  depth,
  maxDepth,
  selectedLevel,
  levelNameByCode,
}: {
  node: NetworkChild | undefined;
  depth: number;
  maxDepth: number;
  selectedLevel: number;
  levelNameByCode: Record<number, string>;
}) {
  // A vacant position still shows the positions under it, down to the
  // level's last generation: the member sees every place left to fill.
  const qualified = (node?.currentLevelCode ?? 0) >= selectedLevel;
  const left = node?.children.find((c) => c.position === "LEFT");
  const right = node?.children.find((c) => c.position === "RIGHT");

  return (
    <div className="flex flex-col items-center">
      {node ? (
        <TreeNode
          username={node.username}
          levelName={levelName(node.currentLevelCode, levelNameByCode)}
          variant={qualified ? "member" : "unqualified"}
        />
      ) : (
        <TreeNode variant="vacant" />
      )}
      {depth < maxDepth && (
        <BinaryConnector
          left={
            <Branch
              node={left}
              depth={depth + 1}
              maxDepth={maxDepth}
              selectedLevel={selectedLevel}
              levelNameByCode={levelNameByCode}
            />
          }
          right={
            <Branch
              node={right}
              depth={depth + 1}
              maxDepth={maxDepth}
              selectedLevel={selectedLevel}
              levelNameByCode={levelNameByCode}
            />
          }
        />
      )}
    </div>
  );
}

export function GenealogyTree({
  network,
  maxDepth,
  selectedLevel,
  levelNameByCode,
}: {
  network: NetworkView;
  maxDepth: number;
  selectedLevel: number;
  levelNameByCode: Record<number, string>;
}) {
  const left = network.children.find((c) => c.position === "LEFT");
  const right = network.children.find((c) => c.position === "RIGHT");

  return (
    <CenteredScroll className="overflow-x-auto pb-4">
      <div className="flex min-w-fit flex-col items-center px-4">
        <TreeNode
          username={network.username}
          levelName={levelName(network.currentLevelCode, levelNameByCode)}
          variant="root"
        />
        <BinaryConnector
          left={
            <Branch
              node={left}
              depth={1}
              maxDepth={maxDepth}
              selectedLevel={selectedLevel}
              levelNameByCode={levelNameByCode}
            />
          }
          right={
            <Branch
              node={right}
              depth={1}
              maxDepth={maxDepth}
              selectedLevel={selectedLevel}
              levelNameByCode={levelNameByCode}
            />
          }
        />
      </div>
    </CenteredScroll>
  );
}
