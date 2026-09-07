import { useLocale } from "../locale.js";
import type { MeshMetrics } from "../types";

type MetricsBarProps = {
  metrics: MeshMetrics;
};

export function MetricsBar({ metrics }: MetricsBarProps) {
  const { locale, t } = useLocale();
  const number = new Intl.NumberFormat(locale);
  const cells: { label: string; value: string }[] = [
    { label: t.triangles, value: number.format(metrics.triangles) },
    { label: t.vertices, value: number.format(metrics.vertices) },
    { label: t.materials, value: number.format(metrics.materials) },
    { label: t.drawCalls, value: number.format(metrics.drawCalls) },
  ];

  if (metrics.textures !== undefined) {
    const { count, maxSize } = metrics.textures;
    cells.push({
      label: t.textures,
      value: `${number.format(count)} · ${t.upTo} ${number.format(maxSize)}px`,
    });
  }

  if (metrics.dimensions !== undefined) {
    const { x, y, z } = metrics.dimensions;
    cells.push({
      label: t.dimensions,
      value: `${number.format(x)}×${number.format(y)}×${number.format(z)}`,
    });
  }

  return (
    <div className="metrics">
      <div className="metrics__grid">
        {cells.map((cell) => (
          <div key={cell.label} className="metrics__cell">
            <span className="metrics__label">{cell.label}</span>
            <strong className="metrics__value">{cell.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
