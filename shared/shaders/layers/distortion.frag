#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_input;

// Shared parameters
uniform int waveType;     // 0=sine, 1=square, 2=triangle, 3=sawtooth
uniform float freq;
uniform float amplitude;
uniform float direction;  // degrees

// Type-specific
uniform float sharpness;  // square: edge hardness (1=soft, 50=hard)
uniform float pulseWidth; // square: lobe width modulation
uniform float skew;       // triangle/sawtooth: lean (-1 to 1)

// Animation
uniform float speed;
uniform float drift;

#define PI 3.14159265359
#define TAU 6.28318530718

// --- Fast tanh approximation ---
float fastTanh(float x) {
  return clamp(x * (27.0 + x * x) / (27.0 + 9.0 * x * x), -1.0, 1.0);
}

// --- Wave functions ---

float waveSine(float x) {
  return sin(x);
}

float waveSquare(float x, float sharp, float width) {
  float m = 1.0 + sin(x * 0.5) * width;
  m = clamp(m, 0.3, 2.0);
  return fastTanh(sin(x * m) * sharp);
}

float waveTriangle(float x, float sk) {
  // Skewed triangle wave
  // sk = 0: symmetric, sk > 0: lean right, sk < 0: lean left
  float t = fract(x / TAU + 0.25);
  float rise = 0.5 + sk * 0.49; // rise portion (0.01 to 0.99)
  rise = clamp(rise, 0.01, 0.99);

  if (t < rise) {
    return 2.0 * t / rise - 1.0;
  } else {
    return 1.0 - 2.0 * (t - rise) / (1.0 - rise);
  }
}

float computeWave(float x) {
  if (waveType == 0) {
    return waveSine(x);
  } else if (waveType == 1) {
    return waveSquare(x, sharpness, pulseWidth);
  } else {
    return waveTriangle(x, skew);
  }
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;

  // Centered, aspect-corrected space
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= aspect;

  // Direction with animated oscillation (drift controls rotation wobble)
  float baseAngle = radians(direction);
  float angle = baseAngle + drift * sin(u_time * speed * 0.1) * 1.57;
  vec2 dir = vec2(cos(angle), sin(angle));

  // Project UV onto wave direction
  float diag = dot(centered, dir);

  // Compute wave with animated frequency modulation
  float wave = computeWave(diag * freq);

  // Animated amplitude (drift controls amplitude wobble)
  float animatedAmplitude = amplitude * (1.0 + drift * (0.5 + 0.4 * sin(u_time * speed * 0.13)));

  // Displace in centered space, convert back to UV
  vec2 displaced = centered + dir * wave * animatedAmplitude;
  vec2 sampleUV = displaced;
  sampleUV.x /= aspect;
  sampleUV = sampleUV * 0.5 + 0.5;

  gl_FragColor = texture2D(u_input, sampleUV);
}
