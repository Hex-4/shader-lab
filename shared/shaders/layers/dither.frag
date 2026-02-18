#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform sampler2D u_input;
uniform float u_scale;

uniform float levels;
uniform float ditherScale;

float bayer4x4(vec2 coord) {
  mat4 bayerMatrix = mat4(
    0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
    12.0/16.0, 4.0/16.0, 14.0/16.0,  6.0/16.0,
    3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
    15.0/16.0, 7.0/16.0, 13.0/16.0,  5.0/16.0
  );
  int x = int(mod(coord.x, 4.0));
  int y = int(mod(coord.y, 4.0));
  return bayerMatrix[y][x];
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  float scale = ditherScale * u_scale;

  // Sample at dither block center for blocky look
  vec2 ditherBlockCoord = floor(fragCoord / scale) * scale + scale * 0.5;
  vec2 blockUV = ditherBlockCoord / u_resolution;

  vec3 color = texture2D(u_input, blockUV).rgb;

  // Bayer dithering per block
  vec2 ditherCoord = floor(fragCoord / scale);
  float threshold = bayer4x4(ditherCoord);
  color = floor(color * levels + threshold) / levels;

  gl_FragColor = vec4(color, 1.0);
}
