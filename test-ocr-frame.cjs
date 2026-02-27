const { createWorker } = require('tesseract.js');
const fs = require('fs');

async function test() {
    console.log('Testing OCR on frame at 2s...\n');
    const worker = await createWorker('eng');
    
    const { data: { text, confidence, words } } = await worker.recognize('/tmp/test-2s.jpg');
    
    console.log('=== OCR Results ===');
    console.log('Confidence:', confidence.toFixed(1) + '%');
    console.log('\nRaw text:');
    console.log('"' + text.trim() + '"');
    console.log('\n=== Word breakdown (confidence > 60) ===');
    words.filter(w => w.confidence > 60 && w.text.length > 1).forEach(w => {
        console.log(`  "${w.text}" @ (${w.bbox.x0},${w.bbox.y0}) size:${w.bbox.x1-w.bbox.x0}x${w.bbox.y1-w.bbox.y0} confidence:${w.confidence.toFixed(0)}%`);
    });
    
    await worker.terminate();
}

test().catch(console.error);
