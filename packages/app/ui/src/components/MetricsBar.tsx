import type { MeshMetrics } from "../types";

type MetricsBarProps = {
  metrics: MeshMetrics;
  layers: string[];
};

export function MetricsBar({ metrics, layers }: MetricsBarProps) {
  const cells = [
    { label: "tris", value: String(metrics.triangles) },
    { label: "verts", value: String(metrics.vertices) },
    { label: "materiais", value: String(metrics.materials) },
    { label: "draw calls", value: String(metrics.drawCalls) },
  ];

  if (metrics.textures !== undefined) {
    const { count, maxSize } = metrics.textures;
    cells.push({
      label: "texturas",
      value: `${String(count)} · até ${String(maxSize)}px`,
    });
  }

  if (metrics.dimensions !== undefined) {
    const { x, y, z } = metrics.dimensions;
    cells.push({
      label: "dims",
      value: `${String(x)}×${String(y)}×${String(z)}`,
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
      <p className="metrics__layers">camadas · {layers.join(" · ")}</p>
    </div>
  );
}
