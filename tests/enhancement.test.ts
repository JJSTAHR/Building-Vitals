/**
 * Enhancement Logic Tests
 * Tests for AI enhancement, KV fallback, and client-side pattern matching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock types matching the application
interface Point {
  Name: string;
  display_name?: string;
  kv_tags?: string;
  Type?: string;
  Unit?: string;
}

interface EnhancementResult {
  success: boolean;
  enhancedPoints: Point[];
  method: 'ai' | 'kv' | 'pattern' | 'none';
  error?: string;
}

// Mock enhancement functions
const enhanceWithAI = async (points: Point[]): Promise<EnhancementResult> => {
  // Simulates Cloudflare Worker AI enhancement
  const response = await fetch('/api/enhance-points', {
    method: 'POST',
    body: JSON.stringify({ points })
  });

  if (!response.ok) {
    throw new Error('AI enhancement failed');
  }

  const data = await response.json();
  return {
    success: true,
    enhancedPoints: data.points,
    method: 'ai'
  };
};

const enhanceWithKV = (points: Point[]): EnhancementResult => {
  const enhancedPoints = points.map(point => {
    if (point.kv_tags) {
      try {
        const tags = JSON.parse(point.kv_tags);
        return {
          ...point,
          display_name: tags.display_name || point.Name
        };
      } catch {
        return point;
      }
    }
    return point;
  });

  return {
    success: true,
    enhancedPoints,
    method: 'kv'
  };
};

const enhanceWithPattern = (points: Point[]): EnhancementResult => {
  const enhancedPoints = points.map(point => {
    let displayName = point.Name;

    // Pattern: Vav707.points.Damper → VAV-707 Damper Position
    displayName = displayName.replace(/Vav(\d+)\.points\.(\w+)/i, 'VAV-$1 $2 Position');

    // Pattern: Rtu6_1.points.SaFanStatus → RTU-6 Supply Air Fan Status
    displayName = displayName.replace(/Rtu(\d+)_\d+\.points\.(\w+)/i, (match, num, prop) => {
      const readable = prop
        .replace(/([A-Z])/g, ' $1')
        .replace(/^Sa/, 'Supply Air')
        .replace(/^Ra/, 'Return Air')
        .replace(/Status$/, 'Status')
        .trim();
      return `RTU-${num} ${readable}`;
    });

    // Pattern: Ahu1.points.DaTemp → AHU-1 Discharge Air Temperature
    displayName = displayName.replace(/Ahu(\d+)\.points\.(\w+)/i, (match, num, prop) => {
      const readable = prop
        .replace(/([A-Z])/g, ' $1')
        .replace(/^Da/, 'Discharge Air')
        .replace(/^Ma/, 'Mixed Air')
        .replace(/Temp$/, 'Temperature')
        .replace(/Pres$/, 'Pressure')
        .trim();
      return `AHU-${num} ${readable}`;
    });

    return {
      ...point,
      display_name: displayName !== point.Name ? displayName : point.Name
    };
  });

  return {
    success: true,
    enhancedPoints,
    method: 'pattern'
  };
};

const enhancePoints = async (points: Point[]): Promise<EnhancementResult> => {
  // Try AI enhancement first
  try {
    return await enhanceWithAI(points);
  } catch (aiError) {
    console.warn('AI enhancement failed, trying KV fallback', aiError);

    // Try KV tags fallback
    const kvResult = enhanceWithKV(points);
    const hasKVEnhancements = kvResult.enhancedPoints.some(p => p.display_name && p.display_name !== p.Name);

    if (hasKVEnhancements) {
      return kvResult;
    }

    // Fall back to pattern matching
    const patternResult = enhanceWithPattern(points);
    return patternResult;
  }
};

describe('Enhancement Logic Tests', () => {
  describe('AI Enhancement via Cloudflare Worker', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should enhance points using AI service', async () => {
      const mockPoints: Point[] = [
        { Name: 'ses/ses_falls_city/Vav707.points.Damper' },
        { Name: 'Rtu6_1.points.SaFanStatus' }
      ];

      const mockResponse = {
        points: [
          {
            Name: 'ses/ses_falls_city/Vav707.points.Damper',
            display_name: 'VAV-707 Damper Position'
          },
          {
            Name: 'Rtu6_1.points.SaFanStatus',
            display_name: 'RTU-6 Supply Air Fan Status'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await enhancePoints(mockPoints);

      expect(result.success).toBe(true);
      expect(result.method).toBe('ai');
      expect(result.enhancedPoints[0].Name).toBe('ses/ses_falls_city/Vav707.points.Damper');
      expect(result.enhancedPoints[0].display_name).toBe('VAV-707 Damper Position');
      expect(result.enhancedPoints[1].display_name).toBe('RTU-6 Supply Air Fan Status');
    });

    it('should preserve original names in point.Name', async () => {
      const mockPoints: Point[] = [
        { Name: 'original/path/Point.Name' }
      ];

      const mockResponse = {
        points: [
          {
            Name: 'original/path/Point.Name',
            display_name: 'Human Readable Name'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await enhancePoints(mockPoints);

      expect(result.enhancedPoints[0].Name).toBe('original/path/Point.Name');
      expect(result.enhancedPoints[0].display_name).toBe('Human Readable Name');
      expect(result.enhancedPoints[0].Name).not.toBe(result.enhancedPoints[0].display_name);
    });

    it('should handle AI service errors gracefully', async () => {
      const mockPoints: Point[] = [
        { Name: 'test.point.Name' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await enhancePoints(mockPoints);

      // Should fall back to other methods
      expect(result.success).toBe(true);
      expect(result.method).not.toBe('ai');
    });

    it('should handle network timeouts', async () => {
      const mockPoints: Point[] = [
        { Name: 'test.point.Name' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('Network timeout'));

      const result = await enhancePoints(mockPoints);

      expect(result.success).toBe(true);
      expect(result.method).toBe('pattern'); // Falls back to pattern
    });
  });

  describe('KV Tag Parsing Fallback', () => {
    it('should parse valid KV tags', () => {
      const mockPoints: Point[] = [
        {
          Name: 'ses/ses_falls_city/Vav707.points.Damper',
          kv_tags: '{"display_name": "VAV-707 Damper Position", "type": "analog"}'
        }
      ];

      const result = enhanceWithKV(mockPoints);

      expect(result.success).toBe(true);
      expect(result.method).toBe('kv');
      expect(result.enhancedPoints[0].display_name).toBe('VAV-707 Damper Position');
      expect(result.enhancedPoints[0].Name).toBe('ses/ses_falls_city/Vav707.points.Damper');
    });

    it('should handle missing KV tags', () => {
      const mockPoints: Point[] = [
        { Name: 'test.point.Name' }
      ];

      const result = enhanceWithKV(mockPoints);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0]).toEqual(mockPoints[0]);
    });

    it('should handle malformed KV tags', () => {
      const mockPoints: Point[] = [
        {
          Name: 'test.point.Name',
          kv_tags: 'invalid json {'
        }
      ];

      const result = enhanceWithKV(mockPoints);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0]).toEqual(mockPoints[0]);
    });

    it('should handle KV tags without display_name', () => {
      const mockPoints: Point[] = [
        {
          Name: 'test.point.Name',
          kv_tags: '{"type": "analog", "unit": "F"}'
        }
      ];

      const result = enhanceWithKV(mockPoints);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0].display_name).toBeUndefined();
    });
  });

  describe('Client-Side Pattern Fallback', () => {
    it('should enhance VAV points using pattern matching', () => {
      const mockPoints: Point[] = [
        { Name: 'Vav707.points.Damper' },
        { Name: 'Vav101.points.ZoneTemp' },
        { Name: 'vav205.points.Setpoint' }
      ];

      const result = enhanceWithPattern(mockPoints);

      expect(result.success).toBe(true);
      expect(result.method).toBe('pattern');
      expect(result.enhancedPoints[0].display_name).toBe('VAV-707 Damper Position');
      expect(result.enhancedPoints[1].display_name).toBe('VAV-101 ZoneTemp Position');
      expect(result.enhancedPoints[2].display_name).toBe('VAV-205 Setpoint Position');
    });

    it('should enhance RTU points using pattern matching', () => {
      const mockPoints: Point[] = [
        { Name: 'Rtu6_1.points.SaFanStatus' },
        { Name: 'Rtu3_2.points.RaTemp' }
      ];

      const result = enhanceWithPattern(mockPoints);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0].display_name).toBe('RTU-6 Supply Air Fan Status');
      expect(result.enhancedPoints[1].display_name).toBe('RTU-3 Return Air Temp');
    });

    it('should enhance AHU points using pattern matching', () => {
      const mockPoints: Point[] = [
        { Name: 'Ahu1.points.DaTemp' },
        { Name: 'Ahu2.points.MaPres' }
      ];

      const result = enhanceWithPattern(mockPoints);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0].display_name).toBe('AHU-1 Discharge Air Temperature');
      expect(result.enhancedPoints[1].display_name).toBe('AHU-2 Mixed Air Pressure');
    });

    it('should preserve unmatched point names', () => {
      const mockPoints: Point[] = [
        { Name: 'unknown.format.point' }
      ];

      const result = enhanceWithPattern(mockPoints);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0].display_name).toBe('unknown.format.point');
    });

    it('should handle special characters in point names', () => {
      const mockPoints: Point[] = [
        { Name: 'Vav-707.points.Damper$Position' },
        { Name: 'Site/Building/Vav707.points.Damper' }
      ];

      const result = enhanceWithPattern(mockPoints);

      expect(result.success).toBe(true);
      // Should not crash, returns original or partial enhancement
      expect(result.enhancedPoints[0].Name).toBeDefined();
      expect(result.enhancedPoints[1].Name).toBeDefined();
    });
  });

  describe('Enhancement Failure Handling', () => {
    it('should cascade through fallback methods', async () => {
      const mockPoints: Point[] = [
        { Name: 'Vav707.points.Damper' }
      ];

      // Mock AI failure
      (global.fetch as any).mockRejectedValueOnce(new Error('AI service down'));

      const result = await enhancePoints(mockPoints);

      // Should fall back to pattern matching
      expect(result.success).toBe(true);
      expect(result.method).toBe('pattern');
      expect(result.enhancedPoints[0].display_name).toBe('VAV-707 Damper Position');
    });

    it('should use KV tags when available after AI failure', async () => {
      const mockPoints: Point[] = [
        {
          Name: 'test.point.Name',
          kv_tags: '{"display_name": "KV Enhanced Name"}'
        }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service down'));

      const result = await enhancePoints(mockPoints);

      expect(result.success).toBe(true);
      expect(result.method).toBe('kv');
      expect(result.enhancedPoints[0].display_name).toBe('KV Enhanced Name');
    });

    it('should always preserve original Name field', async () => {
      const mockPoints: Point[] = [
        { Name: 'critical/system/point.Name' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('All enhancements fail'));

      const result = await enhancePoints(mockPoints);

      expect(result.enhancedPoints[0].Name).toBe('critical/system/point.Name');
    });
  });

  describe('Data Preservation', () => {
    it('should preserve all original point properties', async () => {
      const mockPoints: Point[] = [
        {
          Name: 'test.point.Name',
          Type: 'analog',
          Unit: 'degF',
          kv_tags: '{"custom": "data"}'
        }
      ];

      const mockResponse = {
        points: [
          {
            Name: 'test.point.Name',
            display_name: 'Test Point'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await enhancePoints(mockPoints);

      expect(result.enhancedPoints[0].Name).toBe('test.point.Name');
      expect(result.enhancedPoints[0].Type).toBe('analog');
      expect(result.enhancedPoints[0].Unit).toBe('degF');
      expect(result.enhancedPoints[0].kv_tags).toBe('{"custom": "data"}');
      expect(result.enhancedPoints[0].display_name).toBe('Test Point');
    });

    it('should handle batch enhancement correctly', async () => {
      const mockPoints: Point[] = [
        { Name: 'point1' },
        { Name: 'point2' },
        { Name: 'point3' }
      ];

      const mockResponse = {
        points: mockPoints.map((p, i) => ({
          ...p,
          display_name: `Enhanced ${i + 1}`
        }))
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await enhancePoints(mockPoints);

      expect(result.enhancedPoints).toHaveLength(3);
      result.enhancedPoints.forEach((point, i) => {
        expect(point.Name).toBe(`point${i + 1}`);
        expect(point.display_name).toBe(`Enhanced ${i + 1}`);
      });
    });
  });

  describe('Real-World Examples', () => {
    it('should handle SES Falls City VAV points', async () => {
      const mockPoints: Point[] = [
        { Name: 'ses/ses_falls_city/Vav707.points.Damper' },
        { Name: 'ses/ses_falls_city/Vav101.points.ZoneTemp' }
      ];

      const result = enhanceWithPattern(mockPoints);

      expect(result.enhancedPoints[0].Name).toBe('ses/ses_falls_city/Vav707.points.Damper');
      expect(result.enhancedPoints[0].display_name).toContain('VAV-707');
      expect(result.enhancedPoints[0].display_name).toContain('Damper');
    });

    it('should handle RTU points with complex naming', async () => {
      const mockPoints: Point[] = [
        { Name: 'Rtu6_1.points.SaFanStatus' },
        { Name: 'Rtu12_3.points.RaDamperCmd' }
      ];

      const result = enhanceWithPattern(mockPoints);

      expect(result.enhancedPoints[0].display_name).toContain('RTU-6');
      expect(result.enhancedPoints[0].display_name).toContain('Supply Air');
      expect(result.enhancedPoints[0].display_name).toContain('Status');
      expect(result.enhancedPoints[1].display_name).toContain('RTU-12');
    });
  });
});
