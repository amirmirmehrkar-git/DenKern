// @ts-check
const path = require('path');

/**
 * Monorepo root — two levels up from apps/web/.
 * Used to resolve workspace packages that are not installed via npm
 * (they are referenced by source, aliased via webpack).
 * Also used to resolve mock seed data and config files at runtime.
 */
const projectRoot = path.resolve(__dirname, '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Expose MOCK_ROOT to server-side code (Node.js runtime only — never sent to browser).
   * Adapters and the dispatcher use this to locate mock/cases/ and config/.
   */
  env: {
    MOCK_ROOT: projectRoot,
  },

  webpack: (config) => {
    /**
     * Resolve workspace packages by source file.
     * These packages are not npm-installed; webpack must find them directly.
     * TypeScript paths in tsconfig.json mirror these aliases for IDE support.
     */
    /**
     * Allow TypeScript files to be imported with the .js extension.
     * Required because the project uses ESM-style imports (`.js` suffix on `.ts` files),
     * which is correct for Node16/bundler moduleResolution but webpack needs
     * explicit guidance to resolve .js → .ts / .tsx.
     */
    config.resolve.extensionAlias = {
      '.js':  ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };

    config.resolve.alias = {
      ...config.resolve.alias,
      '@denkkern/types': path.resolve(projectRoot, 'packages/types/src/index.ts'),
      '@denkkern/engine': path.resolve(projectRoot, 'packages/engine/src/index.ts'),
      '@denkkern/mock': path.resolve(projectRoot, 'mock/index.ts'),
    };
    return config;
  },
};

module.exports = nextConfig;
