/* ==========================================================================
   THEME SYNCHRONIZATION (Chameleon System)
   ========================================================================== */
function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
}

// 1. Check URL parameters first (for iframe injections)
const urlParams = new URLSearchParams(window.location.search);
const injectedTheme = urlParams.get('theme');
if (injectedTheme) setTheme(injectedTheme);

// 2. Listen for real-time broadcasts from parent portfolio
window.addEventListener('message', function(event) {
    if (event.data && event.data.theme) {
        setTheme(event.data.theme);
    }
});


/* ==========================================================================
   DOT ART ENGINE LOGIC
   ========================================================================== */
const uploadZone = document.getElementById('upload-zone');
const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const output = document.getElementById('output');
const widthInput = document.getElementById('widthInput');
const thresholdInput = document.getElementById('thresholdInput');
const invertInput = document.getElementById('invertInput');

const widthLabel = document.getElementById('widthLabel');
const thresholdLabel = document.getElementById('thresholdLabel');
const dimensionsLabel = document.getElementById('dimensionsLabel');
const uploadLabel = document.getElementById('uploadLabel');

const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');

let currentImage = null;

// Clean separation of concerns: Trigger file input click from JS
uploadZone.addEventListener('click', () => {
    imageLoader.click();
});

imageLoader.addEventListener('change', handleImage, false);

thresholdInput.addEventListener('input', () => { 
    thresholdLabel.textContent = `Contrast Threshold: ${thresholdInput.value}`;
    if(currentImage) generateDotArt(); 
});

widthInput.addEventListener('input', () => { 
    widthLabel.textContent = `Width: ${widthInput.value} Chars`;
    if(currentImage) generateDotArt(); 
});

invertInput.addEventListener('change', () => { 
    if(currentImage) generateDotArt(); 
});

copyBtn.addEventListener('click', () => {
    if(!currentImage) return;
    
    const textToCopy = output.textContent;

    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "Copied to Clipboard!";
        setTimeout(() => copyBtn.textContent = originalText, 2000);
    }).catch(err => {
        // Fallback if blocked by permissions policy
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = "Copied to Clipboard!";
            setTimeout(() => copyBtn.textContent = originalText, 2000);
        } catch (e) {
            alert('Failed to copy. Please download the .txt file instead.');
        }
        document.body.removeChild(textArea);
    });
});

downloadBtn.addEventListener('click', () => {
    if(!currentImage) return;
    const blob = new Blob([output.textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dotart-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

function handleImage(e) {
    if(!e.target.files.length) return;
    uploadLabel.textContent = e.target.files[0].name.toUpperCase();
    const reader = new FileReader();
    reader.onload = function(event) {
        currentImage = new Image();
        currentImage.onload = function() {
            generateDotArt();
        }
        currentImage.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
}

function generateDotArt() {
    if (!currentImage) return;

    const targetWidthChars = parseInt(widthInput.value);
    const targetPixelWidth = targetWidthChars * 2; 
    
    // Calculate the height scale factor
    const scale = targetPixelWidth / currentImage.width;
    
    // Aspect-ratio multiplier (0.75) to pre-flatten the image height
    const targetPixelHeight = Math.round((currentImage.height * scale) * 0.75);
    
    canvas.width = targetPixelWidth;
    canvas.height = targetPixelHeight + (4 - (targetPixelHeight % 4));

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    const threshold = parseInt(thresholdInput.value);
    const isInverted = invertInput.checked;

    const binaryGrid = [];
    for (let y = 0; y < canvas.height; y++) {
        binaryGrid[y] = [];
        for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const gray = 0.2126 * pixels[idx] + 0.7152 * pixels[idx+1] + 0.0722 * pixels[idx+2];
            binaryGrid[y][x] = isInverted ? (gray > threshold) : (gray < threshold); 
        }
    }

    let resultText = "";
    const dotOffsets = [[0,0], [1,0], [2,0], [0,1], [1,1], [2,1], [3,0], [3,1]];

    for (let y = 0; y < canvas.height; y += 4) {
        let rowText = "";
        for (let x = 0; x < canvas.width; x += 2) {
            let offset = 0;
            for (let i = 0; i < 8; i++) {
                const dy = dotOffsets[i][0];
                const dx = dotOffsets[i][1];
                if (binaryGrid[y + dy] && binaryGrid[y + dy][x + dx]) {
                    offset |= (1 << i);
                }
            }
            rowText += String.fromCharCode(0x2800 + offset);
        }
        resultText += rowText + "\n";
    }

    output.textContent = resultText;
    dimensionsLabel.textContent = `${targetWidthChars} x ${canvas.height / 4} comment block`;
}