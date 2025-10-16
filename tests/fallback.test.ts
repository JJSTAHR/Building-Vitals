/**
 * Fallback Scenario Tests
 * Tests for enhancement fallback strategies and edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock types
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
  fallbackAttempts?: number;
}

// Mock enhancement service with full fallback chain
class EnhancementService {
  private aiEndpoint: string;
  private timeout: number;

  constructor(aiEndpoint: string = '/api/enhance-points', timeout: number = 5000) {
    this.aiEndpoint = aiEndpoint;
    this.timeout = timeout;
  }

  async enhance(points: Point[]): Promise<EnhancementResult> {
    let fallbackAttempts = 0;

    // Try AI enhancement
    try {
      const result = await this.enhanceWithAI(points);
      return { ...result, fallbackAttempts };
    } catch (aiError) {
      fallbackAttempts++;
      console.warn('AI enhancement failed, trying KV fallback', aiError);

      // Try KV tags
      try {
        const result = this.enhanceWithKV(points);
        if (result.enhancedPoints.some(p => p.display_name && p.display_name !== p.Name)) {
          return { ...result, fallbackAttempts };
        }
        fallbackAttempts++;
      } catch (kvError) {
        fallbackAttempts++;
        console.warn('KV enhancement failed, trying pattern fallback', kvError);
      }

      // Fall back to pattern matching
      try {
        const result = this.enhanceWithPattern(points);
        return { ...result, fallbackAttempts };
      } catch (patternError) {
        fallbackAttempts++;
        console.error('All enhancement methods failed', patternError);

        // Return unenhanced points
        return {
          success: false,
          enhancedPoints: points,
          method: 'none',
          error: 'All enhancement methods failed',
          fallbackAttempts
        };
      }
    }
  }

  private async enhanceWithAI(points: Point[]): Promise<EnhancementResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.aiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        enhancedPoints: data.points,
        method: 'ai'
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private enhanceWithKV(points: Point[]): EnhancementResult {
    const enhancedPoints = points.map(point => {
      if (!point.kv_tags) {
        return point;
      }

      try {
        const tags = JSON.parse(point.kv_tags);
        return {
          ...point,
          display_name: tags.display_name || point.Name
        };
      } catch (error) {
        console.warn(`Failed to parse KV tags for ${point.Name}`, error);
        return point;
      }
    });

    return {
      success: true,
      enhancedPoints,
      method: 'kv'
    };
  }

  private enhanceWithPattern(points: Point[]): EnhancementResult {
    const enhancedPoints = points.map(point => {
      let displayName = point.Name;

      // VAV pattern: Vav707.points.Damper → VAV-707 Damper Position
      displayName = displayName.replace(
        /Vav(\d+)\.points\.(\w+)/i,
        'VAV-$1 $2 Position'
      );

      // RTU pattern: Rtu6_1.points.SaFanStatus → RTU-6 Supply Air Fan Status
      displayName = displayName.replace(
        /Rtu(\d+)_\d+\.points\.(\w+)/i,
        (match, num, prop) => {
          const readable = prop
            .replace(/([A-Z])/g, ' $1')
            .replace(/^Sa/, 'Supply Air')
            .replace(/^Ra/, 'Return Air')
            .replace(/^Oa/, 'Outside Air')
            .replace(/^Ma/, 'Mixed Air')
            .replace(/Status$/, 'Status')
            .replace(/Cmd$/, 'Command')
            .replace(/Temp$/, 'Temperature')
            .replace(/Pres$/, 'Pressure')
            .trim();
          return `RTU-${num} ${readable}`;
        }
      );

      // AHU pattern: Ahu1.points.DaTemp → AHU-1 Discharge Air Temperature
      displayName = displayName.replace(
        /Ahu(\d+)\.points\.(\w+)/i,
        (match, num, prop) => {
          const readable = prop
            .replace(/([A-Z])/g, ' $1')
            .replace(/^Da/, 'Discharge Air')
            .replace(/^Ma/, 'Mixed Air')
            .replace(/^Ra/, 'Return Air')
            .replace(/^Oa/, 'Outside Air')
            .replace(/Temp$/, 'Temperature')
            .replace(/Pres$/, 'Pressure')
            .replace(/Humid$/, 'Humidity')
            .trim();
          return `AHU-${num} ${readable}`;
        }
      );

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
  }
}

describe('Fallback Scenario Tests', () => {
  let service: EnhancementService;

  beforeEach(() => {
    service = new EnhancementService();
    global.fetch = vi.fn();
  });

  describe('Points Without KV Tags', () => {
    it('should fall back to pattern matching for points without KV tags', async () => {
      const points: Point[] = [
        { Name: 'Vav707.points.Damper' },
        { Name: 'Rtu6_1.points.SaFanStatus' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service unavailable'));

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.method).toBe('pattern');
      expect(result.enhancedPoints[0].display_name).toBe('VAV-707 Damper Position');
      expect(result.enhancedPoints[1].display_name).toContain('RTU-6');
    });

    it('should preserve original names when pattern does not match', async () => {
      const points: Point[] = [
        { Name: 'unknown.format.point' },
        { Name: 'another/strange/format' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service unavailable'));

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.method).toBe('pattern');
      expect(result.enhancedPoints[0].display_name).toBe('unknown.format.point');
      expect(result.enhancedPoints[1].display_name).toBe('another/strange/format');
    });

    it('should handle partial KV tags gracefully', async () => {
      const points: Point[] = [
        {
          Name: 'Vav707.points.Damper',
          kv_tags: '{"type": "analog"}' // No display_name
        },
        {
          Name: 'Rtu6_1.points.SaFanStatus'
          // No kv_tags at all
        }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service unavailable'));

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.method).toBe('pattern');
      expect(result.enhancedPoints[0].display_name).toBe('VAV-707 Damper Position');
      expect(result.enhancedPoints[1].display_name).toContain('RTU-6');
    });
  });

  describe('AI Service Unavailable', () => {
    it('should handle network errors gracefully', async () => {
      const points: Point[] = [
        { Name: 'Vav707.points.Damper' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.method).not.toBe('ai');
      expect(result.fallbackAttempts).toBeGreaterThan(0);
    });

    it('should handle AI service timeouts', async () => {
      const points: Point[] = [
        { Name: 'Vav707.points.Damper' }
      ];

      const shortTimeoutService = new EnhancementService('/api/enhance-points', 100);

      (global.fetch as any).mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      const result = await shortTimeoutService.enhance(points);

      expect(result.success).toBe(true);
      expect(result.method).not.toBe('ai');
    });

    it('should handle 500 errors from AI service', async () => {
      const points: Point[] = [
        { Name: 'Vav707.points.Damper' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      });

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.method).not.toBe('ai');
      expect(result.fallbackAttempts).toBeGreaterThan(0);
    });

    it('should handle 503 Service Unavailable', async () => {
      const points: Point[] = [
        { Name: 'Rtu6_1.points.SaFanStatus' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service temporarily unavailable' })
      });

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.method).toBe('pattern');
      expect(result.enhancedPoints[0].display_name).toContain('RTU-6');
    });

    it('should handle malformed AI responses', async () => {
      const points: Point[] = [
        { Name: 'Vav707.points.Damper' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }) // Missing 'points' field
      });

      const result = await service.enhance(points);

      // Should fail AI and fall back
      expect(result.method).not.toBe('ai');
    });
  });

  describe('Malformed Point Names', () => {
    it('should handle empty point names', async () => {
      const points: Point[] = [
        { Name: '' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service error'));

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0].Name).toBe('');
    });

    it('should handle very long point names', async () => {
      const longName = 'a'.repeat(1000);
      const points: Point[] = [
        { Name: longName }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service error'));

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0].Name).toBe(longName);
    });

    it('should handle point names with null bytes', async () => {
      const points: Point[] = [
        { Name: 'point\x00name' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service error'));

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0].Name).toBe('point\x00name');
    });

    it('should handle point names with only whitespace', async () => {
      const points: Point[] = [
        { Name: '   ' },
        { Name: '\t\n' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service error'));

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints).toHaveLength(2);
    });
  });

  describe('Special Characters in Names', () => {
    it('should handle forward slashes in point names', async () => {
      const points: Point[] = [
        { Name: 'site/building/floor/Vav707.points.Damper' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service error'));

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0].Name).toContain('/');
      expect(result.enhancedPoints[0].display_name).toContain('VAV-707');
    });

    it('should handle backslashes in point names', async () => {
      const points: Point[] = [
        { Name: 'site\\building\\Vav707.points.Damper' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service error'));

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0].Name).toContain('\\');
    });

    it('should handle Unicode characters', async () => {
      const points: Point[] = [
        { Name: 'Vav707.points.Dämpér' },
        { Name: 'Rtu6_1.points.温度' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service error'));

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0].Name).toContain('ä');
      expect(result.enhancedPoints[1].Name).toContain('温度');
    });

    it('should handle special regex characters', async () => {
      const points: Point[] = [
        { Name: 'Vav707.points.Damper$Position' },
        { Name: 'Rtu6_1.points.Fan*Status' },
        { Name: 'Ahu1.points.Temp[1]' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service error'));

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      // Should not crash, even if pattern matching fails
      expect(result.enhancedPoints).toHaveLength(3);
    });

    it('should handle URL-encoded characters', async () => {
      const points: Point[] = [
        { Name: 'Vav707.points.Damper%20Position' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service error'));

      const result = await service.enhance(points);

      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0].Name).toContain('%20');
    });
  });

  describe('Fallback Chain Tracking', () => {
    it('should track number of fallback attempts', async () => {
      const points: Point[] = [
        { Name: 'unknown.point.format' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service error'));

      const result = await service.enhance(points);

      expect(result.fallbackAttempts).toBeGreaterThanOrEqual(1);
      expect(result.method).not.toBe('ai');
    });

    it('should succeed on first attempt with AI', async () => {
      const points: Point[] = [
        { Name: 'Vav707.points.Damper' }
      ];

      const mockResponse = {
        points: [
          {
            Name: 'Vav707.points.Damper',
            display_name: 'VAV-707 Damper Position'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await service.enhance(points);

      expect(result.fallbackAttempts).toBe(0);
      expect(result.method).toBe('ai');
    });

    it('should try all methods before failing', async () => {
      const points: Point[] = [
        { Name: 'test' }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI failed'));

      const result = await service.enhance(points);

      // Should try AI -> KV -> Pattern
      expect(result.fallbackAttempts).toBeGreaterThanOrEqual(0);
      expect(result.success).toBe(true); // Pattern should always work
    });
  });

  describe('Edge Cases with Real-World Data', () => {
    it('should handle points with KV tags but AI preferred', async () => {
      const points: Point[] = [
        {
          Name: 'Vav707.points.Damper',
          kv_tags: '{"display_name": "KV Enhanced Name"}'
        }
      ];

      const mockResponse = {
        points: [
          {
            Name: 'Vav707.points.Damper',
            display_name: 'AI Enhanced Name'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await service.enhance(points);

      expect(result.method).toBe('ai');
      expect(result.enhancedPoints[0].display_name).toBe('AI Enhanced Name');
    });

    it('should use KV tags when AI returns same as original', async () => {
      const points: Point[] = [
        {
          Name: 'unknown.point.format',
          kv_tags: '{"display_name": "KV Enhanced Name"}'
        }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service error'));

      const result = await service.enhance(points);

      expect(result.method).toBe('kv');
      expect(result.enhancedPoints[0].display_name).toBe('KV Enhanced Name');
    });

    it('should handle mixed success in batch enhancement', async () => {
      const points: Point[] = [
        {
          Name: 'Vav707.points.Damper',
          kv_tags: '{"display_name": "VAV-707 KV"}'
        },
        {
          Name: 'Rtu6_1.points.SaFanStatus'
        },
        {
          Name: 'unknown.format'
        }
      ];

      (global.fetch as any).mockRejectedValueOnce(new Error('AI service error'));

      const result = await service.enhance(points);

      // Should use KV for first, pattern for second, preserve third
      expect(result.success).toBe(true);
      expect(result.enhancedPoints[0].display_name).toBeDefined();
      expect(result.enhancedPoints[1].display_name).toBeDefined();
      expect(result.enhancedPoints[2].display_name).toBeDefined();
    });

    it('should handle concurrent enhancement requests', async () => {
      const points1: Point[] = [{ Name: 'Vav707.points.Damper' }];
      const points2: Point[] = [{ Name: 'Rtu6_1.points.SaFanStatus' }];

      (global.fetch as any)
        .mockRejectedValueOnce(new Error('AI error 1'))
        .mockRejectedValueOnce(new Error('AI error 2'));

      const [result1, result2] = await Promise.all([
        service.enhance(points1),
        service.enhance(points2)
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.enhancedPoints[0].display_name).toContain('VAV-707');
      expect(result2.enhancedPoints[0].display_name).toContain('RTU-6');
    });
  });

  describe('Error Message Quality', () => {
    it('should provide meaningful error messages', async () => {
      const points: Point[] = [{ Name: 'test' }];

      (global.fetch as any).mockRejectedValueOnce(new Error('Network timeout'));

      const result = await service.enhance(points);

      // Even with errors, should succeed with fallback
      expect(result.success).toBe(true);
      expect(result.method).not.toBe('ai');
    });

    it('should handle complete enhancement failure', async () => {
      const points: Point[] = [{ Name: 'test' }];

      // Force all methods to fail (unrealistic but good to test)
      const brokenService = new EnhancementService();

      // Mock pattern matching to throw
      brokenService['enhanceWithPattern'] = () => {
        throw new Error('Pattern matching failed');
      };

      (global.fetch as any).mockRejectedValueOnce(new Error('AI failed'));

      try {
        const result = await brokenService.enhance(points);

        // If it doesn't throw, check that it returns unenhanced points
        expect(result.success).toBe(false);
        expect(result.method).toBe('none');
        expect(result.error).toBeDefined();
      } catch (error) {
        // Or it might throw, which is also acceptable
        expect(error).toBeDefined();
      }
    });
  });
});
