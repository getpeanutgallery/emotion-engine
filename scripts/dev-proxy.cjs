#!/usr/bin/env node
/**
 * Development Proxy Server
 * OpenTruth Emotion Engine — Prototype
 * 
 * This script downloads YouTube videos for local testing and serves them
 * to avoid browser CORS issues.
 * 
 * Prerequisites:
 *   npm install -g yt-dlp-wrap
 * 
 * Usage:
 *   node dev-proxy.js <youtube-url>
 *   node dev-proxy.js "https://youtu.be/9txkGBj_trg"
 * 
 * Then open http://localhost:8080 in your browser.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8080;
const VIDEO_DIR = path.join(__dirname, '.dev-cache');

// Ensure cache directory exists
if (!fs.existsSync(VIDEO_DIR)) {
    fs.mkdirSync(VIDEO_DIR, { recursive: true });
}

// Get YouTube URL from command line
const youtubeUrl = process.argv[2];

if (!youtubeUrl) {
    console.log('Usage: node dev-proxy.js <youtube-url>');
    console.log('Example: node dev-proxy.js "https://youtu.be/9txkGBj_trg"');
    process.exit(1);
}

// Video file path
const videoId = youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] || 'video';
const videoPath = path.join(VIDEO_DIR, `${videoId}.mp4`);

/**
 * Download video using yt-dlp
 */
async function downloadVideo() {
    console.log(`📥 Downloading video: ${youtubeUrl}`);
    console.log(`💾 Saving to: ${videoPath}`);
    
    return new Promise((resolve, reject) => {
        // Use yt-dlp to download (you need to have it installed)
        const ytdlp = spawn('yt-dlp', [
            '-f', 'bv*[height<=720]+ba/b[height<=720]',
            '--merge-output-format', 'mp4',
            '-o', videoPath,
            youtubeUrl
        ]);
        
        let output = '';
        let error = '';
        
        ytdlp.stdout.on('data', (data) => {
            output += data.toString();
            process.stdout.write(data);
        });
        
        ytdlp.stderr.on('data', (data) => {
            error += data.toString();
            process.stderr.write(data);
        });
        
        ytdlp.on('close', (code) => {
            if (code === 0) {
                console.log('\n✅ Download complete!');
                resolve();
            } else {
                reject(new Error(`yt-dlp exited with code ${code}\n${error}`));
            }
        });
    });
}

/**
 * Get video metadata
 */
async function getVideoInfo() {
    return new Promise((resolve, reject) => {
        const ytdlp = spawn('yt-dlp', [
            '--dump-json',
            '--no-download',
            youtubeUrl
        ]);
        
        let jsonData = '';
        
        ytdlp.stdout.on('data', (data) => {
            jsonData += data.toString();
        });
        
        ytdlp.on('close', (code) => {
            if (code === 0) {
                try {
                    const info = JSON.parse(jsonData);
                    resolve(info);
                } catch (e) {
                    reject(new Error('Failed to parse video info'));
                }
            } else {
                reject(new Error('Failed to get video info'));
            }
        });
    });
}

/**
 * Serve static files
 */
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4'
};

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;
    
    // API: Get video info
    if (pathname === '/api/video-info') {
        try {
            const info = await getVideoInfo();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                title: info.title,
                duration: info.duration,
                thumbnail: info.thumbnail,
                uploader: info.uploader,
                id: info.id,
                localPath: `/test-video`
            }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }
    
    // Serve the downloaded video
    if (pathname === '/test-video') {
        if (!fs.existsSync(videoPath)) {
            res.writeHead(404);
            res.end('Video not found. Download may still be in progress.');
            return;
        }
        
        const stat = fs.statSync(videoPath);
        const range = req.headers.range;
        
        if (range) {
            // Handle range requests for video streaming
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunksize = end - start + 1;
            
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4'
            });
            
            const stream = fs.createReadStream(videoPath, { start, end });
            stream.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': stat.size,
                'Content-Type': 'video/mp4'
            });
            fs.createReadStream(videoPath).pipe(res);
        }
        return;
    }
    
    // Serve static files from the project root
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// Main
async function main() {
    console.log('🎬 OpenTruth Dev Proxy Server\n');
    
    // Download video if not cached
    if (!fs.existsSync(videoPath)) {
        try {
            await downloadVideo();
        } catch (e) {
            console.error('❌ Download failed:', e.message);
            console.log('\nMake sure yt-dlp is installed:');
            console.log('  pip install yt-dlp');
            console.log('  # or');
            console.log('  brew install yt-dlp');
            process.exit(1);
        }
    } else {
        console.log(`✅ Using cached video: ${videoPath}`);
    }
    
    // Get video info
    try {
        const info = await getVideoInfo();
        console.log(`\n📺 Video: ${info.title}`);
        console.log(`⏱️  Duration: ${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, '0')}`);
    } catch (e) {
        console.log('⚠️  Could not get video info');
    }
    
    // Start server
    server.listen(PORT, () => {
        console.log(`\n🚀 Server running at http://localhost:${PORT}`);
        console.log(`\n📁 Test video available at: http://localhost:${PORT}/test-video`);
        console.log(`ℹ️  Video info API: http://localhost:${PORT}/api/video-info`);
        console.log('\n🎯 Open your browser and drag any video file into the upload area,');
        console.log('   or the test video will be auto-loaded.\n');
    });
}

main().catch(console.error);
