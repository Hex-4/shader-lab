#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform sampler2D u_color;        // generator output (the color to sample)
uniform sampler2D u_displacement; // accumulated displacement map (RG encoded)

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  // Decode displacement: [0, 1] → [-1, 1]
  vec2 displacement = texture2D(u_displacement, uv).rg * 2.0 - 1.0;

  // Sample the color texture at the displaced position
  vec2 sampleUV = uv + displacement;

  gl_FragColor = texture2D(u_color, sampleUV);
}
