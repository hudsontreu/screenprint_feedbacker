#ifdef GL_ES
precision mediump float;
#endif

#define CONTRAST 1.0
#define EXPOSURE 0.01
#define SATURATION 0.9
#define GRAIN_AMOUNT 0.1
#define COLOR_SEPARATION 0.01
#define HALFTONE_SCALE 300.0
#define POSTERIZE_LEVELS 1.04
#define ANALOG_FADE 0.4
#define COLOR_SHIFT 0.75
#define FEEDBACK_DECAY 0.95

uniform float time;
uniform vec2 resolution;
uniform sampler2D tex0;
uniform sampler2D tex1;
uniform float mixAmount;
uniform sampler2D feedback;
uniform float feedbackAmount;
varying vec2 vTexCoord;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float halftone(vec2 uv, float intensity) {
    vec2 coord = uv * HALFTONE_SCALE;
    vec2 nearest = 2.0 * fract(coord) - 1.0;
    float dist = length(nearest);
    return step(dist, intensity * 1.5);
}

vec3 posterize(vec3 color) {
    return floor(color * POSTERIZE_LEVELS) / POSTERIZE_LEVELS;
}

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec2 uv = vTexCoord;
    uv.y = 1.0 - uv.y;
    
    // Get feedback from previous frame with decay
    vec4 feedbackColor = texture2D(feedback, uv) * FEEDBACK_DECAY;
    
    vec2 redOffset = vec2(COLOR_SEPARATION * sin(time), COLOR_SEPARATION * cos(time));
    vec2 blueOffset = -redOffset;
    
    // Sample both videos with color separation
    vec3 colorSeparated1;
    colorSeparated1.r = texture2D(tex0, uv + redOffset).r;
    colorSeparated1.g = texture2D(tex0, uv).g;
    colorSeparated1.b = texture2D(tex0, uv + blueOffset).b;
    
    vec3 colorSeparated2;
    colorSeparated2.r = texture2D(tex1, uv + redOffset).r;
    colorSeparated2.g = texture2D(tex1, uv).g;
    colorSeparated2.b = texture2D(tex1, uv + blueOffset).b;
    
    // Mix the videos
    vec3 colorSeparated = mix(colorSeparated1, colorSeparated2, mixAmount);
    
    vec3 hsv = rgb2hsv(colorSeparated);
    hsv.y *= SATURATION;
    hsv.y = mix(hsv.y, hsv.y * (1.0 - ANALOG_FADE), random(uv + time));
    hsv.z = mix(hsv.z, hsv.z * (1.0 - ANALOG_FADE * 0.5), random(uv - time));
    hsv.x += COLOR_SHIFT * random(uv * time);
    
    vec3 color = hsv2rgb(hsv);
    color = (color - 0.5) * CONTRAST + 0.5 + EXPOSURE;
    
    vec2 grainUV = uv * resolution;
    vec3 grain = vec3(
        random(grainUV + vec2(time * 0.001)),
        random(grainUV + vec2(time * 0.002)),
        random(grainUV + vec2(time * 0.003))
    ) * GRAIN_AMOUNT;
    color += grain;
    
    vec3 halftoneColor;
    halftoneColor.r = halftone(uv + redOffset, color.r);
    halftoneColor.g = halftone(uv, color.g);
    halftoneColor.b = halftone(uv + blueOffset, color.b);
    
    color = mix(color, halftoneColor, 0.5);
    color = posterize(color);
    color = mix(color, color.gbr * 0.9, ANALOG_FADE * 0.2);
    
    // Mix with feedback
    color = mix(color, feedbackColor.rgb, feedbackAmount);
    
    // Prevent oversaturation
    color = clamp(color * (1.0 - feedbackAmount * 0.5), 0.0, 1.0);
    
    gl_FragColor = vec4(color, 1.0);
}
