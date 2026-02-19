import type { LFOSource, ModulationAssignment, WavePoint } from "#shared/types/editor";

/**
 * Schlick bias: attempt with attempt with
 * bias(t, b) = t / ((1/b - 2) * (1 - t) + 1)
 *
 * b = 0.5: linear
 * b < 0.5: bows toward start (slow start, fast end)
 * b > 0.5: bows toward end (fast start, slow end)
 *
 * Key property: bias(0.5, b) = b — the midpoint value equals the bias parameter.
 * Smooth finite slope at both endpoints. No infinite slopes, no zero slopes.
 */
function schlickBias(t: number, b: number): number {
  t = Math.max(0, Math.min(1, t));
  b = Math.max(0.001, Math.min(0.999, b));
  return t / ((1 / b - 2) * (1 - t) + 1);
}

/** Map curve value [-inf, +inf] to bias parameter b (0, 1) via sigmoid. */
function curveToB(curve: number): number {
  return 1 / (1 + Math.exp(curve * 3));
}

/** Inverse: map bias parameter b (0, 1) back to curve value. */
function bToCurve(b: number): number {
  b = Math.max(0.001, Math.min(0.999, b));
  return Math.log(1 / b - 1) / 3;
}

/**
 * Flip curve for falling segments so the visual bow direction is consistent.
 * Positive curve always means "bows away from the straight line in the same visual direction"
 * regardless of whether the segment rises or falls.
 */
function effectiveCurve(p1y: number, p2y: number, curve: number): number {
  return p2y >= p1y ? curve : -curve;
}

/**
 * Get the on-curve y position at t=0.5 for a segment.
 * Since schlickBias(0.5, b) = b, this is simply p1y + dy * b.
 */
export function getOnCurveY(p1y: number, p2y: number, curve: number): number {
  const eff = effectiveCurve(p1y, p2y, curve);
  const b = curveToB(eff);
  // schlickBias(0.5, b) = b
  return p1y + (p2y - p1y) * b;
}

/**
 * Compute curve value from a desired on-curve y at t=0.5.
 * Since schlickBias(0.5, b) = b, we get b = ratio directly.
 */
export function curveFromOnCurveY(p1y: number, p2y: number, onCurveY: number): number {
  const dy = p2y - p1y;
  if (Math.abs(dy) < 0.0001) return 0;

  let b = (onCurveY - p1y) / dy;
  b = Math.max(0.001, Math.min(0.999, b));

  const eff = bToCurve(b);
  // Flip back for falling segments
  return p2y >= p1y ? eff : -eff;
}

/** Evaluate a wave defined by points at position t (0-1) */
export function evaluateWavePoints(points: WavePoint[], t: number): number {
  if (points.length === 0) return 0.5;
  if (points.length === 1) return points[0]!.y;

  t = Math.max(0, Math.min(1, t));

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;

    if (t >= p1.x && (t <= p2.x || i === points.length - 2)) {
      const segLen = p2.x - p1.x;

      // Zero-width segment: hard step to p2.y
      if (segLen < 0.0001) return p2.y;

      const segT = (t - p1.x) / segLen;

      const eff = effectiveCurve(p1.y, p2.y, p1.curve);
      const b = curveToB(eff);
      const curvedT = schlickBias(segT, b);
      return p1.y + (p2.y - p1.y) * curvedT;
    }
  }

  return points[points.length - 1]!.y;
}

export function useModulationEngine(
  lfos: Ref<LFOSource[]>,
  assignments: Ref<ModulationAssignment[]>,
) {
  const lfoValues = ref<Record<string, number>>({});
  const lfoPhases = ref<Record<string, number>>({});

  let animationId: number | null = null;
  let startTime = 0;

  function tick() {
    const now = (performance.now() - startTime) / 1000;
    const values: Record<string, number> = {};
    const phases: Record<string, number> = {};

    for (const lfo of lfos.value) {
      const phaseOffset = lfo.phase / 360;

      const rawT = lfo.mode === "pingpong"
        ? (now * lfo.rate + phaseOffset) % 2
        : (now * lfo.rate + phaseOffset) % 1;

      const t = lfo.mode === "pingpong" && rawT > 1 ? 2 - rawT : rawT;
      const clampedT = Math.max(0, Math.min(1, t));

      phases[lfo.id] = clampedT;
      values[lfo.id] = evaluateWavePoints(lfo.points, clampedT);
    }

    lfoValues.value = values;
    lfoPhases.value = phases;
    animationId = requestAnimationFrame(tick);
  }

  function getModulatedValue(layerId: string, paramName: string, baseValue: number): number {
    const assignment = assignments.value.find(
      (a) => a.layerId === layerId && a.paramName === paramName,
    );
    if (!assignment) return baseValue;

    const lfoValue = lfoValues.value[assignment.sourceId] ?? 0;
    return baseValue + lfoValue * assignment.depth;
  }

  onMounted(() => {
    startTime = performance.now();
    animationId = requestAnimationFrame(tick);
  });

  onUnmounted(() => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
    }
  });

  return {
    lfoValues,
    lfoPhases,
    getModulatedValue,
  };
}
