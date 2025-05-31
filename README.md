# Plate2: Collaborative Editor Playground

This project is an attempt to use **Supabase Realtime** for collaborative editing with [Plate](https://platejs.org/), [Slate](https://docs.slatejs.org/), and [Quill](https://quilljs.com/).

- **Supabase Realtime** already works with **Slate** and **Quill** editors in this repo.
- **Supabase provider now works with Plate for collaborative editing!**
- **TODO:** Remote cursors and selection configuration for Plate (see `app/plate/page.tsx` and `lib/providers/unified-providers.ts`).
- **TODO:** Syncing data with the database for Plate.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

```
└── 📁plate2
    └── 📁.vscode
        └── mcp.json
    └── 📁app
        └── favicon.ico
        └── globals.css
        └── layout.tsx
        └── page.tsx
        └── 📁plate
        └── plate-collaboration.md
            └── collaboration.md
            └── page.tsx
        └── 📁quill
            └── editor.tsx
            └── page.tsx
            └── styles.css
        └── 📁slate
            └── 📁[id]
                └── page.tsx
            └── 📁components
                └── create-document-btn.tsx
                └── delete-document-btn.tsx
            └── page.tsx
            └── styles.css
            └── supabase-provider.ts
    └── 📁components
        └── 📁slate
            └── CodeElement.tsx
            └── CollaborativeEditor.tsx
            └── Cursors.tsx
            └── CustomEditor.ts
            └── DefaultElement.tsx
            └── Leaf.tsx
            └── UserList.tsx
        └── 📁ui
            └── blockquote-element-static.tsx
            └── blockquote-element.tsx
            └── button.tsx
            └── cursor-overlay.tsx
            └── dropdown-menu.tsx
            └── editor-static.tsx
            └── editor.tsx
            └── fixed-toolbar.tsx
            └── heading-element-static.tsx
            └── heading-element.tsx
            └── mark-toolbar-button.tsx
            └── paragraph-element-static.tsx
            └── paragraph-element.tsx
            └── remote-cursor-overlay.tsx
            └── separator.tsx
            └── toolbar.tsx
            └── tooltip.tsx
    └── 📁constants
        └── 📁slate
            └── index.ts
    └── 📁hooks
        └── 📁slate
            └── use-collaboration.ts
        └── use-mounted.ts
    └── 📁lib
        └── 📁editor
            └── initialValue.ts
        └── 📁providers
            └── provider-manager.ts
            └── unified-providers.ts
        └── 📁supabase
            └── client.ts
            └── middleware.ts
            └── server.ts
        └── utils.ts
    └── 📁public
        └── file.svg
        └── globe.svg
        └── next.svg
        └── vercel.svg
        └── window.svg
    └── 📁types
        └── editor.ts
    └── .env.local
    └── .gitignore
    └── bun.lock
    └── components.json
    └── eslint.config.mjs
    └── next-env.d.ts
    └── next.config.ts
    └── package.json
    └── postcss.config.mjs
    └── README.md
    └── tsconfig.json
```
