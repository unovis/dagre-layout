import _bind from 'lodash-es/bind'
import _merge from 'lodash-es/merge'
import _map from 'lodash-es/map'
import _mapValues from 'lodash-es/mapValues'
import _max from 'lodash-es/max'
import _min from 'lodash-es/min'
import _maxBy from 'lodash-es/maxBy'
import _toPairs from 'lodash-es/toPairs'
import _values from 'lodash-es/values'
import _minBy from 'lodash-es/minBy'
import _sortBy from 'lodash-es/sortBy'
import _has from 'lodash-es/has'
import _find from 'lodash-es/find'
import _range from 'lodash-es/range'
import _reduce from 'lodash-es/reduce'
import _forEach from 'lodash-es/forEach'
import _last from 'lodash-es/last'
import { Graph } from '@unovis/graphlibrary'
import util from '../util'
/*
 * This module provides coordinate assignment based on Brandes and Köpf, "Fast
 * and Simple Horizontal Coordinate Assignment."
 */

/*
 * Marks all edges in the graph with a type-1 conflict with the "type1Conflict"
 * property. A type-1 conflict is one where a non-inner segment crosses an
 * inner segment. An inner segment is an edge with both incident nodes marked
 * with the "dummy" property.
 *
 * This algorithm scans layer by layer, starting with the second, for type-1
 * conflicts between the current layer and the previous layer. For each layer
 * it scans the nodes from left to right until it reaches one that is incident
 * on an inner segment. It then scans predecessors to determine if they have
 * edges that cross that inner segment. At the end a final scan is done for all
 * nodes on the current rank to see if they cross the last visited inner
 * segment.
 *
 * This algorithm (safely) assumes that a dummy node will only be incident on a
 * single node in the layers being scanned.
 */

function findType1Conflicts (g, layering) {
  const conflicts = {}

  function visitLayer (prevLayer, layer) {
    // last visited node in the previous layer that is incident on an inner
    // segment.
    let k0 = 0 // Tracks the last node in this layer scanned for crossings with a type-1
    // segment.

    let scanPos = 0
    const prevLayerLength = prevLayer.length

    const lastNode = _last(layer)

    _forEach(layer, function (v, i) {
      const w = findOtherInnerSegmentNode(g, v)
      const k1 = w ? g.node(w).order : prevLayerLength

      if (w || v === lastNode) {
        _forEach(layer.slice(scanPos, i + 1), function (scanNode) {
          _forEach(g.predecessors(scanNode), function (u) {
            const uLabel = g.node(u)
            const uPos = uLabel.order

            if ((uPos < k0 || k1 < uPos) && !(uLabel.dummy && g.node(scanNode).dummy)) {
              addConflict(conflicts, u, scanNode)
            }
          })
        })

        scanPos = i + 1
        k0 = k1
      }
    })

    return layer
  }

  _reduce(layering, visitLayer)

  return conflicts
}

function findType2Conflicts (g, layering) {
  const conflicts = {}

  function scan (south, southPos, southEnd, prevNorthBorder, nextNorthBorder) {
    let v

    _forEach(_range(southPos, southEnd), function (i) {
      v = south[i]

      if (g.node(v).dummy) {
        _forEach(g.predecessors(v), function (u) {
          const uNode = g.node(u)

          if (uNode.dummy && (uNode.order < prevNorthBorder || uNode.order > nextNorthBorder)) {
            addConflict(conflicts, u, v)
          }
        })
      }
    })
  }

  function visitLayer (north, south) {
    let prevNorthPos = -1
    let nextNorthPos
    let southPos = 0

    _forEach(south, function (v, southLookahead) {
      if (g.node(v).dummy === 'border') {
        const predecessors = g.predecessors(v)

        if (predecessors.length) {
          nextNorthPos = g.node(predecessors[0]).order
          scan(south, southPos, southLookahead, prevNorthPos, nextNorthPos)
          southPos = southLookahead
          prevNorthPos = nextNorthPos
        }
      }

      scan(south, southPos, south.length, nextNorthPos, north.length)
    })

    return south
  }

  _reduce(layering, visitLayer)

  return conflicts
}

function findOtherInnerSegmentNode (g, v) {
  if (g.node(v).dummy) {
    return _find(g.predecessors(v), function (u) {
      return g.node(u).dummy
    })
  }
}

function addConflict (conflicts, v, w) {
  if (v > w) {
    const tmp = v
    v = w
    w = tmp
  }

  let conflictsV = conflicts[v]

  if (!conflictsV) {
    conflicts[v] = conflictsV = {}
  }

  conflictsV[w] = true
}

function hasConflict (conflicts, v, w) {
  if (v > w) {
    const tmp = v
    v = w
    w = tmp
  }

  return _has(conflicts[v], w)
}
/*
 * Try to align nodes into vertical "blocks" where possible. This algorithm
 * attempts to align a node with one of its median neighbors. If the edge
 * connecting a neighbor is a type-1 conflict then we ignore that possibility.
 * If a previous node has already formed a block with a node after the node
 * we're trying to form a block with, we also ignore that possibility - our
 * blocks would be split in that scenario.
 */

function verticalAlignment (g, layering, conflicts, neighborFn) {
  const root = {}
  const align = {}
  const pos = {} // We cache the position here based on the layering because the graph and
  // layering may be out of sync. The layering matrix is manipulated to
  // generate different extreme alignments.

  _forEach(layering, function (layer) {
    _forEach(layer, function (v, order) {
      root[v] = v
      align[v] = v
      pos[v] = order
    })
  })

  _forEach(layering, function (layer) {
    let prevIdx = -1

    _forEach(layer, function (v) {
      let ws = neighborFn(v)

      if (ws.length) {
        ws = _sortBy(ws, function (w) {
          return pos[w]
        })
        const mp = (ws.length - 1) / 2

        for (let i = Math.floor(mp), il = Math.ceil(mp); i <= il; ++i) {
          const w = ws[i]

          if (align[v] === v && prevIdx < pos[w] && !hasConflict(conflicts, v, w)) {
            align[w] = v
            align[v] = root[v] = root[w]
            prevIdx = pos[w]
          }
        }
      }
    })
  })

  return {
    root: root,
    align: align
  }
}

function horizontalCompaction (g, layering, root, align, reverseSep) {
  // This portion of the algorithm differs from BK due to a number of problems.
  // Instead of their algorithm we construct a new block graph and do two
  // sweeps. The first sweep places blocks with the smallest possible
  // coordinates. The second sweep removes unused space by moving blocks to the
  // greatest coordinates without violating separation.
  const xs = {}
  const blockG = buildBlockGraph(g, layering, root, reverseSep) // First pass, assign smallest coordinates via DFS

  const visited = {}

  function pass1 (v) {
    if (!_has(visited, v)) {
      visited[v] = true
      xs[v] = _reduce(blockG.inEdges(v), function (max, e) {
        pass1(e.v)
        return Math.max(max, xs[e.v] + blockG.edge(e))
      }, 0)
    }
  }

  _forEach(blockG.nodes(), pass1)

  const borderType = reverseSep ? 'borderLeft' : 'borderRight'

  function pass2 (v) {
    if (visited[v] !== 2) {
      visited[v]++
      const node = g.node(v)

      const min = _reduce(blockG.outEdges(v), function (min, e) {
        pass2(e.w)
        return Math.min(min, xs[e.w] - blockG.edge(e))
      }, Number.POSITIVE_INFINITY)

      if (min !== Number.POSITIVE_INFINITY && node.borderType !== borderType) {
        xs[v] = Math.max(xs[v], min)
      }
    }
  }

  _forEach(blockG.nodes(), pass2) // Assign x coordinates to all nodes

  _forEach(align, function (v) {
    xs[v] = xs[root[v]]
  })

  return xs
}

function buildBlockGraph (g, layering, root, reverseSep) {
  const blockGraph = new Graph()
  const graphLabel = g.graph()
  const sepFn = sep(graphLabel.nodesep, graphLabel.edgesep, reverseSep)

  _forEach(layering, function (layer) {
    let u

    _forEach(layer, function (v) {
      const vRoot = root[v]
      blockGraph.setNode(vRoot)

      if (u) {
        const uRoot = root[u]
        const prevMax = blockGraph.edge(uRoot, vRoot)
        blockGraph.setEdge(uRoot, vRoot, Math.max(sepFn(g, v, u), prevMax || 0))
      }

      u = v
    })
  })

  return blockGraph
}
/*
 * Returns the alignment that has the smallest width of the given alignments.
 */

function findSmallestWidthAlignment (g, xss) {
  return _minBy(_values(xss), function (xs) {
    const min = (_minBy(_toPairs(xs), pair => pair[1] - width(g, pair[0]) / 2) || ['k', 0])[1]
    const max = (_maxBy(_toPairs(xs), pair => pair[1] + width(g, pair[0]) / 2) || ['k', 0])[1]
    return max - min
  })
}
/*
 * Align the coordinates of each of the layout alignments such that
 * left-biased alignments have their minimum coordinate at the same point as
 * the minimum coordinate of the smallest width alignment and right-biased
 * alignments have their maximum coordinate at the same point as the maximum
 * coordinate of the smallest width alignment.
 */

function alignCoordinates (xss, alignTo) {
  const alignToVals = _values(alignTo)

  const alignToMin = _min(alignToVals)

  const alignToMax = _max(alignToVals)

  _forEach(['u', 'd'], function (vert) {
    _forEach(['l', 'r'], function (horiz) {
      const alignment = vert + horiz
      const xs = xss[alignment]

      if (xs === alignTo) {
        return
      }

      const xsVals = _values(xs)

      const delta = horiz === 'l' ? alignToMin - _min(xsVals) : alignToMax - _max(xsVals)

      if (delta) {
        xss[alignment] = _mapValues(xs, function (x) {
          return x + delta
        })
      }
    })
  })
}

function balance (xss, align) {
  return _mapValues(xss.ul, function (ignore, v) {
    if (align) {
      return xss[align.toLowerCase()][v]
    } else {
      const xs = _sortBy(_map(xss, v))

      return (xs[1] + xs[2]) / 2
    }
  })
}

export function positionX (g) {
  const layering = util.buildLayerMatrix(g)

  const conflicts = _merge(findType1Conflicts(g, layering), findType2Conflicts(g, layering))

  const xss = {}
  let adjustedLayering

  _forEach(['u', 'd'], function (vert) {
    adjustedLayering = vert === 'u' ? layering : _values(layering).reverse()

    _forEach(['l', 'r'], function (horiz) {
      if (horiz === 'r') {
        adjustedLayering = _map(adjustedLayering, function (inner) {
          return _values(inner).reverse()
        })
      }

      const neighborFn = _bind(vert === 'u' ? g.predecessors : g.successors, g)

      const align = verticalAlignment(g, adjustedLayering, conflicts, neighborFn)
      let xs = horizontalCompaction(g, adjustedLayering, align.root, align.align, horiz === 'r')

      if (horiz === 'r') {
        xs = _mapValues(xs, function (x) {
          return -x
        })
      }

      xss[vert + horiz] = xs
    })
  })

  const smallestWidth = findSmallestWidthAlignment(g, xss)
  alignCoordinates(xss, smallestWidth)
  return balance(xss, g.graph().align)
}

function sep (nodeSep, edgeSep, reverseSep) {
  return function (g, v, w) {
    const vLabel = g.node(v)
    const wLabel = g.node(w)
    let sum = 0
    let delta
    sum += vLabel.width / 2

    if (_has(vLabel, 'labelpos')) {
      switch (vLabel.labelpos.toLowerCase()) {
        case 'l':
          delta = -vLabel.width / 2
          break

        case 'r':
          delta = vLabel.width / 2
          break
      }
    }

    if (delta) {
      sum += reverseSep ? delta : -delta
    }

    delta = 0
    sum += (vLabel.dummy ? edgeSep : nodeSep) / 2
    sum += (wLabel.dummy ? edgeSep : nodeSep) / 2
    sum += wLabel.width / 2

    if (_has(wLabel, 'labelpos')) {
      switch (wLabel.labelpos.toLowerCase()) {
        case 'l':
          delta = wLabel.width / 2
          break

        case 'r':
          delta = -wLabel.width / 2
          break
      }
    }

    if (delta) {
      sum += reverseSep ? delta : -delta
    }

    delta = 0
    return sum
  }
}

function width (g, v) {
  return g.node(v).width
}

export default {
  positionX: positionX,
  findType1Conflicts: findType1Conflicts,
  findType2Conflicts: findType2Conflicts,
  addConflict: addConflict,
  hasConflict: hasConflict,
  verticalAlignment: verticalAlignment,
  horizontalCompaction: horizontalCompaction,
  alignCoordinates: alignCoordinates,
  findSmallestWidthAlignment: findSmallestWidthAlignment,
  balance: balance
}
