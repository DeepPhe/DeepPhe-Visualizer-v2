import React from "react";
import PropTypes from "prop-types";

// Horizontal gap between an end label and the plot edge it is anchored to.
const EDGE_LABEL_INSET = 6;

function resolveAnchor(tick, index, count) {
  if (tick.anchor) {
    return tick.anchor;
  }
  if (count > 1 && index === 0) {
    return "start";
  }
  if (count > 1 && index === count - 1) {
    return "end";
  }
  return "middle";
}

/**
 * SVG date axis drawn from `resolveTicks` output: a baseline, a tick mark per
 * tick and its label. The end labels anchor inward so they stay inside the plot.
 * Every stroke and fill is explicit: an SVG `<text>` without a fill renders
 * black, which vanishes on the dark themes.
 */
export default function TimelineAxis({
  ticks = [],
  x1,
  x2,
  y = 0,
  orientation = "bottom",
  tickSize = 5,
  labelOffset = 19,
  lineColor,
  textColor,
  lineWidth = 1,
  fontSize = 12,
  className = undefined,
  labelClassName = undefined,
  testId = undefined,
  showLine = true,
}) {
  const direction = orientation === "top" ? -1 : 1;
  const labelY = y + direction * labelOffset;

  return (
    <g className={className} data-testid={testId}>
      {showLine ? (
        <line x1={x1} y1={y} x2={x2} y2={y} stroke={lineColor} strokeWidth={lineWidth} />
      ) : null}
      {ticks.map((tick, index) => {
        const anchor = resolveAnchor(tick, index, ticks.length);
        const labelX =
          anchor === "start"
            ? tick.x + EDGE_LABEL_INSET
            : anchor === "end"
              ? tick.x - EDGE_LABEL_INSET
              : tick.x;
        const tickKey =
          tick.date instanceof Date && !Number.isNaN(tick.date.getTime())
            ? tick.date.toISOString()
            : String(tick.x);

        return (
          <g key={`tick:${index}:${tickKey}`}>
            <line
              x1={tick.x}
              y1={y}
              x2={tick.x}
              y2={y + direction * tickSize}
              stroke={lineColor}
              strokeWidth={1}
            />
            <text
              className={labelClassName}
              x={labelX}
              y={labelY}
              textAnchor={anchor}
              fill={textColor}
              fontSize={fontSize}
            >
              {tick.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

TimelineAxis.propTypes = {
  ticks: PropTypes.arrayOf(
    PropTypes.shape({
      x: PropTypes.number.isRequired,
      label: PropTypes.string,
      date: PropTypes.instanceOf(Date),
      anchor: PropTypes.oneOf(["start", "middle", "end"]),
    })
  ),
  x1: PropTypes.number.isRequired,
  x2: PropTypes.number.isRequired,
  y: PropTypes.number,
  orientation: PropTypes.oneOf(["top", "bottom"]),
  tickSize: PropTypes.number,
  labelOffset: PropTypes.number,
  lineColor: PropTypes.string.isRequired,
  textColor: PropTypes.string.isRequired,
  lineWidth: PropTypes.number,
  fontSize: PropTypes.number,
  className: PropTypes.string,
  labelClassName: PropTypes.string,
  testId: PropTypes.string,
  showLine: PropTypes.bool,
};
