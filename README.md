# QuickTools

QuickTools is a React and Vite website for everyday image, PDF, document, and text tasks.

## Live website

- Website: [https://quicktools-roan.vercel.app](https://quicktools-roan.vercel.app)
- Document conversion API: [https://quicktools-rmgf.onrender.com/api/health](https://quicktools-rmgf.onrender.com/api/health)

The website URL is the existing Vercel deployment. Redeploy the frontend and backend after making changes for them to appear on the live site.

## Available tools

The image tools support batch uploads and process files locally in the browser:

- Resize images by percentage or dimensions.
- Compress images to WebP with selectable compression levels.
- Crop images using a draggable crop area and common aspect ratios.
- Convert images to PNG, JPG, or WebP.
- Add a caption to images.
- Remove a plain background by color matching. This is not AI subject detection and works best with solid-color backgrounds.

Excel to PDF and PowerPoint to PDF support batch uploads. Documents are converted by the backend service and can be downloaded separately or as a ZIP.

## Run the frontend locally

Requirements: Node.js LTS and npm.

```bash
npm install
npm run dev
```

Open the local address printed by Vite, usually `http://localhost:5173`.

Create and preview a production build:

```bash
npm run build
npm run preview
```

## Run the backend locally

The Python backend requires Python 3.11 or newer. From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Set-Location backend
python app.py
```

The API will be available at `http://127.0.0.1:5000`. Office document conversion requires LibreOffice. The included backend Docker configuration installs LibreOffice for deployment.

To use the local API from the frontend, set `VITE_API_URL` before starting Vite:

```powershell
$env:VITE_API_URL = "http://127.0.0.1:5000"
npm run dev
```

If `VITE_API_URL` is not set, Office to PDF uses the deployed QuickTools API.

## Deploy updates

Deploy the backend before the frontend when a change adds or updates an API route.

### Backend (Render)

The existing backend is hosted at `https://quicktools-rmgf.onrender.com`.

1. Deploy the repository's `backend` service using the Docker runtime.
2. Configure the Dockerfile as `backend/Dockerfile.txt` (the repository currently uses this filename) and the Docker build context as `backend`.
3. Keep the service's health check at `/api/health`.
4. Confirm the health endpoint reports `"status": "ok"` after deployment.

LibreOffice is installed by the Docker image and is required for Excel and PowerPoint conversion.

### Frontend (Vercel)

The existing frontend is hosted at `https://quicktools-roan.vercel.app`.

1. Import or open the QuickTools repository in Vercel.
2. Use the Vite build command `npm run build` and output directory `dist`.
3. Set the environment variable `VITE_API_URL` to `https://quicktools-rmgf.onrender.com`.
4. Redeploy the frontend. The public website URL remains `https://quicktools-roan.vercel.app` unless its Vercel domain is changed.

If deploying the backend under a different domain, update the allowed frontend origins in `backend/app.py` before deploying it.

## File handling notes

- Image tools perform processing in the browser; selected images are not uploaded.
- Office documents are sent to the conversion backend to generate PDFs.
- Office conversions are limited to 50 MB per file. Image tools accept up to 20 files, each up to 25 MB and 25 megapixels.
