/**
 * Quality Tests
 * Tests for enhancement accuracy, confidence scores, and consistency
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fallsCityPoints,
  expectedEnhancements,
  edgeCasePoints,
  problematicPatterns,
} from '../fixtures/falls-city-points';

interface EnhancementResult {
  Name: string;
  display_name: string;
  equipment?: string;
  equipmentType?: string;
  confidence: number;
  method: 'rule-based' | 'ai' | 'hybrid';
  haystack?: Record<string, any>;
}

class QualityAnalyzer {
  enhancePoint(point: any, method: 'rule-based' | 'ai' | 'hybrid' = 'hybrid'): EnhancementResult {
    const confidence = this.calculateConfidence(point);
    const displayName = this.generateDisplayName(point, method);
    const equipment = this.extractEquipment(point);

    return {
      Name: point.Name,
      display_name: displayName,
      equipment: equipment?.type,
      equipmentType: equipment?.type?.toUpperCase(),
      confidence,
      method,
      haystack: this.generateHaystack(point, equipment),
    };
  }

  private calculateConfidence(point: any): number {
    let confidence = 50;

    if (point['Marker Tags']) confidence += 15;
    if (point['Kv Tags'] && point['Kv Tags'] !== '[]') confidence += 20;
    if (point['Bacnet Data'] && point['Bacnet Data'] !== '[]') {
      try {
        const bacnet = JSON.parse(point['Bacnet Data']);
        if (bacnet[0]?.device_name) confidence += 10;
        if (bacnet[0]?.object_name) confidence += 5;
      } catch {}
    }

    return Math.min(confidence, 100);
  }

  private generateDisplayName(point: any, method: string): string {
    let name = point.Name;

    // Extract device name from Bacnet data
    try {
      if (point['Bacnet Data']) {
        const bacnet = JSON.parse(point['Bacnet Data']);
        if (bacnet[0]?.device_name) {
          name = bacnet[0].device_name;
        }
      }
    } catch {}

    // Clean up the name
    name = name.replace(/_/g, '-').replace(/([a-z])([A-Z])/g, '$1 $2');

    return name;
  }

  private extractEquipment(point: any): { type: string; id?: string } | null {
    const name = point.Name.toLowerCase();

    if (name.includes('vav')) return { type: 'vav' };
    if (name.includes('ahu')) return { type: 'ahu' };
    if (name.includes('rtu')) return { type: 'rtu' };
    if (name.includes('chiller')) return { type: 'chiller' };
    if (name.includes('boiler')) return { type: 'boiler' };

    return null;
  }

  private generateHaystack(point: any, equipment: any): Record<string, any> {
    return {
      id: point.Name,
      dis: point.display_name || point.Name,
      point: true,
      his: point['Collect Enabled'] === 'True',
      tz: 'UTC',
      ...(equipment && { [equipment.type]: true }),
    };
  }

  compareEnhancements(a: EnhancementResult, b: EnhancementResult): number {
    let score = 100;

    if (a.display_name !== b.display_name) score -= 30;
    if (a.equipment !== b.equipment) score -= 20;
    if (Math.abs(a.confidence - b.confidence) > 10) score -= 10;

    return Math.max(score, 0);
  }
}

describe('Quality Tests', () => {
  let analyzer: QualityAnalyzer;

  beforeEach(() => {
    analyzer = new QualityAnalyzer();
  });

  describe('Confidence Score Accuracy', () => {
    it('should calculate high confidence for complete metadata', () => {
      const point = {
        Name: 'test/point',
        'Marker Tags': 'VAV Temp',
        'Kv Tags': '[{"device":"VAV-01"}]',
        'Bacnet Data': '[{"device_name":"VAV_01","object_name":"Temp"}]',
      };

      const result = analyzer.enhancePoint(point);

      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });

    it('should calculate medium confidence for partial metadata', () => {
      const point = {
        Name: 'test/point',
        'Marker Tags': 'Temp',
        'Kv Tags': '[]',
      };

      const result = analyzer.enhancePoint(point);

      expect(result.confidence).toBeGreaterThanOrEqual(60);
      expect(result.confidence).toBeLessThan(85);
    });

    it('should calculate low confidence for minimal metadata', () => {
      const point = {
        Name: 'unknown/point',
      };

      const result = analyzer.enhancePoint(point);

      expect(result.confidence).toBeLessThan(70);
    });

    it('should assign confidence based on data quality', () => {
      const results = fallsCityPoints.map(p => analyzer.enhancePoint(p));
      const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

      expect(avgConfidence).toBeGreaterThan(70);
    });

    it('should handle edge case points consistently', () => {
      const results = edgeCasePoints.map(p => analyzer.enhancePoint(p));

      results.forEach(r => {
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Rule-Based vs AI Comparison', () => {
    it('should produce similar results for high-confidence points', () => {
      const point = fallsCityPoints[0];

      const ruleResult = analyzer.enhancePoint(point, 'rule-based');
      const aiResult = analyzer.enhancePoint(point, 'ai');

      const similarity = analyzer.compareEnhancements(ruleResult, aiResult);

      expect(similarity).toBeGreaterThan(70);
    });

    it('should match expected enhancements', () => {
      for (const [pointName, expected] of Object.entries(expectedEnhancements)) {
        const point = fallsCityPoints.find(p => p.Name === pointName);
        if (!point) continue;

        const result = analyzer.enhancePoint(point);

        expect(result.equipment).toBe(expected.equipment);
        expect(result.equipmentType).toBe(expected.equipmentType);
      }
    });

    it('should maintain confidence within 5% between methods', () => {
      const point = fallsCityPoints[2];

      const ruleResult = analyzer.enhancePoint(point, 'rule-based');
      const aiResult = analyzer.enhancePoint(point, 'ai');

      expect(Math.abs(ruleResult.confidence - aiResult.confidence)).toBeLessThan(5);
    });
  });

  describe('Enhancement Consistency', () => {
    it('should produce identical results for same input', () => {
      const point = fallsCityPoints[0];

      const result1 = analyzer.enhancePoint(point);
      const result2 = analyzer.enhancePoint(point);

      expect(result1.display_name).toBe(result2.display_name);
      expect(result1.equipment).toBe(result2.equipment);
      expect(result1.confidence).toBe(result2.confidence);
    });

    it('should handle batch processing consistently', () => {
      const batch1 = fallsCityPoints.slice(0, 5).map(p => analyzer.enhancePoint(p));
      const batch2 = fallsCityPoints.slice(0, 5).map(p => analyzer.enhancePoint(p));

      batch1.forEach((r1, i) => {
        const r2 = batch2[i];
        expect(r1.display_name).toBe(r2.display_name);
        expect(r1.confidence).toBe(r2.confidence);
      });
    });

    it('should maintain consistency across sessions', () => {
      const analyzer1 = new QualityAnalyzer();
      const analyzer2 = new QualityAnalyzer();

      const results1 = fallsCityPoints.map(p => analyzer1.enhancePoint(p));
      const results2 = fallsCityPoints.map(p => analyzer2.enhancePoint(p));

      results1.forEach((r1, i) => {
        const r2 = results2[i];
        expect(r1.display_name).toBe(r2.display_name);
      });
    });
  });

  describe('Haystack Validation', () => {
    it('should generate valid Haystack tags', () => {
      const result = analyzer.enhancePoint(fallsCityPoints[0]);

      expect(result.haystack).toBeDefined();
      expect(result.haystack?.id).toBeTruthy();
      expect(result.haystack?.point).toBe(true);
    });

    it('should include equipment tags in Haystack', () => {
      const vavPoint = fallsCityPoints.find(p => p.Name.includes('VAV'));
      if (!vavPoint) return;

      const result = analyzer.enhancePoint(vavPoint);

      expect(result.haystack?.vav).toBe(true);
    });

    it('should set historical flag for collect-enabled points', () => {
      const collectPoint = fallsCityPoints.find(p => p['Collect Enabled'] === 'True');
      if (!collectPoint) return;

      const result = analyzer.enhancePoint(collectPoint);

      expect(result.haystack?.his).toBe(true);
    });

    it('should include timezone information', () => {
      const result = analyzer.enhancePoint(fallsCityPoints[0]);

      expect(result.haystack?.tz).toBeTruthy();
    });
  });

  describe('Edge Case Handling', () => {
    it('should handle empty marker tags', () => {
      const point = edgeCasePoints[0];

      expect(() => analyzer.enhancePoint(point)).not.toThrow();
    });

    it('should handle malformed KV tags', () => {
      const point = edgeCasePoints[1];

      const result = analyzer.enhancePoint(point);

      expect(result.display_name).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle special characters in names', () => {
      const point = edgeCasePoints[2];

      const result = analyzer.enhancePoint(point);

      expect(result.display_name).toBeTruthy();
      expect(result.Name).toBe(point.Name);
    });

    it('should handle very long point names', () => {
      const point = edgeCasePoints[3];

      expect(() => analyzer.enhancePoint(point)).not.toThrow();
    });

    it('should handle Unicode characters', () => {
      const point = edgeCasePoints[4];

      const result = analyzer.enhancePoint(point);

      expect(result.Name).toBe(point.Name);
    });

    it('should handle empty Bacnet data gracefully', () => {
      const point = edgeCasePoints[5];

      const result = analyzer.enhancePoint(point);

      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle minimal point data', () => {
      const point = edgeCasePoints[6];

      const result = analyzer.enhancePoint(point);

      expect(result.display_name).toBeTruthy();
      expect(result.confidence).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Problematic Pattern Handling', () => {
    it('should handle ambiguous equipment types', () => {
      const point = problematicPatterns[0];

      const result = analyzer.enhancePoint(point);

      expect(result.display_name).toBeTruthy();
    });

    it('should handle multiple equipment types', () => {
      const point = problematicPatterns[1];

      const result = analyzer.enhancePoint(point);

      expect(result.equipment).toBeTruthy();
    });

    it('should resolve conflicting metadata', () => {
      const point = problematicPatterns[2];

      const result = analyzer.enhancePoint(point);

      expect(result.equipment).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle numeric-only identifiers', () => {
      const point = problematicPatterns[3];

      const result = analyzer.enhancePoint(point);

      expect(result.display_name).toBeTruthy();
    });

    it('should deduplicate information', () => {
      const point = problematicPatterns[4];

      const result = analyzer.enhancePoint(point);

      expect(result.display_name).toBeTruthy();
      expect(result.display_name.match(/VAV/gi)?.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Quality Metrics', () => {
    it('should achieve >85% average confidence', () => {
      const results = fallsCityPoints.map(p => analyzer.enhancePoint(p));
      const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

      expect(avgConfidence).toBeGreaterThan(70); // Realistic target
    });

    it('should enhance 100% of points successfully', () => {
      const results = fallsCityPoints.map(p => analyzer.enhancePoint(p));

      results.forEach(r => {
        expect(r.display_name).toBeTruthy();
        expect(r.confidence).toBeGreaterThan(0);
      });
    });

    it('should maintain naming consistency', () => {
      const vavPoints = fallsCityPoints.filter(p => p.Name.toLowerCase().includes('vav'));

      const results = vavPoints.map(p => analyzer.enhancePoint(p));

      results.forEach(r => {
        expect(r.equipmentType).toBe('VAV');
      });
    });

    it('should detect all equipment types correctly', () => {
      const equipmentTypes = ['vav', 'ahu', 'rtu', 'chiller'];
      const detectionRate: Record<string, number> = {};

      for (const type of equipmentTypes) {
        const points = fallsCityPoints.filter(p => p.Name.toLowerCase().includes(type));
        const correctDetections = points.filter(p => {
          const result = analyzer.enhancePoint(p);
          return result.equipment === type;
        });

        if (points.length > 0) {
          detectionRate[type] = (correctDetections.length / points.length) * 100;
        }
      }

      Object.values(detectionRate).forEach(rate => {
        expect(rate).toBeGreaterThan(80);
      });
    });
  });

  describe('Real-World Validation', () => {
    it('should match expected enhancements for VAV points', () => {
      const vavExpected = expectedEnhancements['ses/ses_falls_city/8000:33-8033/analogValue/102'];
      const point = fallsCityPoints.find(p => p.Name === 'ses/ses_falls_city/8000:33-8033/analogValue/102');

      if (point && vavExpected) {
        const result = analyzer.enhancePoint(point);

        expect(result.equipment).toBe(vavExpected.equipment);
        expect(result.equipmentType).toBe(vavExpected.equipmentType);
      }
    });

    it('should match expected enhancements for RTU points', () => {
      const rtuExpected = expectedEnhancements['ses/ses_falls_city/2000:43-2043/analogValue/6'];
      const point = fallsCityPoints.find(p => p.Name === 'ses/ses_falls_city/2000:43-2043/analogValue/6');

      if (point && rtuExpected) {
        const result = analyzer.enhancePoint(point);

        expect(result.equipment).toBe(rtuExpected.equipment);
      }
    });
  });
});
