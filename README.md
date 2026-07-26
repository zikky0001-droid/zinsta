# Instagram DP Viewer API

Fetch Instagram profile pictures using Playwright automation.

## Deployment on Render

1. Fork this repository
2. Go to [Render](https://render.com)
3. Click "New +" → "Web Service"
4. Connect your GitHub repo
5. Use these settings:
   - Environment: Node
   - Build Command: `npm install && npx playwright install chromium`
   - Start Command: `node server.js`
6. Click "Create Web Service"

## API Usage

```

GET https://your-app.onrender.com/api/dp/:username

```

### Example

```bash
curl https://your-app.onrender.com/api/dp/devzikky
```

Response

```json
{
  "success": true,
  "username": "devzikky",
  "profile_picture": {
    "url": "https://...",
    "source": "indown.io"
  }
}
```

Local Development

```bash
npm install
npx playwright install chromium
node server.js
```

Visit http://localhost:3000

```

## Deployment Instructions for Render

### Option 1: Deploy via GitHub (Recommended)

1. **Create a GitHub repository** with all these files
2. **Go to [Render.com](https://render.com)** and sign up/sign in
3. **Click "New +" → "Web Service"**
4. **Connect your GitHub account** and select the repository
5. **Configure the service:**
   - Name: `instagram-dp-viewer` (or your choice)
   - Environment: `Node`
   - Build Command: `npm install && npx playwright install chromium`
   - Start Command: `node server.js`
6. **Click "Create Web Service"**

### Option 2: Deploy using Docker

1. **Build the image:**
```bash
docker build -t instagram-dp-viewer .
```

2. Run locally:

```bash
docker run -p 3000:3000 instagram-dp-viewer
```

3. Deploy on Render:
   · Choose "Docker" as the environment
   · Connect your GitHub repo with the Dockerfile

Option 3: Manual Upload

1. Zip all files (excluding node_modules)
2. On Render:
   · Click "New +" → "Web Service"
   · Choose "Deploy from a Git repository" or "Upload"
   · Upload your zip file
   · Configure as above
   