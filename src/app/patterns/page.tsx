import type { Metadata } from 'next';
import { PatternApp }    from '@/components/patterns/PatternApp';

export const metadata: Metadata = {
  title:       'Pattern Engines — Curato Lab',
  description: 'Generate image effects using procedural black-and-white patterns. Serpentines, spirals, maze, spots, worms, fingerprints, coral, zebra, bubbles, and noise grid.',
};

export default function PatternsPage() {
  return <PatternApp />;
}
