/**
 * B-tree and B+ tree algorithms that produce a plan: a list of steps, each with a snapshot of the tree
 * and what to highlight. The widget only moves a cursor through the plan.
 *
 * Both trees split bottom up: insert into the leaf, and if it holds one key too many, split it and push
 * a key into the parent, which may split in turn. A B-tree moves the middle key up. A B+ tree leaf
 * keeps every key and copies the first key of the new right leaf up instead.
 */

export type Variant = 'b' | 'bplus';

export type TreeNode = { id: number; keys: number[]; children: TreeNode[] };
export type Tree = { root: TreeNode; nextId: number };

/** How one key is drawn. `cmp` is the key being compared, `up` a key just pushed into a parent. */
export type KeyMark = 'cmp' | 'found' | 'new' | 'up' | 'scan';

export type Step = {
  tree: Tree;
  /** Node being read right now. */
  active?: number;
  /** Nodes read so far, in order. */
  visited: number[];
  /** Keyed by `${nodeId}:${keyIndex}`. */
  marks: Record<string, KeyMark>;
  /** A node holding one key more than it may. */
  overflow?: number;
  /** Nodes produced by the latest split. */
  split?: number[];
  reads: number;
  comparisons: number;
  text: string;
  /** Hold this step longer than usual, for splits and results. */
  long?: boolean;
};

export const isLeaf = (n: TreeNode) => n.children.length === 0;

const cloneNode = (n: TreeNode): TreeNode => ({ id: n.id, keys: [...n.keys], children: n.children.map(cloneNode) });
const cloneTree = (t: Tree): Tree => ({ root: cloneNode(t.root), nextId: t.nextId });

export function leaves(root: TreeNode): TreeNode[] {
  return isLeaf(root) ? [root] : root.children.flatMap(leaves);
}

export function height(root: TreeNode): number {
  return isLeaf(root) ? 1 : 1 + height(root.children[0]);
}

function allKeys(root: TreeNode, variant: Variant): number[] {
  if (variant === 'bplus') return leaves(root).flatMap((l) => l.keys);
  const out: number[] = [];
  const walk = (n: TreeNode) => {
    n.keys.forEach((k, i) => {
      if (!isLeaf(n)) walk(n.children[i]);
      out.push(k);
    });
    if (!isLeaf(n)) walk(n.children[n.keys.length]);
  };
  walk(root);
  return out;
}

export const contains = (t: Tree, v: number, variant: Variant) => allKeys(t.root, variant).includes(v);
export const keyCount = (t: Tree, variant: Variant) => allKeys(t.root, variant).length;

/** Plain insert with no plan, used to build the starting tree. */
export function insertQuiet(t: Tree, v: number, maxKeys: number, variant: Variant): Tree {
  return planInsert(t, v, maxKeys, variant).tree;
}

/** Deterministic so the server-rendered tree matches the hydrated one. */
export function seededTree(count: number, seed: number, maxKeys: number, variant: Variant): Tree {
  let x = seed;
  const rand = () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
  let t: Tree = { root: { id: 0, keys: [], children: [] }, nextId: 1 };
  const used = new Set<number>();
  while (used.size < count) {
    const v = 1 + Math.floor(rand() * 98);
    if (used.has(v)) continue;
    used.add(v);
    t = insertQuiet(t, v, maxKeys, variant);
  }
  return t;
}

/**
 * Suggest a value to insert next: one that is not in the tree and lands in a full leaf,
 * so pressing Insert usually shows a split. Deterministic for a given tree.
 */
export function suggestInsert(t: Tree, maxKeys: number, variant: Variant): number {
  const present = new Set(allKeys(t.root, variant));
  let best = 1;
  let bestSize = -1;
  for (let i = 0; i < 98; i++) {
    const v = 1 + ((i * 37 + t.nextId * 13) % 98);
    if (present.has(v)) continue;
    const size = leafFor(t.root, v, variant).keys.length;
    if (size >= maxKeys) return v;
    if (size > bestSize) [best, bestSize] = [v, size];
  }
  return best;
}

/** Child index to follow from an internal node. B+ separators send equal keys right. */
function route(n: TreeNode, v: number, variant: Variant): number {
  let i = 0;
  while (i < n.keys.length && (variant === 'bplus' ? n.keys[i] <= v : n.keys[i] < v)) i++;
  return i;
}

function leafFor(root: TreeNode, v: number, variant: Variant): TreeNode {
  let n = root;
  while (!isLeaf(n)) n = n.children[route(n, v, variant)];
  return n;
}

const fmt = (keys: number[]) => `[${keys.join(' | ')}]`;

/** Shared state while building one plan. */
class Planner {
  steps: Step[] = [];
  visited: number[] = [];
  reads = 0;
  comparisons = 0;
  tree: Tree;
  constructor(tree: Tree) {
    this.tree = tree;
  }

  push(s: Omit<Step, 'tree' | 'visited' | 'reads' | 'comparisons'> & { tree?: Tree }) {
    this.steps.push({ tree: this.tree, visited: [...this.visited], reads: this.reads, comparisons: this.comparisons, ...s });
  }

  read(n: TreeNode, why: string) {
    this.reads += 1;
    this.visited.push(n.id);
    this.push({ active: n.id, marks: {}, text: `Read node ${fmt(n.keys)}${why}. Disk reads so far: ${this.reads}.` });
  }

  /**
   * Binary search for v inside one node, one step per comparison.
   * mode 'exact' stops on a match. 'upper' finds the first key larger than v (B+ routing).
   * 'lower' finds the first key at least v (start of a range scan).
   * Returns the match index, or -1 and the insertion point.
   */
  searchNode(n: TreeNode, v: number, mode: 'exact' | 'upper' | 'lower'): { hit: number; pos: number } {
    let lo = 0;
    let hi = mode === 'exact' ? n.keys.length - 1 : n.keys.length;
    while (mode === 'exact' ? lo <= hi : lo < hi) {
      const mid = (lo + hi) >> 1;
      const k = n.keys[mid];
      this.comparisons += 1;
      const marks = { [`${n.id}:${mid}`]: 'cmp' as const };
      if (mode === 'exact' && k === v) {
        this.push({ active: n.id, marks: { [`${n.id}:${mid}`]: 'found' }, text: `${v} equals ${k}.` });
        return { hit: mid, pos: mid };
      }
      const goRight = mode === 'upper' ? k <= v : k < v;
      if (goRight) {
        const rel = k === v ? `${v} equals ${k}, and separator keys send equal values right` : `${v} is larger than ${k}`;
        this.push({ active: n.id, marks, text: `${rel}, so look right of it.` });
        lo = mid + 1;
      } else {
        this.push({ active: n.id, marks, text: `${v} is smaller than ${k}, so look left of it.` });
        hi = mode === 'exact' ? mid - 1 : mid;
      }
    }
    return { hit: -1, pos: lo };
  }

  /** Walk from the root to the leaf where v belongs. In a B-tree it can stop early on a match. */
  descend(v: number, variant: Variant, leafMode: 'exact' | 'lower') {
    const path: { node: TreeNode; idx: number }[] = [];
    let n = this.tree.root;
    this.read(n, ', the root');
    for (;;) {
      if (isLeaf(n)) {
        const r = this.searchNode(n, v, leafMode);
        return { path, leaf: n, hit: r.hit >= 0 ? { node: n, idx: r.hit } : undefined, pos: r.pos };
      }
      if (variant === 'b') {
        const r = this.searchNode(n, v, 'exact');
        if (r.hit >= 0) return { path, leaf: n, hit: { node: n, idx: r.hit }, pos: r.hit };
        path.push({ node: n, idx: r.pos });
        n = n.children[r.pos];
      } else {
        const r = this.searchNode(n, v, 'upper');
        path.push({ node: n, idx: r.pos });
        n = n.children[r.pos];
      }
      this.read(n, isLeaf(n) ? ', a leaf' : '');
    }
  }
}

export function planSearch(t: Tree, v: number, variant: Variant): Step[] {
  const p = new Planner(t);
  const r = p.descend(v, variant, 'exact');
  if (r.hit) {
    const where = isLeaf(r.hit.node) ? 'in a leaf' : 'in an internal node, without going down to a leaf';
    p.push({
      active: r.hit.node.id,
      marks: { [`${r.hit.node.id}:${r.hit.idx}`]: 'found' },
      text: `Found ${v} ${where}. ${p.reads} disk ${p.reads === 1 ? 'read' : 'reads'}, ${p.comparisons} comparisons.`,
      long: true,
    });
  } else {
    p.push({
      active: r.leaf.id,
      marks: {},
      text: `Reached a leaf without finding ${v}, so it is not in the tree. ${p.reads} disk reads.`,
      long: true,
    });
  }
  return p.steps;
}

/** The plan and the tree after the insert. The widget commits the tree right away and replays the plan. */
export function planInsert(t: Tree, v: number, maxKeys: number, variant: Variant): { steps: Step[]; tree: Tree } {
  const work = cloneTree(t);
  const p = new Planner(work);
  // Steps reference snapshots, because `work` is changed in place below.
  p.tree = cloneTree(work);
  const r = p.descend(v, variant, 'exact');
  if (r.hit) {
    p.push({ active: r.hit.node.id, marks: { [`${r.hit.node.id}:${r.hit.idx}`]: 'found' }, text: `${v} is already in the tree. Nothing to insert.`, long: true });
    return { steps: p.steps, tree: t };
  }

  // Find the live nodes in `work` that match the path through the snapshot.
  const live = (id: number) => findNode(work.root, id)!;
  const path = r.path.map((s) => ({ node: live(s.node.id), idx: s.idx }));
  let node = live(r.leaf.id);
  node.keys.splice(r.pos, 0, v);
  p.tree = cloneTree(work);
  const over = node.keys.length > maxKeys;
  p.push({
    active: node.id,
    overflow: over ? node.id : undefined,
    marks: { [`${node.id}:${r.pos}`]: 'new' },
    text: over
      ? `Insert ${v} into the leaf. It now holds ${node.keys.length} keys, one more than the ${maxKeys} that fit, so it must split.`
      : `Insert ${v} into the leaf. It has room, so the insert is done. ${p.reads} disk reads.`,
    long: true,
  });

  while (node.keys.length > maxKeys) {
    const m = Math.floor(node.keys.length / 2);
    const right: TreeNode = { id: work.nextId++, keys: [], children: [] };
    let upKey: number;
    let how: string;
    if (isLeaf(node) && variant === 'bplus') {
      right.keys = node.keys.slice(m);
      node.keys = node.keys.slice(0, m);
      upKey = right.keys[0];
      how = `Split the leaf in two. Every key stays in a leaf, and a copy of ${upKey}, the first key of the new right leaf, goes up as a separator.`;
    } else {
      upKey = node.keys[m];
      right.keys = node.keys.slice(m + 1);
      right.children = node.children.slice(m + 1);
      node.keys = node.keys.slice(0, m);
      node.children = node.children.slice(0, m + 1);
      how = `Split the node in two. The middle key, ${upKey}, moves up to the parent.`;
    }

    const parentStep = path.pop();
    let parent: TreeNode;
    let at: number;
    let grew = false;
    if (parentStep) {
      parent = parentStep.node;
      at = parentStep.idx;
      parent.keys.splice(at, 0, upKey);
      parent.children.splice(at + 1, 0, right);
    } else {
      parent = { id: work.nextId++, keys: [upKey], children: [node, right] };
      at = 0;
      work.root = parent;
      grew = true;
    }
    p.tree = cloneTree(work);
    const parentOver = parent.keys.length > maxKeys;
    let tail: string;
    if (grew) tail = ` There was no parent, so ${upKey} becomes a new root and the tree grows one level. Trees grow at the top, so every leaf stays at the same depth.`;
    else if (parentOver) tail = ` Now the parent holds ${parent.keys.length} keys, too many, so it splits next.`;
    else tail = ` The parent has room, so the insert is done. ${p.reads} disk reads.`;
    p.push({
      active: parent.id,
      split: [node.id, right.id],
      overflow: parentOver ? parent.id : undefined,
      marks: { [`${parent.id}:${at}`]: 'up' },
      text: how + tail,
      long: true,
    });
    node = parent;
  }
  return { steps: p.steps, tree: work };
}

function findNode(n: TreeNode, id: number): TreeNode | undefined {
  if (n.id === id) return n;
  for (const c of n.children) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return undefined;
}

/** B+ tree range scan: descend once to the first key, then walk the linked leaves. */
export function planRange(t: Tree, from: number, to: number): Step[] {
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const p = new Planner(t);
  const r = p.descend(lo, 'bplus', 'lower');
  const chain = leaves(t.root);
  let li = chain.findIndex((l) => l.id === r.leaf.id);
  let i = r.pos;
  const found: number[] = [];
  const marks: Record<string, 'scan'> = {};
  for (;;) {
    const leaf = chain[li];
    if (i >= leaf.keys.length) {
      li += 1;
      if (li >= chain.length) break;
      i = 0;
      p.reads += 1;
      p.visited.push(chain[li].id);
      p.push({ active: chain[li].id, marks: { ...marks }, text: `End of this leaf. Follow its next pointer to the neighbouring leaf, without going back up the tree. Disk reads so far: ${p.reads}.` });
      continue;
    }
    const k = leaf.keys[i];
    if (k > hi) {
      p.comparisons += 1;
      p.push({ active: leaf.id, marks: { ...marks, [`${leaf.id}:${i}`]: 'cmp' }, text: `${k} is past ${hi}, so the scan stops here.` });
      break;
    }
    found.push(k);
    marks[`${leaf.id}:${i}`] = 'scan';
    p.push({ active: leaf.id, marks: { ...marks }, text: `${k} is in range. Collected so far: ${found.join(', ')}.` });
    i += 1;
  }
  p.push({
    active: undefined,
    marks: { ...marks },
    text: found.length
      ? `Range ${lo} to ${hi}: ${found.join(', ')}. ${found.length} values in ${p.reads} disk reads.`
      : `No values between ${lo} and ${hi}. ${p.reads} disk reads.`,
    long: true,
  });
  return p.steps;
}
