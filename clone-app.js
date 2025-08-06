// Enhanced Website Cloner - AI-powered React app generator
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import cheerio from 'cheerio';
import OpenAI from 'openai';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Enhanced logging
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m'
  };
  console.log(`${colors[type]}[${timestamp}] ${message}\x1b[0m`);
}

// 1) Fetch HTML with better error handling
async function fetchHtml(url) {
  try {
    log(`Fetching HTML from: ${url}`);
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    log('HTML fetched successfully', 'success');
    return response.data;
  } catch (error) {
    log(`Failed to fetch HTML: ${error.message}`, 'error');
    throw error;
  }
}

// 2) Enhanced asset scraping with filtering
function scrapeAssets(html, baseUrl) {
  try {
    log('Scraping assets from HTML...');
    const $ = cheerio.load(html);
    const assets = new Set();
    
    // CSS files
    $('link[rel="stylesheet"], link[href$=".css"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        try {
          assets.add(new URL(href, baseUrl).toString());
        } catch (e) {
          log(`Invalid CSS URL: ${href}`, 'warning');
        }
      }
    });
    
    // JavaScript files
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('google-analytics') && !src.includes('gtag')) {
        try {
          assets.add(new URL(src, baseUrl).toString());
        } catch (e) {
          log(`Invalid JS URL: ${src}`, 'warning');
        }
      }
    });
    
    // Images
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        try {
          const url = new URL(src, baseUrl).toString();
          // Only include reasonable sized images
          if (!src.includes('1x1') && !src.includes('tracking')) {
            assets.add(url);
          }
        } catch (e) {
          log(`Invalid image URL: ${src}`, 'warning');
        }
      }
    });
    
    const assetArray = Array.from(assets);
    log(`Found ${assetArray.length} assets`, 'success');
    return assetArray;
  } catch (error) {
    log(`Error scraping assets: ${error.message}`, 'error');
    return [];
  }
}

// 3) Enhanced asset download with better error handling
async function downloadAssets(assets, outDir) {
  try {
    await fs.ensureDir(outDir);
    log(`Downloading ${assets.length} assets...`);
    
    const downloadPromises = assets.map(async (url, index) => {
      try {
        const urlObj = new URL(url);
        const fileName = path.basename(urlObj.pathname) || `asset-${index}`;
        const filePath = path.join(outDir, fileName);
        
        const response = await axios.get(url, { 
          responseType: 'stream',
          timeout: 5000,
          maxContentLength: 10 * 1024 * 1024 // 10MB limit
        });
        
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        
        return fileName;
      } catch (error) {
        log(`Failed to download ${url}: ${error.message}`, 'warning');
        return null;
      }
    });
    
    const results = await Promise.all(downloadPromises);
    const successCount = results.filter(Boolean).length;
    log(`Downloaded ${successCount}/${assets.length} assets`, 'success');
    return results.filter(Boolean);
  } catch (error) {
    log(`Error downloading assets: ${error.message}`, 'error');
    return [];
  }
}

// 4) Enhanced AI component inference
async function inferComponents(html) {
  try {
    log('Analyzing HTML structure with AI...');
    
    // Clean and truncate HTML for better processing
    const $ = cheerio.load(html);
    $('script, style, noscript').remove();
    const cleanHtml = $('body').html() || html;
    const truncatedHtml = cleanHtml.substring(0, 8000); // Limit for token usage
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'system',
        content: `You are an expert React developer. Convert HTML to a JSON structure representing React components. 
        
Rules:
- Use semantic component names (Header, Navigation, Hero, Card, etc.)
- Extract text content into "content" props
- Preserve important className attributes
- Simplify complex nested structures
- Output only valid JSON array`
      }, {
        role: 'user',
        content: `Convert this HTML to React component JSON:

${truncatedHtml}

Example output format:
[
  {
    "type": "Header",
    "props": { "className": "header" },
    "children": [
      { "type": "Navigation", "props": { "className": "nav" }, "children": [] }
    ]
  }
]`
      }],
      max_tokens: 2000,
      temperature: 0.2
    });
    
    const content = response.choices[0].message.content;
    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error('No valid JSON found in AI response');
    }
    
    const jsonContent = content.substring(jsonStart, jsonEnd);
    const components = JSON.parse(jsonContent);
    
    log('AI component analysis complete', 'success');
    return Array.isArray(components) ? components : [components];
  } catch (error) {
    log(`AI inference failed: ${error.message}`, 'error');
    // Fallback to simple structure
    return [{
      type: 'div',
      props: { className: 'container' },
      children: [
        { type: 'h1', props: { content: 'Cloned Website' } },
        { type: 'p', props: { content: 'AI processing failed, showing fallback content.' } }
      ]
    }];
  }
}

// 5) Enhanced React app scaffolding
async function scaffoldReactApp(tree, outDir) {
  try {
    log('Scaffolding React application...');
    
    const srcDir = path.join(outDir, 'src');
    await fs.ensureDir(srcDir);
    
    // Enhanced index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloned Website</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
      .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/index.jsx"></script>
  </body>
</html>`;
    
    await fs.writeFile(path.join(outDir, 'index.html'), indexHtml);
    
    // Enhanced App component
    const componentsCode = tree.map(node => renderNode(node, 0)).join('\\n      ');
    
    const appJsx = `import React from 'react';
import { createRoot } from 'react-dom/client';

// Auto-generated components from cloned website
function ClonedApp() {
  return (
    <div className="cloned-app">
      ${componentsCode}
    </div>
  );
}

// Initialize React app
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<ClonedApp />);`;
    
    await fs.writeFile(path.join(srcDir, 'index.jsx'), appJsx);
    
    // Package.json for the generated app
    const packageJson = {
      name: 'cloned-website',
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview'
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.0.0',
        vite: '^4.4.0'
      }
    };
    
    await fs.writeFile(path.join(outDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    // Vite config
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
})`;
    
    await fs.writeFile(path.join(outDir, 'vite.config.js'), viteConfig);
    
    log('React app scaffolded successfully', 'success');
  } catch (error) {
    log(`Error scaffolding React app: ${error.message}`, 'error');
    throw error;
  }
}

// Enhanced node rendering with better formatting
function renderNode(node, depth = 0) {
  if (!node || typeof node !== 'object') {
    return '';
  }
  
  const { type, props = {}, children = [] } = node;
  const indent = '  '.repeat(depth);
  
  // Build props string
  const propEntries = Object.entries(props);
  const propStr = propEntries.length > 0 
    ? ' ' + propEntries
        .filter(([key]) => key !== 'content')
        .map(([key, value]) => {
          if (typeof value === 'string') {
            return `${key}="${value.replace(/"/g, '&quot;')}"`;
          }
          return `${key}={${JSON.stringify(value)}}`;
        })
        .join(' ')
    : '';
  
  // Handle self-closing tags
  const selfClosing = ['img', 'br', 'hr', 'input'];
  const isSelfClosing = selfClosing.includes(type.toLowerCase());
  
  if (isSelfClosing) {
    return `${indent}<${type}${propStr} />`;
  }
  
  // Handle content and children
  const content = props.content || '';
  const childrenCode = children
    .map(child => renderNode(child, depth + 1))
    .filter(Boolean)
    .join('\\n');
  
  const hasContent = content || childrenCode;
  
  if (!hasContent) {
    return `${indent}<${type}${propStr} />`;
  }
  
  const innerContent = content + (childrenCode ? '\\n' + childrenCode + '\\n' + indent : '');
  return `${indent}<${type}${propStr}>${innerContent}</${type}>`;
}

// 6) Enhanced folder zipping
async function zipFolder(sourceDir, outPath) {
  try {
    log('Creating zip archive...');
    
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', () => {
        log(`Archive created: ${archive.pointer()} bytes`, 'success');
        resolve();
      });
      
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
    
    return outPath;
  } catch (error) {
    log(`Error creating zip: ${error.message}`, 'error');
    throw error;
  }
}

// Enhanced orchestrator with better error handling
async function cloneUrl(url) {
  const startTime = Date.now();
  
  try {
    log(`🚀 Starting website clone process for: ${url}`);
    
    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL provided');
    }
    
    // Setup directories
    const tmpDir = path.join(__dirname, 'tmp');
    const assetsDir = path.join(tmpDir, 'assets');
    const reactDir = path.join(tmpDir, 'react-app');
    
    await fs.remove(tmpDir); // Clean start
    await fs.ensureDir(tmpDir);
    
    // Step 1: Fetch HTML
    const html = await fetchHtml(url);
    
    // Step 2: Scrape and download assets
    const assets = scrapeAssets(html, url);
    await downloadAssets(assets, assetsDir);
    
    // Step 3: AI analysis
    const componentTree = await inferComponents(html);
    
    // Step 4: Scaffold React app
    await scaffoldReactApp(componentTree, reactDir);
    
    // Step 5: Create zip
    const zipPath = path.join(__dirname, `clone-${Date.now()}.zip`);
    await zipFolder(reactDir, zipPath);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`✅ Clone completed in ${duration}s: ${zipPath}`, 'success');
    
    // Cleanup
    await fs.remove(tmpDir);
    
    return zipPath;
  } catch (error) {
    log(`❌ Clone failed: ${error.message}`, 'error');
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const url = args[0];
  
  if (!url) {
    console.log(`
🤖 AI Website Cloner

Usage: node clone-app.js <url>

Example: node clone-app.js https://example.com

Requirements:
- Set OPENAI_API_KEY environment variable
- Run 'npm install' to install dependencies
    `);
    process.exit(1);
  }
  
  if (!process.env.OPENAI_API_KEY) {
    log('❌ OPENAI_API_KEY environment variable not set', 'error');
    process.exit(1);
  }
  
  try {
    await cloneUrl(url);
  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Export for programmatic use
export { cloneUrl, fetchHtml, scrapeAssets, inferComponents };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}