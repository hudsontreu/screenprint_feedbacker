let mainShader;
let videos = [];
let currentVideoIndex = 0;
let nextVideoIndex = 1;
let transitionProgress = 0;
let isTransitioning = false;
let lastVideoSwitch = 0;
let VIDEO_DURATION = 10000; // 10 seconds per video
let TRANSITION_DURATION = 2000; // 2 second fade
let overlayGraphics = [];
let scribbleGraphics;
let lastScribbleTime = 0;
let feedbackBuffer;
let currentBuffer;
let scribbles = [];
let circles = [];

function preload() {
    mainShader = loadShader('shader.vert', 'shader.frag');
    
    // Load all videos
    const videoFiles = ['src_video.mov', 'src_video.mp4', 'sunflower.mp4'];
    
    function loadNextVideo(index) {
        if (index >= videoFiles.length) {
            // All videos loaded, start playback
            videos.forEach(vid => {
                vid.loop();
                vid.hide();
                vid.volume(0);
            });
            return;
        }
        
        let vid = createVideo(videoFiles[index], () => {
            console.log(`Loaded video ${index}: ${videoFiles[index]}`);
            videos.push(vid);
            loadNextVideo(index + 1);
        });
    }
    
    loadNextVideo(0);
}

function setup() {
    createCanvas(windowWidth, windowHeight, WEBGL);
    pixelDensity(1);
    noStroke();
    
    // Create buffers for feedback effect
    feedbackBuffer = createGraphics(width, height, WEBGL);
    currentBuffer = createGraphics(width, height, WEBGL);
    
    // Create overlay graphics buffers
    for (let i = 0; i < 3; i++) {
        let g = createGraphics(width, height);
        g.colorMode(HSB);
        overlayGraphics.push(g);
    }
    
    // Create scribble graphics buffer
    scribbleGraphics = createGraphics(width, height);
    scribbleGraphics.colorMode(HSB);
    scribbleGraphics.blendMode(ADD);
    
    // Initialize scribble parameters
    for (let i = 0; i < 5; i++) {
        createNewScribble();
    }
}

function createNewScribble() {
    scribbles.push({
        x: random(width),
        y: random(height),
        points: [],
        hue: random(255),
        life: 255,
        width: random(2, 5)
    });
}

function updateScribbles() {
    scribbleGraphics.clear();
    
    // Add new scribbles occasionally
    if (frameCount - lastScribbleTime > 60) {
        createNewScribble();
        lastScribbleTime = frameCount;
    }
    
    // Update and draw all scribbles
    for (let i = scribbles.length - 1; i >= 0; i--) {
        let scribble = scribbles[i];
        
        // Add new points using Perlin noise for smooth movement
        if (scribble.points.length < 100) {
            let lastPoint = scribble.points[scribble.points.length - 1] || {
                x: scribble.x,
                y: scribble.y
            };
            
            let angle = noise(lastPoint.x * 0.01, lastPoint.y * 0.01, frameCount * 0.01) * TWO_PI;
            let newPoint = {
                x: lastPoint.x + cos(angle) * 2,
                y: lastPoint.y + sin(angle) * 2
            };
            scribble.points.push(newPoint);
        }
        
        // Draw the scribble
        scribbleGraphics.push();
        scribbleGraphics.noFill();
        scribbleGraphics.strokeWeight(scribble.width);
        scribbleGraphics.stroke(scribble.hue, 255, 255, scribble.life);
        
        scribbleGraphics.beginShape();
        for (let point of scribble.points) {
            scribbleGraphics.vertex(point.x, point.y);
        }
        scribbleGraphics.endShape();
        scribbleGraphics.pop();
        
        // Update life and remove dead scribbles
        scribble.life -= 1;
        if (scribble.life <= 0) {
            scribbles.splice(i, 1);
        }
    }
}

function updateOverlays() {
    overlayGraphics.forEach((g, i) => {
        g.clear();
        g.push();
        
        // Create dynamic shapes
        let t = frameCount * 0.02 + i * TWO_PI / 3;
        let x = width/2 + cos(t) * 200;
        let y = height/2 + sin(t * 1.5) * 150;
        
        // Draw gradient circles with blend modes
        g.blendMode(BLEND);
        for (let r = 200; r > 0; r -= 20) {
            let hue = (frameCount * 0.5 + i * 30 + r) % 100;
            g.fill(hue, 80, 90, 0.1);
            g.noStroke();
            g.circle(x, y, r);
        }
        
        g.pop();
    });
}

// Circle class to manage individual circles
class Circle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 20;
        this.life = 255;
        this.decay = random(2, 5);
    }

    update() {
        this.life -= this.decay;
        return this.life > 0;
    }

    draw() {
        push();
        stroke(255,255,255, this.life);
        fill(255, this.life);
        circle(this.x, this.y, this.size);
        pop();
    }
}

function createCircleLine() {
    let startX = random(width);
    let startY = random(height);
    let endX = startX + random(-200, 200);
    let endY = startY;
    
    let steps = random(1, 4);
    for (let i = 0; i <= steps; i++) {
        let x = lerp(startX, endX, i/steps);
        let y = lerp(startY, endY, i/steps);
        circles.push(new Circle(x, y));
    }
}

function updateCircles() {
    // Create new line of circles occasionally
    if (frameCount % 30 === 0) {
        createCircleLine();
    }
    
    // Update and draw existing circles
    for (let i = circles.length - 1; i >= 0; i--) {
        if (!circles[i].update()) {
            circles.splice(i, 1);
        }
    }
}

function updateVideoTransition() {
    if (!videos.length) return; // Wait for videos to load
    
    let currentTime = millis();
    
    // Check if it's time to start a transition
    if (!isTransitioning && currentTime - lastVideoSwitch >= VIDEO_DURATION) {
        isTransitioning = true;
        lastVideoSwitch = currentTime;
        nextVideoIndex = (currentVideoIndex + 1) % videos.length;
    }
    
    // Update transition progress
    if (isTransitioning) {
        transitionProgress = (currentTime - lastVideoSwitch) / TRANSITION_DURATION;
        
        if (transitionProgress >= 1) {
            // Transition complete
            isTransitioning = false;
            transitionProgress = 0;
            currentVideoIndex = nextVideoIndex;
            nextVideoIndex = (currentVideoIndex + 1) % videos.length;
            lastVideoSwitch = currentTime;
        }
    }
}

function draw() {
    updateVideoTransition();
    
    // Swap buffers
    let temp = feedbackBuffer;
    feedbackBuffer = currentBuffer;
    currentBuffer = temp;
    
    // Draw to current buffer
    currentBuffer.shader(mainShader);
    
    if (videos.length) {
        mainShader.setUniform('tex0', videos[currentVideoIndex]);
        mainShader.setUniform('tex1', videos[nextVideoIndex]);
        mainShader.setUniform('mixAmount', isTransitioning ? smoothstep(0, 1, transitionProgress) : 0.0);
    }
    
    mainShader.setUniform('feedback', feedbackBuffer);
    mainShader.setUniform('time', frameCount * 0.01);
    mainShader.setUniform('resolution', [width, height]);
    mainShader.setUniform('feedbackAmount', 0.3);
    
    currentBuffer.rect(-width/2, -height/2, width, height);
    
    // Draw current buffer to screen
    image(currentBuffer, -width/2, -height/2, width, height);
    
    // Update scribbles
    updateScribbles();
    
    // Draw overlays with blending
    push();
    translate(-width/2, -height/2);
    blendMode(SCREEN);
    
    overlayGraphics.forEach(g => {
        image(g, 0, 0);
    });
    
    // Draw scribbles on top
    blendMode(OVERLAY);
    image(scribbleGraphics, 0, 0);
    pop();

    // Update and draw circles
    push();
    translate(-width/2, -height/2);
    updateCircles();
    for (let circle of circles) {
        circle.draw();
    }
    pop();
}

// Smooth step function for transitions
function smoothstep(min, max, value) {
    let x = constrain((value - min) / (max - min), 0, 1);
    return x * x * (3 - 2 * x);
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    
    // Resize all graphics buffers
    feedbackBuffer = createGraphics(windowWidth, windowHeight, WEBGL);
    currentBuffer = createGraphics(windowWidth, windowHeight, WEBGL);
    
    overlayGraphics.forEach((g, i) => {
        overlayGraphics[i] = createGraphics(windowWidth, windowHeight);
        overlayGraphics[i].colorMode(HSB);
    });
    
    scribbleGraphics = createGraphics(windowWidth, windowHeight);
    scribbleGraphics.colorMode(HSB);
    scribbleGraphics.blendMode(ADD);
}
