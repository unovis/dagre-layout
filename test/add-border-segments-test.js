/* eslint-env jest */
import { expect } from 'chai'
import { Graph } from '@unovis/graphlibrary'

import addBorderSegments from '../lib/add-border-segments'

describe('addBorderSegments', function () {
  let g

  beforeEach(function () {
    g = new Graph({ compound: true })
  })

  it('does not add border nodes for a non-compound graph', function () {
    const g = new Graph()
    g.setNode('a', { rank: 0 })
    addBorderSegments(g)
    expect(g.nodeCount()).to.equal(1)
    expect(g.node('a')).to.eql({ rank: 0 })
  })

  it('does not add border nodes for a graph with no clusters', function () {
    g.setNode('a', { rank: 0 })
    addBorderSegments(g)
    expect(g.nodeCount()).to.equal(1)
    expect(g.node('a')).to.eql({ rank: 0 })
  })

  it('adds a border for a single-rank subgraph', function () {
    g.setNode('sg', { minRank: 1, maxRank: 1 })
    addBorderSegments(g)

    const bl = g.node('sg').borderLeft[1]
    const br = g.node('sg').borderRight[1]
    expect(g.node(bl)).eqls({ dummy: 'border',
      borderType: 'borderLeft',
      rank: 1,
      width: 0,
      height: 0 })
    expect(g.parent(bl)).equals('sg')
    expect(g.node(br)).eqls({ dummy: 'border',
      borderType: 'borderRight',
      rank: 1,
      width: 0,
      height: 0 })
    expect(g.parent(br)).equals('sg')
  })

  it('adds a border for a multi-rank subgraph', function () {
    g.setNode('sg', { minRank: 1, maxRank: 2 })
    addBorderSegments(g)

    const sgNode = g.node('sg')
    const bl2 = sgNode.borderLeft[1]
    const br2 = sgNode.borderRight[1]
    expect(g.node(bl2)).eqls({ dummy: 'border',
      borderType: 'borderLeft',
      rank: 1,
      width: 0,
      height: 0 })
    expect(g.parent(bl2)).equals('sg')
    expect(g.node(br2)).eqls({ dummy: 'border',
      borderType: 'borderRight',
      rank: 1,
      width: 0,
      height: 0 })
    expect(g.parent(br2)).equals('sg')

    const bl1 = sgNode.borderLeft[2]
    const br1 = sgNode.borderRight[2]
    expect(g.node(bl1)).eqls({ dummy: 'border',
      borderType: 'borderLeft',
      rank: 2,
      width: 0,
      height: 0 })
    expect(g.parent(bl1)).equals('sg')
    expect(g.node(br1)).eqls({ dummy: 'border',
      borderType: 'borderRight',
      rank: 2,
      width: 0,
      height: 0 })
    expect(g.parent(br1)).equals('sg')

    expect(g.hasEdge(sgNode.borderLeft[1], sgNode.borderLeft[2])).to.equal(true)
    expect(g.hasEdge(sgNode.borderRight[1], sgNode.borderRight[2])).to.equal(true)
  })

  it('adds borders for nested subgraphs', function () {
    g.setNode('sg1', { minRank: 1, maxRank: 1 })
    g.setNode('sg2', { minRank: 1, maxRank: 1 })
    g.setParent('sg2', 'sg1')
    addBorderSegments(g)

    const bl1 = g.node('sg1').borderLeft[1]
    const br1 = g.node('sg1').borderRight[1]
    expect(g.node(bl1)).eqls({ dummy: 'border',
      borderType: 'borderLeft',
      rank: 1,
      width: 0,
      height: 0 })
    expect(g.parent(bl1)).equals('sg1')
    expect(g.node(br1)).eqls({ dummy: 'border',
      borderType: 'borderRight',
      rank: 1,
      width: 0,
      height: 0 })
    expect(g.parent(br1)).equals('sg1')

    const bl2 = g.node('sg2').borderLeft[1]
    const br2 = g.node('sg2').borderRight[1]
    expect(g.node(bl2)).eqls({ dummy: 'border',
      borderType: 'borderLeft',
      rank: 1,
      width: 0,
      height: 0 })
    expect(g.parent(bl2)).equals('sg2')
    expect(g.node(br2)).eqls({ dummy: 'border',
      borderType: 'borderRight',
      rank: 1,
      width: 0,
      height: 0 })
    expect(g.parent(br2)).equals('sg2')
  })
})
