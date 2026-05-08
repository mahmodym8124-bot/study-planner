// Static seed data for Exam Mode.
// Users can also rely on their own subjects — this data augments common engineering topics.

export const EXAM_DATA = {
  'Electromagnetic Fields': {
    topics: [
      'Coulomb\'s Law and Electric Field Intensity',
      'Gauss\'s Law and Divergence Theorem',
      'Electric Potential and Energy',
      'Conductors, Dielectrics, and Capacitance',
      'Poisson\'s and Laplace\'s Equations',
      'Steady Magnetic Fields (Biot-Savart, Ampere)',
      'Magnetic Forces, Materials, and Inductance',
      'Faraday\'s Law and Electromagnetic Induction',
      'Maxwell\'s Equations',
      'Uniform Plane Waves',
    ],
    formulas: [
      { name: "Coulomb's Law", expr: 'F = k·q₁q₂/r²', note: 'k = 9×10⁹ N·m²/C²' },
      { name: 'Electric Field', expr: 'E = F/q = k·Q/r²', note: 'Units: V/m or N/C' },
      { name: "Gauss's Law", expr: '∮ D·dS = Q_enc', note: 'D = ε₀E in free space' },
      { name: 'Divergence Theorem', expr: '∮ A·dS = ∫ ∇·A dV', note: 'Vector identity' },
      { name: 'Electric Potential', expr: 'V = -∫ E·dl', note: 'E = -∇V' },
      { name: 'Capacitance', expr: 'C = Q/V = ε·A/d', note: 'Parallel plate' },
      { name: "Biot-Savart Law", expr: 'dH = I·dl×aR / (4πR²)', note: 'Magnetic field from current' },
      { name: "Ampere's Law", expr: '∮ H·dl = I_enc', note: '∇×H = J' },
      { name: 'Faraday\'s Law', expr: 'emf = -dΦ/dt', note: 'Φ = ∫ B·dS' },
      { name: "Maxwell's Equations", expr: '∇·D=ρ, ∇·B=0, ∇×E=-∂B/∂t, ∇×H=J+∂D/∂t', note: 'Full set' },
    ],
    questions: [
      'Derive the electric field of an infinite line charge using Gauss\'s Law.',
      'Two point charges of +3μC and -3μC are separated by 10cm. Find the force.',
      'Find the capacitance per unit length of a coaxial cable with inner radius a and outer radius b.',
      'State and prove the boundary conditions for E and H at an interface.',
      'A conducting sphere of radius R has charge Q. Find E for r<R and r>R.',
      'Derive the wave equation from Maxwell\'s equations in free space.',
    ],
  },
  'Electrical Machines': {
    topics: [
      'DC Machine Construction and Principles',
      'DC Generator and Motor Characteristics',
      'Transformers – Equivalent Circuit',
      'Three-Phase Induction Motor Operation',
      'Slip and Rotor Frequency',
      'Speed Control of Induction Motors',
      'Starting Methods for Induction Motors',
      'Synchronous Generator Principles',
      'Power Factor and Efficiency',
      'Stepper and Servo Motors',
    ],
    formulas: [
      { name: 'EMF of DC Generator', expr: 'E = PΦZN / 60A', note: 'P=poles, Z=conductors, A=parallel paths' },
      { name: 'Slip', expr: 's = (Ns - N) / Ns', note: 'Ns = synchronous speed' },
      { name: 'Synchronous Speed', expr: 'Ns = 120f / P', note: 'f=frequency, P=poles' },
      { name: 'Rotor Frequency', expr: 'f₂ = s·f₁', note: 'f₁ = supply frequency' },
      { name: 'Rotor EMF', expr: 'E₂s = s·E₂', note: 'E₂ = standstill rotor EMF' },
      { name: 'Efficiency', expr: 'η = Pout / Pin × 100%', note: 'Losses = Cu + Iron + Mech' },
      { name: 'Transformer EMF', expr: 'E = 4.44·f·N·Φm', note: 'RMS EMF equation' },
      { name: 'Turns Ratio', expr: 'a = N₁/N₂ = V₁/V₂ = I₂/I₁', note: 'Ideal transformer' },
    ],
    questions: [
      'A 4-pole DC generator has 480 conductors, flux 0.02 Wb, runs at 1000 rpm. Find EMF (wave winding).',
      'An induction motor runs at 1440 rpm on a 50Hz, 4-pole supply. Calculate slip.',
      'Explain speed-torque characteristics of a 3-phase induction motor.',
      'Describe the Kramer and Scherbius systems for induction motor speed control.',
      'A transformer has turns ratio 10:1. If primary is 2200V, find secondary voltage and current for 5kVA load.',
      'What are the starting methods for a squirrel-cage induction motor? Compare them.',
    ],
  },
  'Circuit Analysis': {
    topics: [
      'KVL and KCL – Kirchhoff\'s Laws',
      'Node Voltage Method',
      'Mesh Current Method',
      'Thevenin and Norton Equivalents',
      'Superposition Theorem',
      'Maximum Power Transfer',
      'AC Circuits – Phasors and Impedance',
      'Resonance (Series and Parallel)',
      'Three-Phase Circuits',
      'Frequency Response and Filters',
    ],
    formulas: [
      { name: 'Ohm\'s Law', expr: 'V = IR', note: 'Fundamental relation' },
      { name: 'Series Resistance', expr: 'R_eq = R₁+R₂+...+Rn', note: '' },
      { name: 'Parallel Resistance', expr: '1/R_eq = 1/R₁+1/R₂+...', note: '' },
      { name: 'Impedance', expr: 'Z = R + jX', note: 'X_L=ωL, X_C=1/ωC' },
      { name: 'Resonant Frequency', expr: 'f₀ = 1/(2π√LC)', note: 'Series & parallel RLC' },
      { name: 'Q Factor', expr: 'Q = ω₀L/R = 1/(ω₀CR)', note: 'Quality factor' },
      { name: 'Power (AC)', expr: 'P = VI·cos(φ)', note: 'Real power in Watts' },
      { name: 'Power Factor', expr: 'PF = cos(φ) = P/S', note: 'S = apparent power' },
    ],
    questions: [
      'Find the Thevenin equivalent of a circuit with a 12V source, 6Ω and 3Ω resistors.',
      'Use nodal analysis to find voltages in a circuit with two current sources.',
      'Find the resonant frequency of a series RLC: R=10Ω, L=0.1H, C=100μF.',
      'Apply superposition to find current through a branch with multiple sources.',
      'Calculate real, reactive, and apparent power for a load Z = 3+j4 Ω at 120V.',
      'Find Norton equivalent looking into two terminals of a resistive network.',
    ],
  },
};

// Get exam data for a subject name (fuzzy match)
export function getExamData(subjectName) {
  if (!subjectName) return null;
  const key = Object.keys(EXAM_DATA).find(
    (k) => k.toLowerCase().includes(subjectName.toLowerCase()) ||
           subjectName.toLowerCase().includes(k.toLowerCase().split(' ')[0])
  );
  return key ? { ...EXAM_DATA[key], subjectName: key } : null;
}
