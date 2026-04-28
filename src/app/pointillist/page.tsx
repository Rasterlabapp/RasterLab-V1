import type { Metadata } from 'next';
import { PointillistApp } from '@/components/pointillist/PointillistApp';

export const metadata: Metadata = {
  title: 'Pointillist Generator — Curato Lab',
  description: 'Transform images into pointillism and stipple illustrations in real time. Precision tools for visual creators.',
};

export default function PointillistPage() {
  return <PointillistApp />;
}
