import _minBy from 'lodash-es/minBy'
import _filter from 'lodash-es/filter'
import _find from 'lodash-es/find'
import _has from 'lodash-es/has'
import _forEach from 'lodash-es/forEach'
import { alg } from '@unovis/graphlibrary'
import feasibleTree from './feasible-tree'
import { slack, longestPath as initRank } from './util'
import { simplify } from '../util'
const {
  preorder,
  postorder
} = alg // Expose some internals for testing purposes

networkSimplex.initLowLimValues = initLowLimValues
networkSimplex.initCutValues = initCutValues
networkSimplex.calcCutValue = calcCutValue
networkSimplex.leaveEdge = leaveEdge
networkSimplex.enterEdge = enterEdge
networkSimplex.exchangeEdges = exchangeEdges
/*
 * The network simplex algorithm assigns ranks to each node in the input graph
 * and iteratively improves the ranking to reduce the length of edges.
 *
 * Preconditions:
 *
 *    1. The input graph must be a DAG.
 *    2. All nodes in the graph must have an object value.
 *    3. All edges in the graph must have "minlen" and "weight" attributes.
 *
 * Postconditions:
 *
 *    1. All nodes in the graph will have an assigned "rank" attribute that has
 *       been optimized by the network simplex algorithm. Ranks start at 0.
 *
 *
 * A rough sketch of the algorithm is as follows:
 *
 *    1. Assign initial ranks to each node. We use the longest path algorithm,
 *       which assigns ranks to the lowest position possible. In general this
 *       leads to very wide bottom ranks and unnecessarily long edges.
 *    2. Construct a feasible tight tree. A tight tree is one such that all
 *       edges in the tree have no slack (difference between length of edge
 *       and minlen for the edge). This by itself greatly improves the assigned
 *       rankings by shorting edges.
 *    3. Iteratively find edges that have negative cut values. Generally a
 *       negative cut value indicates that the edge could be removed and a new
 *       tree edge could be added to produce a more compact graph.
 *
 * Much of the algorithms here are derived from Gansner, et al., "A Technique
 * for Drawing Directed Graphs." The structure of the file roughly follows the
 * structure of the overall algorithm.
 */

function networkSimplex (g) {
  g = simplify(g)
  initRank(g)
  const t = feasibleTree(g)
  initLowLimValues(t)
  initCutValues(t, g)
  let e
  let f

  while ((e = leaveEdge(t))) {
    f = enterEdge(t, g, e)
    exchangeEdges(t, g, e, f)
  }
}
/*
 * Initializes cut values for all edges in the tree.
 */

function initCutValues (t, g) {
  let vs = postorder(t, t.nodes())
  vs = vs.slice(0, vs.length - 1)

  _forEach(vs, function (v) {
    assignCutValue(t, g, v)
  })
}

function assignCutValue (t, g, child) {
  const childLab = t.node(child)
  const parent = childLab.parent
  t.edge(child, parent).cutvalue = calcCutValue(t, g, child)
}
/*
 * Given the tight tree, its graph, and a child in the graph calculate and
 * return the cut value for the edge between the child and its parent.
 */

function calcCutValue (t, g, child) {
  const childLab = t.node(child)
  const parent = childLab.parent // True if the child is on the tail end of the edge in the directed graph

  let childIsTail = true // The graph's view of the tree edge we're inspecting

  let graphEdge = g.edge(child, parent) // The accumulated cut value for the edge between this node and its parent

  let cutValue = 0

  if (!graphEdge) {
    childIsTail = false
    graphEdge = g.edge(parent, child)
  }

  cutValue = graphEdge.weight

  _forEach(g.nodeEdges(child), function (e) {
    const isOutEdge = e.v === child
    const other = isOutEdge ? e.w : e.v

    if (other !== parent) {
      const pointsToHead = isOutEdge === childIsTail
      const otherWeight = g.edge(e).weight
      cutValue += pointsToHead ? otherWeight : -otherWeight

      if (isTreeEdge(t, child, other)) {
        const otherCutValue = t.edge(child, other).cutvalue
        cutValue += pointsToHead ? -otherCutValue : otherCutValue
      }
    }
  })

  return cutValue
}

function initLowLimValues (tree, root) {
  if (arguments.length < 2) {
    root = tree.nodes()[0]
  }

  dfsAssignLowLim(tree, {}, 1, root)
}

function dfsAssignLowLim (tree, visited, nextLim, v, parent) {
  const low = nextLim
  const label = tree.node(v)
  visited[v] = true

  _forEach(tree.neighbors(v), function (w) {
    if (!_has(visited, w)) {
      nextLim = dfsAssignLowLim(tree, visited, nextLim, w, v)
    }
  })

  label.low = low
  label.lim = nextLim++

  if (parent) {
    label.parent = parent
  } else {
    // TODO should be able to remove this when we incrementally update low lim
    delete label.parent
  }

  return nextLim
}

function leaveEdge (tree) {
  return _find(tree.edges(), function (e) {
    return tree.edge(e).cutvalue < 0
  })
}

function enterEdge (t, g, edge) {
  let v = edge.v
  let w = edge.w // For the rest of this function we assume that v is the tail and w is the
  // head, so if we don't have this edge in the graph we should flip it to
  // match the correct orientation.

  if (!g.hasEdge(v, w)) {
    v = edge.w
    w = edge.v
  }

  const vLabel = t.node(v)
  const wLabel = t.node(w)
  let tailLabel = vLabel
  let flip = false // If the root is in the tail of the edge then we need to flip the logic that
  // checks for the head and tail nodes in the candidates function below.

  if (vLabel.lim > wLabel.lim) {
    tailLabel = wLabel
    flip = true
  }

  const candidates = _filter(g.edges(), function (edge) {
    return flip === isDescendant(t, t.node(edge.v), tailLabel) && flip !== isDescendant(t, t.node(edge.w), tailLabel)
  })

  return _minBy(candidates, function (edge) {
    return slack(g, edge)
  })
}

function exchangeEdges (t, g, e, f) {
  const v = e.v
  const w = e.w
  t.removeEdge(v, w)
  t.setEdge(f.v, f.w, {})
  initLowLimValues(t)
  initCutValues(t, g)
  updateRanks(t, g)
}

function updateRanks (t, g) {
  const root = _find(t.nodes(), function (v) {
    return !g.node(v).parent
  })

  let vs = preorder(t, root)
  vs = vs.slice(1)

  _forEach(vs, function (v) {
    const parent = t.node(v).parent
    let edge = g.edge(v, parent)
    let flipped = false

    if (!edge) {
      edge = g.edge(parent, v)
      flipped = true
    }

    g.node(v).rank = g.node(parent).rank + (flipped ? edge.minlen : -edge.minlen)
  })
}
/*
 * Returns true if the edge is in the tree.
 */

function isTreeEdge (tree, u, v) {
  return tree.hasEdge(u, v)
}
/*
 * Returns true if the specified node is descendant of the root node per the
 * assigned low and lim attributes in the tree.
 */

function isDescendant (tree, vLabel, rootLabel) {
  return rootLabel.low <= vLabel.lim && vLabel.lim <= rootLabel.lim
}

export default networkSimplex
