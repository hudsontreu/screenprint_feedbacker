#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D tex0;
uniform sampler2D tex1;
uniform sampler2D feedback;
uniform float mixAmount;
uniform float time;
uniform vec2 resolution;
uniform float feedbackAmount;
uniform float feedbackDecay;
uniform float colorSeparation;
uniform float grainAmount;
uniform float halftoneScale;
uniform float posterizeLevels;
uniform float brightness;
uniform float contrast;
uniform float saturation;

uniform float exposure;      // default: 0.01
uniform float analogFade;      // default: 0.4
uniform float colorShift;      // default: 0.75

varying vec2 vTexCoord;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float halftone(vec2 uv, float intensity) {
    vec2 coord = uv * halftoneScale;
    vec2 nearest = 2.0 * fract(coord) - 1.0;
    float dist = length(nearest);
    return step(dist, intensity * 1.5);
}

vec3 posterize(vec3 color) {
    return floor(color * posterizeLevels) / posterizeLevels;
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

vec4 applyFeedback(vec2 uv) {
    vec4 feedbackColor = texture2D(feedback, uv);
    return feedbackColor * feedbackDecay;
}

vec4 applyColorSeparation(sampler2D tex, vec2 uv) {
    vec2 rOffset = vec2(colorSeparation, 0.0);
    vec2 gOffset = vec2(0.0, 0.0);
    vec2 bOffset = vec2(-colorSeparation, 0.0);
    
    float r = texture2D(tex, uv + rOffset).r;
    float g = texture2D(tex, uv + gOffset).g;
    float b = texture2D(tex, uv + bOffset).b;
    
    return vec4(r, g, b, 1.0);
}

vec4 applyGrain(vec4 color, vec2 uv) {
    float noise = random(uv + time) * grainAmount;
    return color + vec4(noise);
}

vec4 applyHalftone(vec4 color, vec2 uv) {
    vec2 center = fract(uv * halftoneScale);
    float dist = length(center - 0.5);
    float pattern = smoothstep(0.4, 0.5, dist);
    return mix(color, vec4(pattern), 0.2);
}

vec4 applyPosterize(vec4 color) {
    return floor(color * posterizeLevels) / posterizeLevels;
}

vec4 adjustColors(vec4 color) {
    // Brightness
    color.rgb *= brightness;
    
    // Contrast
    color.rgb = (color.rgb - 0.5) * contrast + 0.5;
    
    // Saturation
    float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    color.rgb = mix(vec3(luminance), color.rgb, saturation);
    
    return color;
}

void main() {
    vec2 uv = vTexCoord;
    uv.y = 1.0 - uv.y;
    
    // Get feedback from previous frame with decay
    vec4 feedbackColor = applyFeedback(uv);
    
    vec2 redOffset = vec2(colorSeparation * sin(time), colorSeparation * cos(time));
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
    hsv.y *= saturation;
    hsv.y = mix(hsv.y, hsv.y * (1.0 - analogFade), random(uv + time));
    hsv.z = mix(hsv.z, hsv.z * (1.0 - analogFade * 0.5), random(uv - time));
    hsv.x += colorShift * random(uv * time);
    
    vec3 color = hsv2rgb(hsv);
    color = (color - 0.5) * contrast + 0.5 + exposure;
    
    vec2 grainUV = uv * resolution;
    vec3 grain = vec3(
        random(grainUV + vec2(time * 0.001)),
        random(grainUV + vec2(time * 0.002)),
        random(grainUV + vec2(time * 0.003))
    ) * grainAmount;
    color += grain;
    
    vec3 halftoneColor;
    halftoneColor.r = halftone(uv + redOffset, color.r);
    halftoneColor.g = halftone(uv, color.g);
    halftoneColor.b = halftone(uv + blueOffset, color.b);
    
    color = mix(color, halftoneColor, 0.5);
    color = posterize(color);
    color = mix(color, color.gbr * 0.9, analogFade * 0.2);
    
    // Mix with feedback
    color = mix(color, feedbackColor.rgb, feedbackAmount);
    
    // Prevent oversaturation
    color = clamp(color * (1.0 - feedbackAmount * 0.5), 0.0, 1.0);
    
    gl_FragColor = vec4(color, 1.0);
}
