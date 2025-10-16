/**
 * Mock Worker for Integration Testing
 *
 * This is a simplified version of the point enhancement logic
 * for testing the display_name enhancement workflow.
 */

/**
 * Formats a point name into a human-readable display name
 * @param {string} pointName - The original point name (e.g., "SURGERYCHILLER-Capacity")
 * @returns {string} The formatted display name (e.g., "SURGERYCHILLER Capacity")
 */
function formatDisplayName(pointName) {
  if (!pointName) return pointName;

  // Replace dashes with spaces
  let formatted = pointName.replace(/-/g, ' ');

  // Handle common abbreviations
  const abbreviations = {
    'SP': 'SP',
    'CHW': 'CHW',
    'CW': 'CW',
    'VAV': 'VAV',
    'AHU': 'AHU',
  };

  // Keep abbreviations intact
  Object.keys(abbreviations).forEach(abbr => {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    formatted = formatted.replace(regex, abbreviations[abbr]);
  });

  return formatted;
}

/**
 * Enhances a point with display_name field
 * @param {object} point - The original point object
 * @returns {object} The enhanced point with display_name
 */
function enhancePoint(point) {
  if (!point || !point.Name) return point;

  return {
    ...point,
    display_name: point.display_name || formatDisplayName(point.Name),
  };
}

/**
 * Enhances multiple points
 * @param {Array} points - Array of point objects
 * @returns {Array} Array of enhanced points
 */
function enhancePoints(points) {
  if (!Array.isArray(points)) return [];

  return points.map(point => enhancePoint(point));
}

module.exports = {
  formatDisplayName,
  enhancePoint,
  enhancePoints,
};
