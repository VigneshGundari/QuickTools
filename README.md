# QuickTools UI — Stage 1

A responsive React + Vite interface for the QuickTools online utilities website.

## Included in this stage
- Responsive homepage and navigation
- Searchable tool library with category filters
- PDF, image, document and everyday tool cards
- Individual tool upload screen UI
- Light/dark theme toggle (saved in localStorage)
- File selection UI and selected-file state
- Responsive mobile layout
- Normal CSS (no Tailwind)

## Important
This is the **UI stage**. File selection and navigation work, but the processing engines are not connected yet. The tool page clearly indicates this during the preview. Do not advertise file processing as available until the relevant tool has been implemented and tested.

## Run locally
1. Install Node.js (LTS recommended).
2. Extract this ZIP.
3. Open a terminal inside the `quicktools-ui` folder.
4. Run:

```bash
npm install
npm run dev
```

5. Open the local URL printed by Vite, usually `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

## Next stage
Connect actual PDF operations first, then image and document processing. A Django backend can be added for server-side tasks while browser-compatible operations remain client-side.
