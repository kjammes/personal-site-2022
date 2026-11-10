import TreeViz, { type TreeVizProps } from './TreeViz';

/** Interactive B+ tree: search, insert with leaf splits, and range scans along the linked leaves. */
export default function BPlusTree(props: TreeVizProps) {
  return <TreeViz variant="bplus" {...props} />;
}
