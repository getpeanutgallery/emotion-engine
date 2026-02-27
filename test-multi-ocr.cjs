const { createWorker } = require('tesseract.js');

async function test() {
    const worker = await createWorker('eng');
    const times = [1.8, 2.0, 2.2, 2.4];
    
    console.log('Testing OCR at multiple timestamps:\n');
    
    for (const t of times) {
        const framePath = `/tmp/test-${t}s.jpg`;
        const { data: { text, confidence } } = await worker.recognize(framePath);
        
        console.log(`=== ${t}s (confidence: ${confidence.toFixed(1)}%) ===`);
        // Show first 3 lines of detected text
        const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
        lines.slice(0, 3).forEach(l => console.log('  ' + l));
        if (lines.length > 3) console.log(`  ... (${lines.length} total lines)`);
        console.log('');
    }
    
    await worker.terminate();
}

test().catch(console.error);
