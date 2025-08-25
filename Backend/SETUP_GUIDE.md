# PrivacyLens Setup Guide

## 🚀 Quick Start (No API Key Required)

The tool works immediately without any setup! It provides intelligent, privacy-focused alternatives using a curated database.

## 🤖 Enhanced AI-Powered Alternatives (Optional)

To enable ChatGPT-powered alternative suggestions for all users, you can set up a centralized API key:

### Option 1: Environment Variable (Recommended)

1. Get an OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Set the environment variable:
   ```bash
   export CENTRALIZED_OPENAI_API_KEY="your-openai-api-key-here"
   ```

### Option 2: .env File

Create a `.env` file in the Backend directory:
```env
CENTRALIZED_OPENAI_API_KEY=your-openai-api-key-here
```

### Option 3: System Environment

On Windows:
```cmd
set CENTRALIZED_OPENAI_API_KEY=your-openai-api-key-here
```

On macOS/Linux:
```bash
export CENTRALIZED_OPENAI_API_KEY="your-openai-api-key-here"
```

## 🔧 How It Works

### Without API Key (Default)
- Uses enhanced built-in alternatives database
- Provides 5+ curated privacy-focused alternatives per service type
- Context-aware suggestions based on website type and risk level
- No external dependencies or costs

### With Centralized API Key
- Automatically uses ChatGPT for intelligent suggestions
- Falls back to built-in alternatives if API fails
- Provides personalized reasoning and recommendations
- Enhanced alternative discovery

## 📊 Service Types Supported

The tool automatically detects and provides alternatives for:

- **Social Media Platforms** (Facebook, Twitter, Instagram, etc.)
- **Messaging Services** (WhatsApp, Telegram, etc.)
- **Email Services** (Gmail, Outlook, etc.)
- **E-commerce Platforms** (Amazon, eBay, etc.)
- **Cloud Storage** (Google Drive, Dropbox, etc.)
- **Search Engines** (Google, Bing, etc.)
- **Video Streaming** (YouTube, Netflix, etc.)
- **Financial Services** (PayPal, banks, etc.)
- **News/Media Services** (various news sites)

## 🛡️ Privacy Benefits

### Built-in Alternatives Include:
- **Signal** - End-to-end encrypted messaging
- **ProtonMail** - Zero-access encrypted email
- **DuckDuckGo** - Privacy-focused search
- **Mastodon** - Decentralized social network
- **Nextcloud** - Self-hosted cloud storage
- **And many more...**

### Key Features:
- No tracking or data collection
- Open source alternatives
- Community-driven platforms
- Ethical business practices
- User-controlled data

## 🚀 Running the Application

1. **Backend:**
   ```bash
   cd Backend
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Frontend:**
   ```bash
   cd Frontend
   npm install
   npm run dev
   ```

3. **Access the application at:** `http://localhost:5173`

## 💡 Tips

- The tool works perfectly without any API keys
- Centralized API key is optional and enhances the experience
- All alternatives are hand-curated and privacy-focused
- Suggestions are context-aware and risk-level specific
- Direct links to alternative services are provided

## 🔒 Security Notes

- API keys are encrypted and securely stored
- No user data is collected or stored
- All analysis is performed locally
- Privacy-focused by design

## 🆘 Troubleshooting

### If alternatives don't appear:
1. Check that the server is running
2. Verify the URL format is correct
3. Try refreshing the page

### If ChatGPT suggestions don't work:
1. Verify the API key is set correctly
2. Check OpenAI API quota/limits
3. Built-in alternatives will still work

### For API key issues:
1. Ensure the key starts with `sk-`
2. Check OpenAI account status
3. Verify billing is set up (if required)

---

**The tool is designed to work seamlessly with or without API keys, providing valuable privacy insights and alternatives in all cases!** 🛡️✨ 