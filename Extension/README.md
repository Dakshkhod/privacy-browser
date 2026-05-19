# Poliscope - Chrome Extension 🛡️

A Chrome Side Panel extension for AI-powered privacy policy analysis.

## ✨ Features

- **Side Panel UI** - Persistent panel for easy access while browsing
- **Current Tab Detection** - Automatically detects the current website URL
- **Manual Analysis** - Click to analyze when you want (not automatic)
- **All Web App Features**:
  - Risk level scoring with color coding
  - Data collection breakdown with interactive chart
  - Dark patterns detection
  - User rights information
  - Safer alternatives suggestions
  - Smart error handling with suggestions

## 🚀 Installation

### Step 1: Add Icons (Required)

Before loading the extension, you need to add PNG icons to the `icons/` folder:

1. Create or obtain PNG icons in these sizes:
   - `icon16.png` (16×16 pixels)
   - `icon32.png` (32×32 pixels)
   - `icon48.png` (48×48 pixels)
   - `icon128.png` (128×128 pixels)

2. Place them in the `Extension/icons/` directory

> **Quick Option**: You can temporarily rename any of the `.svg` files to `.png` or use online tools to convert them.

### Step 2: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `Extension` folder from this project
5. The Poliscope icon should appear in your toolbar

### Step 3: Using the Extension

1. Navigate to any website
2. Click the Poliscope icon in your toolbar
3. The side panel will open with the current website URL pre-filled
4. Click **"Analyze Privacy Policy"** to start the analysis
5. View the comprehensive privacy analysis results

## 📁 File Structure

```
Extension/
├── manifest.json        # Extension configuration (Manifest V3)
├── background.js        # Service worker for side panel
├── sidepanel.html       # Main UI structure
├── sidepanel.js         # Application logic
├── sidepanel.css        # Styles
├── icons/               # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            # This file
```

## 🔧 Configuration

The extension connects to the Poliscope backend. By default, it uses:

```javascript
BACKEND_URL: 'https://privacybrowser-backend.onrender.com'
```

For local development, edit `sidepanel.js` and change:
```javascript
const BACKEND_URL = config.DEV_BACKEND_URL; // http://localhost:5001
```

## 🔒 Permissions

The extension requires these permissions:

- **activeTab**: Read current tab URL
- **sidePanel**: Display the side panel
- **tabs**: Listen for tab changes
- **host_permissions**: Connect to backend API

## 🐛 Troubleshooting

### Extension icon doesn't appear
- Make sure Developer mode is enabled
- Try reloading the extension

### Side panel doesn't open
- Check that the icons exist in the `icons/` folder
- Reload the extension from `chrome://extensions`

### Analysis fails
- Ensure your backend is running (locally or on Render)
- Check the browser console for errors
- Try the web version to verify backend connectivity

### Charts don't appear
- The extension uses Chart.js from CDN
- Ensure you have internet connectivity

## 📊 API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `POST /fetch-privacy-policy` | Discover and fetch policy from website |
| `POST /analyze-direct-policy` | Analyze direct policy URL |
| `POST /analyze-policy` | Analyze provided policy text |

## 🎨 Customization

### Changing Colors
Edit `sidepanel.css` and modify the CSS variables and gradient colors.

### Modifying Backend URL
Edit `sidepanel.js` at the top of the file in the `config` object.

## 📝 Version History

- **v1.0.0** - Initial release with side panel support

---

Made with ❤️ for privacy awareness
