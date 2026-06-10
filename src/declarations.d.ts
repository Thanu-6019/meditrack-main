// src/declarations.d.ts

// 1. Tell TypeScript that importing raw CSS files is completely fine
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

// 2. Optional: If you use Tailwind or CSS Modules later, this handles them too
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}