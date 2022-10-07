import commonjs from 'rollup-plugin-commonjs'
import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'

import pkg from './package.json'

const externals = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
]

const regexesOfPackages = externals // To prevent having node_modules in the build files
  .map(packageName => new RegExp(`^${packageName}(/.*)?`))

const plugins = [
  commonjs(),
  resolve({
    extensions: ['.js'],
    mainFields: ['jsnext:main', 'module', 'main', 'browser'],
  }),
]

export default [
  {
    input: 'lib/index.js',
    external: regexesOfPackages,
    output: {
      dir: 'dist',
      sourcemap: true,
      format: 'esm',
      preserveModules: true,
      preserveModulesRoot: './lib',
    },
    plugins,
  },
  {
    input: 'lib/index-default-export.js',
    output: {
      file: 'dist/dagre.js',
      sourcemap: true,
      format: 'umd',
      name: 'dagre',
      plugins: [terser()],
    },
    plugins,
  },
]
