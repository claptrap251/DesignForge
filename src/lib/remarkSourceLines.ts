import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root } from "mdast";

/**
 * Remark plugin that annotates AST nodes with data-source-line
 * and data-source-end attributes. These appear as HTML attributes on the
 * rendered elements, enabling the LineGutter to map rendered content back
 * to source lines.
 */
const remarkSourceLines: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (
        node.position &&
        node.type !== "root" &&
        node.type !== "text"
      ) {
        const data = (node as any).data || ((node as any).data = {});
        const hProperties = data.hProperties || (data.hProperties = {});
        hProperties["data-source-line"] = node.position.start.line;
        hProperties["data-source-end"] = node.position.end.line;
      }
    });
  };
};

export default remarkSourceLines;
