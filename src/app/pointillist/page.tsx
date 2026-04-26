import type { Metadata } from 'next';
import { PointillistApp } from '@/components/pointillist/PointillistApp';

export const metadata: Metadata = {
  title: 'Pointillist Generator — RasterLab V2',
  description: 'Transform images into pointillism and stipple illustrations in real time.',
};

export default function PointillistPage() {
  return <PointillistApp />;
}
