/**
 * Robust Markovian BOCPD for financial returns.
 *
 * Conditions returns on their lag (AR(1) whitening), adapts the innovation
 * scale with an EWMA volatility filter, and uses a Student-t likelihood to
 * reduce sensitivity to isolated heavy-tail observations. The run-length
 * posterior is truncated for bounded worker cost. This is an online
 * approximation, not an exact posterior for a fully specified GARCH model.
 */
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function studentTLikelihood(x: number, mean: number, variance: number, df = 6): number {
  const v = Math.max(variance, 1e-8);
  const z2 = ((x - mean) ** 2) / (df * v);
  return Math.pow(1 + z2, -(df + 1) / 2) / Math.sqrt(v);
}

export function correlatedBocpdProbability(
  returns: number[],
  fallbackSigma: number,
  maxRunLength = 60,
): number {
  if (returns.length < 8) return 0;
  const clean = returns.filter(Number.isFinite);
  if (clean.length < 8) return 0;

  // Estimate a bounded AR(1) coefficient from the older part of the window,
  // then use it to form one-step innovations for the complete recent window.
  const fitEnd = Math.max(4, Math.floor(clean.length * 0.75));
  let xy = 0, xx = 0;
  for (let i = 1; i < fitEnd; i++) {
    xy += clean[i] * clean[i - 1];
    xx += clean[i - 1] ** 2;
  }
  const rho = clamp(xx > 1e-16 ? xy / xx : 0, -0.85, 0.85);
  const innovations = clean.map((r, i) => r - (i ? rho * clean[i - 1] : 0));

  // EWMA standardisation lets the likelihood follow volatility clustering
  // rather than treating the latest 1m volatility as constant throughout.
  const fallbackVariance = Math.max(fallbackSigma ** 2, 1e-12);
  let variance = Math.max(
    innovations.slice(0, Math.min(20, innovations.length))
      .reduce((sum, x) => sum + x * x, 0) / Math.min(20, innovations.length),
    fallbackVariance * 0.05,
    1e-12,
  );
  const standardised: number[] = [];
  for (const x of innovations) {
    standardised.push(x / Math.sqrt(Math.max(variance, 1e-12)));
    variance = 0.94 * variance + 0.06 * x * x;
    variance = clamp(variance, fallbackVariance * 0.02, fallbackVariance * 25);
  }

  const hazard = 1 / 80;
  const priorVariance = 4;
  let probabilities = [1];
  let means = [0];
  let meanVariances = [priorVariance];
  let cpProbability = 0;

  for (const observation of standardised.slice(-60)) {
    const growthMass: number[] = [];
    const growthMeans: number[] = [];
    const growthVariances: number[] = [];
    let changeMass = 0;
    const priorLikelihood = studentTLikelihood(observation, 0, 1 + priorVariance);

    for (let r = 0; r < probabilities.length; r++) {
      const predictiveVariance = 1 + meanVariances[r];
      const likelihood = studentTLikelihood(observation, means[r], predictiveVariance);
      changeMass += probabilities[r] * hazard * priorLikelihood;
      growthMass[r + 1] = probabilities[r] * (1 - hazard) * likelihood;

      // Gaussian conjugate mean update on the robustly standardised innovation.
      const posteriorVariance = 1 / (1 / meanVariances[r] + 1);
      growthMeans[r + 1] = posteriorVariance * (means[r] / meanVariances[r] + observation);
      growthVariances[r + 1] = posteriorVariance;
    }

    const cpVariance = 1 / (1 / priorVariance + 1);
    const cpMean = cpVariance * observation;
    const nextProbabilities = [changeMass, ...growthMass.slice(1, maxRunLength + 1)];
    const nextMeans = [cpMean, ...growthMeans.slice(1, maxRunLength + 1)];
    const nextVariances = [cpVariance, ...growthVariances.slice(1, maxRunLength + 1)];
    const total = nextProbabilities.reduce((sum, p) => sum + p, 0);
    if (!(total > 0) || !Number.isFinite(total)) return 0;
    probabilities = nextProbabilities.map(p => p / total);
    means = nextMeans;
    meanVariances = nextVariances;
    cpProbability = probabilities[0] ?? 0;
  }

  return clamp(cpProbability, 0, 1);
}
