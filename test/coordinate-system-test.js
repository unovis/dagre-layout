/* eslint-env jest */
import { Graph } from '@unovis/graphlibrary'
import { expect } from 'chai'

import coordinateSystem from '../lib/coordinate-system'

describe('coordinateSystem', function () {
  let g

  beforeEach(function () {
    g = new Graph()
  })

  describe('coordinateSystem.adjust', function () {
    beforeEach(function () {
      g.setNode('a', { width: 100, height: 200 })
    })

    it('does nothing to node dimensions with rankdir = TB', function () {
      g.setGraph({ rankdir: 'TB' })
      coordinateSystem.adjust(g)
      expect(g.node('a')).eqls({ width: 100, height: 200 })
    })

    it('does nothing to node dimensions with rankdir = BT', function () {
      g.setGraph({ rankdir: 'BT' })
      coordinateSystem.adjust(g)
      expect(g.node('a')).eqls({ width: 100, height: 200 })
    })

    it('swaps width and height for nodes with rankdir = LR', function () {
      g.setGraph({ rankdir: 'LR' })
      coordinateSystem.adjust(g)
      expect(g.node('a')).eqls({ width: 200, height: 100 })
    })

    it('swaps width and height for nodes with rankdir = RL', function () {
      g.setGraph({ rankdir: 'RL' })
      coordinateSystem.adjust(g)
      expect(g.node('a')).eqls({ width: 200, height: 100 })
    })
  })

  describe('coordinateSystem.undo', function () {
    beforeEach(function () {
      g.setNode('a', { width: 100, height: 200, x: 20, y: 40 })
    })

    it('does nothing to points with rankdir = TB', function () {
      g.setGraph({ rankdir: 'TB' })
      coordinateSystem.undo(g)
      expect(g.node('a')).eqls({ x: 20, y: 40, width: 100, height: 200 })
    })

    it('flips the y coordinate for points with rankdir = BT', function () {
      g.setGraph({ rankdir: 'BT' })
      coordinateSystem.undo(g)
      expect(g.node('a')).eqls({ x: 20, y: -40, width: 100, height: 200 })
    })

    it('swaps dimensions and coordinates for points with rankdir = LR', function () {
      g.setGraph({ rankdir: 'LR' })
      coordinateSystem.undo(g)
      expect(g.node('a')).eqls({ x: 40, y: 20, width: 200, height: 100 })
    })

    it('swaps dims and coords and flips x for points with rankdir = RL', function () {
      g.setGraph({ rankdir: 'RL' })
      coordinateSystem.undo(g)
      expect(g.node('a')).eqls({ x: -40, y: 20, width: 200, height: 100 })
    })
  })
})
