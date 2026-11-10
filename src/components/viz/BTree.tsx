import TreeViz, { type TreeVizProps } from './TreeViz';

/** Interactive B-tree: search and insert with node splits. */
export default function BTree(props: TreeVizProps) {
  return <TreeViz variant="b" {...props} />;
}
