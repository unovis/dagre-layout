/* eslint-env jest */
import _ from 'lodash'
import { expect } from 'chai'
import { Graph } from '@unovis/graphlibrary'

import order from '../../lib/order'
import crossCount from '../../lib/order/cross-count'
import util from '../../lib/util'

describe('order', function () {
  let g

  beforeEach(function () {
    g = new Graph()
      .setDefaultEdgeLabel({ weight: 1 })
  })

  it('does not add crossings to a tree structure', function () {
    g.setNode('a', { rank: 1 })
    _.forEach(['b', 'e'], function (v) { g.setNode(v, { rank: 2 }) })
    _.forEach(['c', 'd', 'f'], function (v) { g.setNode(v, { rank: 3 }) })
    g.setPath(['a', 'b', 'c'])
    g.setEdge('b', 'd')
    g.setPath(['a', 'e', 'f'])
    order(g)
    const layering = util.buildLayerMatrix(g)
    expect(crossCount(g, layering)).to.equal(0)
  })

  it('can solve a simple graph', function () {
    // This graph resulted in a single crossing for previous versions of dagre.
    _.forEach(['a', 'd'], function (v) { g.setNode(v, { rank: 1 }) })
    _.forEach(['b', 'f', 'e'], function (v) { g.setNode(v, { rank: 2 }) })
    _.forEach(['c', 'g'], function (v) { g.setNode(v, { rank: 3 }) })
    order(g)
    const layering = util.buildLayerMatrix(g)
    expect(crossCount(g, layering)).to.equal(0)
  })

  it('can minimize crossings', function () {
    g.setNode('a', { rank: 1 })
    _.forEach(['b', 'e', 'g'], function (v) { g.setNode(v, { rank: 2 }) })
    _.forEach(['c', 'f', 'h'], function (v) { g.setNode(v, { rank: 3 }) })
    g.setNode('d', { rank: 4 })
    order(g)
    const layering = util.buildLayerMatrix(g)
    expect(crossCount(g, layering)).to.be.lte(1)
  })
})
