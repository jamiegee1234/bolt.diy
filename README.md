# 🤖 AI Website Cloner

A powerful Node.js application that uses AI to clone any website into a React application. Similar to bolt.new, Loveable AI, or Agent 44, this tool analyzes website structure and generates a complete React scaffold.

## ✨ Features

- **AI-Powered Analysis**: Uses OpenAI GPT to intelligently convert HTML to React components
- **Asset Collection**: Automatically downloads CSS, JS, and images from the source website
- **Modern React Scaffold**: Generates a complete React application with Vite
- **Error Handling**: Robust error handling and validation throughout the process
- **Clean Output**: Creates a zip file with a ready-to-run React application

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- OpenAI API key

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set your OpenAI API key:
   ```bash
   # On Windows
   set OPENAI_API_KEY=your_api_key_here
   
   # On macOS/Linux
   export OPENAI_API_KEY=your_api_key_here
   ```

### Usage

```bash
node clone-app.js https://example.com
```

This will:
1. Fetch the website HTML
2. Download all assets (CSS, JS, images)
3. Use AI to analyze the structure
4. Generate a React application
5. Create a zip file with the complete project

## 📁 Generated Project Structure

```
cloned-website/
├── index.html          # Main HTML file
├── package.json        # Dependencies and scripts
├── vite.config.js      # Vite configuration
└── src/
    └── index.jsx       # React application entry point
```

## 🔧 Configuration

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `OPENAI_ORG_ID`: Your OpenAI organization ID (optional)

### Customization

You can modify the AI prompt in the `inferComponents` function to change how the AI interprets the HTML structure.

## 🛠️ Development

### Running the Generated App

1. Extract the generated zip file
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

### Building for Production

```bash
npm run build
```

## 🔍 How It Works

1. **HTML Fetching**: Downloads the target website's HTML
2. **Asset Scraping**: Extracts all CSS, JavaScript, and image URLs
3. **Asset Download**: Downloads all assets to a local directory
4. **AI Analysis**: Uses OpenAI to convert HTML structure to React components
5. **React Scaffolding**: Generates a complete React application
6. **Packaging**: Creates a zip file with the final project

## 🎯 Example Output

The AI will convert HTML like this:
```html
<header class="main-header">
  <nav class="navigation">
    <a href="/">Home</a>
  </nav>
</header>
```

Into React components like this:
```jsx
<Header className="main-header">
  <Navigation className="navigation">
    <a href="/">Home</a>
  </Navigation>
</Header>
```

## ⚠️ Limitations

- Large websites may hit API token limits
- Complex JavaScript functionality won't be preserved
- Some dynamic content may not be captured
- Requires OpenAI API credits

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT License - feel free to use this project for any purpose.

---

**Note**: This tool is for educational and development purposes. Always respect website terms of service and robots.txt when scraping websites.
