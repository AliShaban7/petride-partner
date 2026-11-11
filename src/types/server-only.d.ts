// `server-only` is aliased by the Next.js bundler (next/dist/compiled/server-only); this gives
// TypeScript a module to resolve. Importing it in a file makes any client import a build error.
declare module "server-only" {}
