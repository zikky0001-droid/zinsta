/**
 * Instagram Stalk API - Hosted on Render
 * Provides reliable Instagram user data with fallback APIs
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());

// ============================================
// LOGGING (Minimal)
// ============================================
const log = (msg) => {
    console.log(`[${new Date().toISOString()}] ${msg}`);
};

// ============================================
// CACHE (In-memory, 24-hour expiry)
// ============================================
const cache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// ============================================
// FORMAT FUNCTIONS
// ============================================
function formatNumber(num) {
    if (!num) return '0';
    const number = parseInt(num);
    if (isNaN(number)) return '0';
    if (number >= 1000000000000) return (number / 1000000000000).toFixed(1) + 'T';
    if (number >= 1000000000) return (number / 1000000000).toFixed(1) + 'B';
    if (number >= 1000000) return (number / 1000000).toFixed(1) + 'M';
    if (number >= 1000) return (number / 1000).toFixed(1) + 'K';
    return number.toString();
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    if (diff < 2592000000) return Math.floor(diff / 604800000) + 'w ago';
    return date.toLocaleDateString();
}

// ============================================
// API 1: Vreden (Primary - Most Reliable)
// ============================================
async function fetchFromVreden(username) {
    log(`🔍 Trying Vreden API for: ${username}`);
    try {
        const response = await axios.get(
            `https://api.vreden.my.id/api/v1/stalker/instagram?username=${encodeURIComponent(username)}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                },
                timeout: 15000
            }
        );
        
        if (response.data?.status && response.data?.result) {
            const result = response.data.result;
            log(`✅ Vreden API success for: ${username}`);
            
            let postsData = [];
            if (result.statistics?.media) {
                postsData = result.statistics.media.slice(0, 5).map((post, i) => ({
                    id: i,
                    shortcode: post.code || 'unknown',
                    type: 'Image',
                    isVideo: false,
                    caption: post.caption || '',
                    likes: post.like_count || 0,
                    comments: post.comment_count || 0,
                    views: null,
                    thumbnail: post.display_url || '',
                    video: null,
                    timestamp: post.taken_at || Math.floor(Date.now() / 1000),
                    timestampFormatted: post.taken_at ? formatTimestamp(post.taken_at) : 'Unknown'
                }));
            }
            
            return {
                success: true,
                source: 'vreden',
                data: {
                    id: result.id || username,
                    username: username,
                    fullName: result.full_name || username,
                    biography: result.biography || '',
                    followers: result.statistics?.follower || 0,
                    following: result.statistics?.following || 0,
                    posts: result.statistics?.post || 0,
                    highlights: 0,
                    verified: result.is_verified || false,
                    private: result.is_private || false,
                    professional: false,
                    business: false,
                    category: '',
                    externalUrl: result.external_url || '',
                    profilePic: result.profile_pic_hd?.url || result.profile_pic || '',
                    postsData: postsData
                }
            };
        }
        return null;
    } catch (error) {
        log(`❌ Vreden API error: ${error.message}`);
        return null;
    }
}

// ============================================
// API 2: NexRay (Secondary)
// ============================================
async function fetchFromNexRay(username) {
    log(`🔍 Trying NexRay API for: ${username}`);
    try {
        const response = await axios.get(
            `https://api.nexray.web.id/stalker/instagram?username=${encodeURIComponent(username)}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                },
                timeout: 15000
            }
        );
        
        if (response.data?.status && response.data?.result) {
            const result = response.data.result;
            log(`✅ NexRay API success for: ${username}`);
            
            let postsData = [];
            if (result.posts && result.posts.length > 0) {
                postsData = result.posts.slice(0, 5).map((post) => ({
                    id: post.id || 'unknown',
                    shortcode: post.code || 'unknown',
                    type: post.type || 'Image',
                    isVideo: post.type === 'Video',
                    caption: post.caption || '',
                    likes: post.likes || 0,
                    comments: post.comments || 0,
                    views: post.views || null,
                    thumbnail: post.thumbnail || post.display_url || '',
                    video: post.video_url || null,
                    timestamp: post.taken_at || Math.floor(Date.now() / 1000),
                    timestampFormatted: post.taken_at ? formatTimestamp(post.taken_at) : 'Unknown'
                }));
            }
            
            return {
                success: true,
                source: 'nexray',
                data: {
                    id: result.id || username,
                    username: result.username || username,
                    fullName: result.full_name || username,
                    biography: result.biography || '',
                    followers: result.followers_count || 0,
                    following: result.following_count || 0,
                    posts: result.posts_count || 0,
                    highlights: 0,
                    verified: result.is_verified || false,
                    private: result.is_private || false,
                    professional: result.is_business_account || false,
                    business: result.is_business_account || false,
                    category: result.category_name || '',
                    externalUrl: result.external_url || '',
                    profilePic: result.profile_pic_url || '',
                    postsData: postsData
                }
            };
        }
        return null;
    } catch (error) {
        log(`❌ NexRay API error: ${error.message}`);
        return null;
    }
}

// ============================================
// API 3: Direct Instagram (Fallback)
// ============================================
async function fetchDirectInstagram(username) {
    log(`🔍 Trying direct Instagram API for: ${username}`);
    try {
        const response = await axios.get(
            'https://www.instagram.com/api/v1/users/web_profile_info/',
            {
                params: { username },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'X-IG-App-ID': '936619743392459',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Referer': 'https://www.instagram.com/',
                    'Origin': 'https://www.instagram.com',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-site',
                    'Connection': 'keep-alive'
                },
                timeout: 30000
            }
        );

        if (!response.data?.data?.user) {
            log(`❌ Direct Instagram: User not found: ${username}`);
            return null;
        }

        const user = response.data.data.user;
        log(`✅ Direct Instagram success for: ${username}`);
        
        const posts = user.edge_owner_to_timeline_media?.edges?.map(({ node }) => ({
            id: node.id,
            shortcode: node.shortcode,
            type: node.__typename,
            isVideo: node.is_video || false,
            caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
            likes: node.edge_liked_by?.count || 0,
            comments: node.edge_media_to_comment?.count || 0,
            views: node.video_view_count || null,
            thumbnail: node.display_url,
            video: node.video_url || null,
            timestamp: node.taken_at_timestamp,
            timestampFormatted: formatTimestamp(node.taken_at_timestamp)
        })) || [];

        return {
            success: true,
            source: 'direct',
            data: {
                id: user.id,
                username: user.username,
                fullName: user.full_name || user.username,
                biography: user.biography || '',
                followers: user.edge_followed_by?.count || 0,
                following: user.edge_follow?.count || 0,
                posts: user.edge_owner_to_timeline_media?.count || 0,
                highlights: user.highlight_reel_count || 0,
                verified: user.is_verified || false,
                private: user.is_private || false,
                professional: user.is_professional_account || false,
                business: user.is_business_account || false,
                category: user.category_name || '',
                externalUrl: user.external_url || '',
                profilePic: user.profile_pic_url_hd || user.profile_pic_url || '',
                postsData: posts.slice(0, 5)
            }
        };

    } catch (error) {
        if (error.response?.status === 429) {
            log(`❌ Direct Instagram: Rate limited (429)`);
        } else if (error.response?.status === 404) {
            log(`❌ Direct Instagram: User not found (404)`);
        } else {
            log(`❌ Direct Instagram error: ${error.message}`);
        }
        return null;
    }
}

// ============================================
// MAIN STALK FUNCTION
// ============================================
async function stalkInstagram(username) {
    // Check cache first
    const cacheKey = username.toLowerCase();
    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            log(`📦 Cache hit for: ${username}`);
            return { ...cached.data, cached: true };
        } else {
            cache.delete(cacheKey);
        }
    }

    log(`🔍 Fetching Instagram user: ${username}`);

    // Try APIs in order
    const apis = [
        { fn: fetchFromVreden, name: 'Vreden' },
        { fn: fetchFromNexRay, name: 'NexRay' },
        { fn: fetchDirectInstagram, name: 'Direct' }
    ];

    for (const api of apis) {
        const result = await api.fn(username);
        if (result && result.success) {
            // Cache the result
            cache.set(cacheKey, {
                timestamp: Date.now(),
                data: result
            });
            log(`✅ Success via ${api.name} API for: ${username}`);
            return result;
        }
    }

    log(`❌ All APIs failed for: ${username}`);
    return {
        success: false,
        error: 'All APIs failed. Please try again later.'
    };
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Instagram Stalk API is running',
        endpoints: [
            '/stalk/:username',
            '/stalk/:username?format=whatsapp'
        ]
    });
});

// Stalk endpoint
app.get('/stalk/:username', async (req, res) => {
    const { username } = req.params;
    const { format } = req.query;
    
    if (!username) {
        return res.status(400).json({
            success: false,
            error: 'Username is required'
        });
    }

    log(`📥 Request for: ${username} (format: ${format || 'json'})`);

    const result = await stalkInstagram(username);

    if (!result.success) {
        return res.status(404).json(result);
    }

    // Return raw data
    if (format === 'raw' || format === 'json') {
        return res.json(result);
    }

    // Return formatted WhatsApp message
    if (format === 'whatsapp') {
        const data = result.data;
        const message = formatWhatsAppResponse(data);
        return res.json({
            success: true,
            source: result.source,
            cached: result.cached || false,
            formatted: message
        });
    }

    // Default: return full data
    return res.json(result);
});

// ============================================
// WHATSAPP FORMATTING
// ============================================
function formatWhatsAppResponse(data) {
    const username = data.username;
    const fullName = data.fullName || username;
    const bio = data.biography || 'No bio';
    const followers = formatNumber(data.followers);
    const following = formatNumber(data.following);
    const posts = formatNumber(data.posts);
    
    const verified = data.verified ? '✅ Yes' : '❌ No';
    const privateAccount = data.private ? '🔒 Yes' : '🔓 No';
    const business = data.business ? '✅' : '❌';

    const bioDisplay = bio.length > 150 ? bio.substring(0, 150) + '...' : bio;

    let message = `╭━━━༺ *📸 INSTAGRAM USER INFO* ༻━━━╮\n`;
    message += `┃\n`;
    message += `┃ 👤 *Username:* @${username}\n`;
    message += `┃ 📛 *Full Name:* ${fullName}\n`;
    message += `┃\n`;
    message += `┃ 📝 *Bio:*\n`;
    message += `┃ ${bioDisplay}\n`;

    if (data.externalUrl) {
        message += `┃\n┃ 🌐 *Website:*\n┃ ${data.externalUrl}\n`;
    }

    if (data.category) {
        message += `┃\n┃ 🏷️ *Category:* ${data.category}\n`;
    }

    message += `┃\n`;
    message += `┃ 📊 *Stats:*\n`;
    message += `┃    👥 *Followers:* ${followers}\n`;
    message += `┃    🔄 *Following:* ${following}\n`;
    message += `┃    📸 *Posts:* ${posts}\n`;
    message += `┃\n`;
    message += `┃ 🔰 *Verified:* ${verified}\n`;
    message += `┃ 🔒 *Private:* ${privateAccount}\n`;
    message += `┃ 💼 *Business:* ${business}\n`;
    message += `┃\n`;

    if (data.postsData && data.postsData.length > 0) {
        message += `┃ 📷 *Latest Posts:*\n`;
        data.postsData.slice(0, 3).forEach((post, i) => {
            const type = post.isVideo ? '🎥' : '🖼️';
            const likes = formatNumber(post.likes);
            const comments = formatNumber(post.comments);
            const time = post.timestampFormatted || 'Unknown';
            message += `┃    ${i + 1}. ${type} ${post.shortcode}\n`;
            message += `┃       ❤️ ${likes} | 💬 ${comments} | ⏱️ ${time}\n`;
        });
        message += `┃\n`;
    }

    message += `┃ 🔗 *Profile:*\n`;
    message += `┃ https://instagram.com/${username}\n`;
    message += `╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
    message += `> *_Powered by ᴅᴇᴠ ᴢɪᴋᴋʏ ᴍᴅ_*`;

    return message;
}

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    log(`🚀 Instagram Stalk API running on port ${PORT}`);
    log(`📍 Health check: http://localhost:${PORT}/`);
    log(`📍 Example: http://localhost:${PORT}/stalk/devzikky`);
});

// Handle process termination
process.on('SIGTERM', () => {
    log('🛑 Received SIGTERM, shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    log('🛑 Received SIGINT, shutting down...');
    process.exit(0);
});


