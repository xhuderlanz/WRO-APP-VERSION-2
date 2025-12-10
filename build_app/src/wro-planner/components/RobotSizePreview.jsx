import React from "react";

/**
 * SVG preview of the robot with proportional dimensions.
 * Shows robot body, center marker, and wheel axis.
 */
const RobotSizePreview = ({ width, length, wheelOffset, unit = 'cm' }) => {
    // SVG viewport dimensions (compact for modal)
    const svgWidth = 160;
    const svgHeight = 120;
    const padding = 25;

    // Calculate scale to fit robot in viewport
    const availableWidth = svgWidth - padding * 2;
    const availableHeight = svgHeight - padding * 2;

    // Robot dimensions (ensure positive values)
    const robotWidth = Math.max(1, width || 1);
    const robotLength = Math.max(1, length || 1);
    const robotWheelOffset = Math.max(0, wheelOffset ?? 0);

    // Scale to fit
    const scaleX = availableWidth / robotWidth;
    const scaleY = availableHeight / robotLength;
    const scale = Math.min(scaleX, scaleY);

    // Scaled robot dimensions
    const scaledWidth = robotWidth * scale;
    const scaledLength = robotLength * scale;

    // Robot position (centered in SVG)
    const robotX = (svgWidth - scaledWidth) / 2;
    const robotY = (svgHeight - scaledLength) / 2;

    // Center point
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;

    // Wheel axis position (from front of robot)
    const wheelAxisY = robotY + (robotWheelOffset / robotLength) * scaledLength;

    return (
        <div className="robot-preview-container">
            <svg
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="robot-preview-svg"
            >
                {/* Background grid */}
                <defs>
                    <pattern id="previewGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth="0.5" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#previewGrid)" />

                {/* Robot body */}
                <rect
                    x={robotX}
                    y={robotY}
                    width={scaledWidth}
                    height={scaledLength}
                    fill="rgba(14, 165, 233, 0.3)"
                    stroke="#0ea5e9"
                    strokeWidth="2"
                    rx="4"
                />

                {/* Front indicator (arrow) */}
                <polygon
                    points={`${centerX},${robotY - 8} ${centerX - 6},${robotY} ${centerX + 6},${robotY}`}
                    fill="#0ea5e9"
                />
                <text
                    x={centerX}
                    y={robotY - 12}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#475569"
                    fontWeight="600"
                >
                    Frente
                </text>

                {/* Wheel axis line */}
                {robotWheelOffset > 0 && (
                    <>
                        <line
                            x1={robotX - 8}
                            y1={wheelAxisY}
                            x2={robotX + scaledWidth + 8}
                            y2={wheelAxisY}
                            stroke="#ef4444"
                            strokeWidth="2"
                            strokeDasharray="4,2"
                        />
                        {/* Wheel indicators */}
                        <rect x={robotX - 6} y={wheelAxisY - 6} width="6" height="12" fill="#374151" rx="1" />
                        <rect x={robotX + scaledWidth} y={wheelAxisY - 6} width="6" height="12" fill="#374151" rx="1" />
                    </>
                )}

                {/* Center marker */}
                <circle
                    cx={centerX}
                    cy={centerY}
                    r="4"
                    fill="#6366f1"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                />
                <text
                    x={centerX + 10}
                    y={centerY + 4}
                    fontSize="9"
                    fill="#6366f1"
                    fontWeight="600"
                >
                    Centro
                </text>
            </svg>

            {/* Dimension labels */}
            <div className="robot-preview-labels">
                <span className="robot-preview-label">
                    <strong>{robotWidth.toFixed(1)}</strong> {unit} ancho
                </span>
                <span className="robot-preview-label">
                    <strong>{robotLength.toFixed(1)}</strong> {unit} largo
                </span>
                {robotWheelOffset > 0 && (
                    <span className="robot-preview-label robot-preview-label--wheel">
                        <strong>{robotWheelOffset.toFixed(1)}</strong> {unit} a ruedas
                    </span>
                )}
            </div>
        </div>
    );
};

export default RobotSizePreview;
