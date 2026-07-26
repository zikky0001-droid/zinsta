const express = require('express');
const { chromium } = require('playwright');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Main endpoint to get profile picture
app.get('/api/dp/:username', async (req, res) => {
    const { username } = req.params;
    
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    let browser = null;
    
    try {
        console.log(`Fetching profile picture for: ${username}`);
        
        // Launch browser with render-compatible settings
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        const page = await context.newPage();
        
        // Navigate to indown.io
        await page.goto('https://indown.io/insta-dp-viewer', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        // Wait for and fill the username input
        await page.waitForSelector('input[type="text"], input[placeholder*="username"], input[name="username"]', {
            timeout: 10000
        });

        // Find the input field and fill it
        const inputSelector = 'input[type="text"], input[placeholder*="username"], input[name="username"]';
        await page.fill(inputSelector, username);

        // Find and click the submit button
        const buttonSelectors = [
            'button[type="submit"]',
            'button:has-text("View")',
            'button:has-text("Download")',
            'button:has-text("Get")',
            'button:has-text("Search")'
        ];

        let buttonClicked = false;
        for (const selector of buttonSelectors) {
            try {
                await page.click(selector, { timeout: 5000 });
                buttonClicked = true;
                break;
            } catch (e) {
                // Continue to next selector
            }
        }

        if (!buttonClicked) {
            throw new Error('Could not find submit button');
        }

        // Wait for results to load
        await page.waitForTimeout(3000);
        await page.waitForSelector('img[src*="instagram"], img[src*="cdn"], .profile-pic img, .dp-image img', {
            timeout: 15000
        });

        // Extract all images
        const images = await page.evaluate(() => {
            const imgs = document.querySelectorAll('img');
            const imageUrls = [];
            
            imgs.forEach(img => {
                const src = img.getAttribute('src');
                if (src && 
                    (src.includes('instagram') || 
                     src.includes('cdn') || 
                     src.includes('profile') ||
                     src.includes('dp') ||
                     src.includes('avatar') ||
                     img.className.includes('profile') ||
                     img.className.includes('dp') ||
                     img.className.includes('avatar'))) {
                    imageUrls.push({
                        url: src,
                        alt: img.getAttribute('alt') || 'Profile picture',
                        width: img.width || 0,
                        height: img.height || 0
                    });
                }
            });
            
            return imageUrls;
        });

        // Also try to get the profile picture URL from the indown.io API
        const pageContent = await page.content();
        const imageMatches = pageContent.match(/https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)[^\s<>"']*/gi);
        
        const allImages = [...new Set(imageMatches || [])];
        
        // Filter for Instagram-related images
        const instagramImages = allImages.filter(url => 
            url.includes('instagram') || 
            url.includes('cdninstagram') ||
            url.includes('fbcdn') ||
            url.includes('scontent')
        );

        const result = {
            success: true,
            username: username,
            images: {
                found: images.length > 0 ? images : instagramImages.map(url => ({ url })),
                raw: instagramImages.slice(0, 10) // Limit to 10 images
            },
            profile_picture: instagramImages.length > 0 ? {
                url: instagramImages[0],
                source: 'indown.io'
            } : null
        };

        // Try to find the main profile picture using common selectors
        const mainPic = await page.evaluate(() => {
            const selectors = [
                '.profile-pic img',
                '.dp-image img',
                '.profile-image img',
                '.avatar img',
                'img[alt*="profile"]',
                'img[alt*="avatar"]',
                'img[alt*="dp"]',
                'img[class*="profile"]',
                'img[class*="dp"]',
                'img[class*="avatar"]'
            ];
            
            for (const selector of selectors) {
                const img = document.querySelector(selector);
                if (img && img.src) {
                    return img.src;
                }
            }
            return null;
        });

        if (mainPic) {
            result.profile_picture = {
                url: mainPic,
                source: 'direct_selector'
            };
        }

        console.log(`Successfully fetched data for ${username}`);
        res.json(result);

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            username: username
        });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

// Simple health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint with instructions
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Instagram DP Viewer API</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    max-width: 800px;
                    margin: 50px auto;
                    padding: 20px;
                    line-height: 1.6;
                    color: #333;
                }
                h1 { color: #E4405F; }
                .endpoint {
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                code {
                    background: #e8e8e8;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: 'Courier New', monospace;
                }
                .example {
                    background: #fff3f5;
                    padding: 15px;
                    border-radius: 8px;
                    border-left: 4px solid #E4405F;
                }
                .footer {
                    margin-top: 40px;
                    color: #888;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <h1>📸 Instagram DP Viewer API</h1>
            <p>Fetch Instagram profile pictures using Playwright automation.</p>
            
            <div class="endpoint">
                <h3>📌 Endpoint</h3>
                <code>GET /api/dp/:username</code>
            </div>
            
            <div class="example">
                <h3>🔍 Example</h3>
                <p>Get profile picture for username <strong>devzikky</strong>:</p>
                <code>https://your-app.onrender.com/api/dp/devzikky</code>
                <br><br>
                <a href="/api/dp/devzikky" target="_blank">▶ Try it now</a>
            </div>
            
            <div class="endpoint">
                <h3>📊 Response Format</h3>
                <pre style="background: #f8f8f8; padding: 15px; border-radius: 4px; overflow-x: auto;">
{
  "success": true,
  "username": "devzikky",
  "profile_picture": {
    "url": "https://...",
    "source": "indown.io"
  },
  "images": {
    "found": [...],
    "raw": [...]
  }
}</pre>
            </div>
            
            <div class="footer">
                Powered by Playwright + Chromium | Deployed on Render
            </div>
        </body>
        </html>
    `);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📸 Instagram DP Viewer API ready`);
    console.log(`🌐 http://localhost:${PORT}`);
});

