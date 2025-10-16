/**
 * Test Suite for Enhanced Point Name Parser
 * Tests real-world examples from Falls City BMS
 */

const {
  extractEquipmentFromPath,
  generateDisplayName,
  enhancePointsBatch
} = require('../Building-Vitals/workers/enhanced-point-parser.js');

describe('Enhanced Point Parser - Falls City Examples', () => {

  describe('Real-world test cases', () => {

    test('S.FallsCity_CMC.Vav115.RoomTemp', () => {
      const result = extractEquipmentFromPath('S.FallsCity_CMC.Vav115.RoomTemp');

      expect(result.equipment).toBe('vav');
      expect(result.equipmentId).toBe('115');
      expect(result.displayName).toBe('VAV 115 Room Temperature');
      expect(result.unit).toBe('°F');
      expect(result.category).toBe('sensor');
      expect(result.confidence).toBeGreaterThan(80);
    });

    test('FallsCity_CMC/C.Drivers.BacnetNetwork.Net7000.Vav603.points.HeatSignal', () => {
      const result = extractEquipmentFromPath(
        'FallsCity_CMC/C.Drivers.BacnetNetwork.Net7000.Vav603.points.HeatSignal'
      );

      expect(result.equipment).toBe('vav');
      expect(result.equipmentId).toBe('603');
      expect(result.displayName).toBe('VAV 603 Heating Signal');
      expect(result.unit).toBe('%');
      expect(result.category).toBe('control');
      expect(result.confidence).toBeGreaterThan(80);
    });

    test('ses/ses_falls_city/Vav707.points.Damper', () => {
      const result = extractEquipmentFromPath('ses/ses_falls_city/Vav707.points.Damper');

      expect(result.equipment).toBe('vav');
      expect(result.equipmentId).toBe('707');
      expect(result.displayName).toBe('VAV 707 Damper Position');
      expect(result.unit).toBe('%');
      expect(result.category).toBe('actuator');
      expect(result.confidence).toBeGreaterThan(80);
    });

    test('BacnetNetwork.Rtu6_1.points.SaFanStatus', () => {
      const result = extractEquipmentFromPath('BacnetNetwork.Rtu6_1.points.SaFanStatus');

      expect(result.equipment).toBe('rtu');
      expect(result.equipmentId).toBe('6');
      expect(result.displayName).toBe('RTU 6 Supply Air Fan Status');
      expect(result.unit).toBe('on/off');
      expect(result.category).toBe('status');
      expect(result.confidence).toBeGreaterThan(80);
    });
  });

  describe('Equipment pattern matching', () => {

    test('VAV with single digit', () => {
      const result = extractEquipmentFromPath('Vav7.RoomTemp');

      expect(result.equipment).toBe('vav');
      expect(result.equipmentId).toBe('7');
      expect(result.equipmentDisplay).toBe('VAV 7');
    });

    test('VAV with hyphenated sub-ID', () => {
      const result = extractEquipmentFromPath('Vav707-1.points.Temp');

      expect(result.equipment).toBe('vav');
      expect(result.equipmentId).toBe('707');
      expect(result.equipmentDisplay).toContain('VAV 707');
    });

    test('RTU with underscore format', () => {
      const result = extractEquipmentFromPath('Rtu6_1.SaTemp');

      expect(result.equipment).toBe('rtu');
      expect(result.equipmentId).toBe('6');
      expect(result.equipmentDisplay).toContain('RTU 6');
    });

    test('AHU pattern', () => {
      const result = extractEquipmentFromPath('Ahu12.DischargeTemp');

      expect(result.equipment).toBe('ahu');
      expect(result.equipmentId).toBe('12');
      expect(result.displayName).toBe('AHU 12 Discharge Temperature');
    });

    test('Chiller pattern', () => {
      const result = extractEquipmentFromPath('CH1.ChwSupplyTemp');

      expect(result.equipment).toBe('chiller');
      expect(result.equipmentId).toBe('1');
      expect(result.displayName).toContain('Chiller');
    });

    test('Pump pattern (CHWP)', () => {
      const result = extractEquipmentFromPath('CHWP1.Status');

      expect(result.equipment).toBe('pump');
      expect(result.equipmentId).toBe('1');
      expect(result.displayName).toContain('CHW Pump');
    });
  });

  describe('Point type detection', () => {

    test('Temperature sensor', () => {
      const result = extractEquipmentFromPath('Vav100.RoomTemp');

      expect(result.unit).toBe('°F');
      expect(result.category).toBe('sensor');
      expect(result.pointType).toBe('temperature');
    });

    test('Temperature setpoint', () => {
      const result = extractEquipmentFromPath('Vav100.RoomTempSp');

      expect(result.unit).toBe('°F');
      expect(result.category).toBe('setpoint');
      expect(result.pointType).toBe('tempSetpoint');
    });

    test('Damper position', () => {
      const result = extractEquipmentFromPath('Vav100.DamperPos');

      expect(result.unit).toBe('%');
      expect(result.category).toBe('actuator');
      expect(result.pointType).toBe('damper');
    });

    test('Valve position', () => {
      const result = extractEquipmentFromPath('Vav100.ReheatValve');

      expect(result.unit).toBe('%');
      expect(result.category).toBe('actuator');
      expect(result.pointType).toBe('valve');
    });

    test('Control signal', () => {
      const result = extractEquipmentFromPath('Vav100.HeatSignal');

      expect(result.unit).toBe('%');
      expect(result.category).toBe('control');
      expect(result.pointType).toBe('signal');
    });

    test('Fan status (binary)', () => {
      const result = extractEquipmentFromPath('Rtu5.FanStatus');

      expect(result.unit).toBe('on/off');
      expect(result.category).toBe('status');
      expect(result.pointType).toBe('fanStatus');
    });

    test('Fan speed', () => {
      const result = extractEquipmentFromPath('Rtu5.FanSpd');

      expect(result.unit).toBe('%');
      expect(result.category).toBe('sensor');
      expect(result.pointType).toBe('fanSpeed');
    });

    test('Airflow - CFM', () => {
      const result = extractEquipmentFromPath('Ahu1.SaFlow');

      expect(result.unit).toBe('CFM');
      expect(result.category).toBe('sensor');
      expect(result.pointType).toBe('flow');
    });

    test('Water flow - GPM', () => {
      const result = extractEquipmentFromPath('CHWP1.ChwFlow');

      expect(result.unit).toBe('GPM');
      expect(result.category).toBe('sensor');
    });

    test('Air pressure', () => {
      const result = extractEquipmentFromPath('Ahu1.DuctPress');

      expect(result.unit).toBe('in.w.c.');
      expect(result.category).toBe('sensor');
    });

    test('Water pressure', () => {
      const result = extractEquipmentFromPath('CHWP1.ChwPress');

      expect(result.unit).toBe('psi');
      expect(result.category).toBe('sensor');
    });

    test('Humidity', () => {
      const result = extractEquipmentFromPath('Vav100.RH');

      expect(result.unit).toBe('%RH');
      expect(result.category).toBe('sensor');
    });

    test('CO2', () => {
      const result = extractEquipmentFromPath('Vav100.CO2');

      expect(result.unit).toBe('ppm');
      expect(result.category).toBe('sensor');
    });
  });

  describe('Abbreviation expansion', () => {

    test('Sa → Supply Air', () => {
      const result = extractEquipmentFromPath('Rtu1.SaTemp');

      expect(result.displayName).toContain('Supply Air');
    });

    test('Ra → Return Air', () => {
      const result = extractEquipmentFromPath('Ahu1.RaTemp');

      expect(result.displayName).toContain('Return Air');
    });

    test('Oa → Outside Air', () => {
      const result = extractEquipmentFromPath('Ahu1.OaDamper');

      expect(result.displayName).toContain('Outside Air');
    });

    test('Da → Discharge Air', () => {
      const result = extractEquipmentFromPath('Ahu1.DaTemp');

      expect(result.displayName).toContain('Discharge Air');
    });

    test('CHW → Chilled Water', () => {
      const result = extractEquipmentFromPath('CH1.ChwSupplyTemp');

      expect(result.displayName).toContain('Chilled Water');
    });

    test('HW → Hot Water', () => {
      const result = extractEquipmentFromPath('Boiler1.HwReturnTemp');

      expect(result.displayName).toContain('Hot Water');
    });

    test('Spd → Speed', () => {
      const result = extractEquipmentFromPath('Fan1.FanSpd');

      expect(result.displayName).toContain('Speed');
    });

    test('Pos → Position', () => {
      const result = extractEquipmentFromPath('Vav100.DamperPos');

      expect(result.displayName).toContain('Position');
    });

    test('Sts → Status', () => {
      const result = extractEquipmentFromPath('Pump1.RunSts');

      expect(result.displayName).toContain('Status');
    });
  });

  describe('Display name generation', () => {

    test('CamelCase splitting', () => {
      const result = extractEquipmentFromPath('Vav100.RoomTempSetpoint');

      expect(result.displayName).toMatch(/Room.*Temperature.*Setpoint/);
    });

    test('Multiple abbreviations', () => {
      const result = extractEquipmentFromPath('Ahu1.SaTempSp');

      expect(result.displayName).toContain('Supply Air');
      expect(result.displayName).toContain('Temperature');
      expect(result.displayName).toContain('Setpoint');
    });

    test('Equipment prefix included', () => {
      const result = extractEquipmentFromPath('Vav115.RoomTemp');

      expect(result.displayName).toMatch(/^VAV 115/);
    });

    test('Proper spacing', () => {
      const result = extractEquipmentFromPath('Rtu6.SaFanStatus');

      // Should not have double spaces
      expect(result.displayName).not.toMatch(/\s{2,}/);
      // Should have spaces between words
      expect(result.displayName.split(' ').length).toBeGreaterThan(3);
    });
  });

  describe('Confidence scoring', () => {

    test('High confidence - complete information', () => {
      const result = extractEquipmentFromPath('Vav115.points.RoomTemp');

      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test('Medium confidence - missing equipment ID', () => {
      const result = extractEquipmentFromPath('Vav.RoomTemp');

      expect(result.confidence).toBeGreaterThanOrEqual(60);
      expect(result.confidence).toBeLessThan(80);
    });

    test('Low confidence - minimal information', () => {
      const result = extractEquipmentFromPath('UnknownPoint');

      expect(result.confidence).toBeLessThan(60);
    });
  });

  describe('Edge cases', () => {

    test('Empty string', () => {
      const result = extractEquipmentFromPath('');

      expect(result.displayName).toBe('');
      expect(result.equipment).toBeNull();
    });

    test('Null input', () => {
      const result = extractEquipmentFromPath(null);

      expect(result.displayName).toBe('');
    });

    test('Undefined input', () => {
      const result = extractEquipmentFromPath(undefined);

      expect(result.displayName).toBe('');
    });

    test('No equipment pattern', () => {
      const result = extractEquipmentFromPath('JustAPointName');

      expect(result.equipment).toBeNull();
      expect(result.displayName).toBeTruthy();
    });

    test('Multiple slashes and dots', () => {
      const result = extractEquipmentFromPath('path/to/deep/Vav100.points.data.RoomTemp');

      expect(result.equipment).toBe('vav');
      expect(result.equipmentId).toBe('100');
      expect(result.pointName).toBeTruthy();
    });

    test('Special characters in path', () => {
      const result = extractEquipmentFromPath('Site-1/Building_A.Vav100.Room-Temp');

      expect(result.equipment).toBe('vav');
      expect(result.displayName).toContain('VAV 100');
    });
  });

  describe('Batch processing', () => {

    test('Process multiple points', () => {
      const points = [
        { Name: 'Vav115.RoomTemp' },
        { Name: 'Rtu6_1.SaFanStatus' },
        { Name: 'Vav707.Damper' },
        { Name: 'Ahu1.OaTemp' }
      ];

      const enhanced = enhancePointsBatch(points);

      expect(enhanced).toHaveLength(4);

      expect(enhanced[0].display_name).toBe('VAV 115 Room Temperature');
      expect(enhanced[0].equipment).toBe('vav');
      expect(enhanced[0].unit).toBe('°F');

      expect(enhanced[1].display_name).toContain('RTU 6');
      expect(enhanced[1].unit).toBe('on/off');

      expect(enhanced[2].display_name).toContain('Damper');
      expect(enhanced[2].unit).toBe('%');

      expect(enhanced[3].display_name).toContain('Outside Air');
      expect(enhanced[3].unit).toBe('°F');
    });

    test('Preserve original point data', () => {
      const points = [
        { Name: 'Vav100.RoomTemp', id: 'point-123', Site: 'Falls City' }
      ];

      const enhanced = enhancePointsBatch(points);

      expect(enhanced[0].id).toBe('point-123');
      expect(enhanced[0].Site).toBe('Falls City');
      expect(enhanced[0].Name).toBe('Vav100.RoomTemp');
      expect(enhanced[0]._enhanced).toBe(true);
    });

    test('Handle empty array', () => {
      const enhanced = enhancePointsBatch([]);

      expect(enhanced).toHaveLength(0);
    });

    test('Handle invalid input', () => {
      const enhanced = enhancePointsBatch(null);

      expect(enhanced).toHaveLength(0);
    });
  });

  describe('Complex real-world paths', () => {

    test('Deep nested path with network prefix', () => {
      const result = extractEquipmentFromPath(
        'S.FallsCity_CMC/C.Drivers.BacnetNetwork.Net7000.Mstp5000.Vav201.points.RoomTempSp'
      );

      expect(result.equipment).toBe('vav');
      expect(result.equipmentId).toBe('201');
      expect(result.displayName).toContain('VAV 201');
      expect(result.displayName).toContain('Setpoint');
    });

    test('Site prefix with equipment in middle', () => {
      const result = extractEquipmentFromPath(
        'ses/ses_falls_city/equipment/Ahu3/sensors/DaTemp'
      );

      expect(result.equipment).toBe('ahu');
      expect(result.equipmentId).toBe('3');
      expect(result.displayName).toContain('AHU 3');
      expect(result.displayName).toContain('Discharge Air');
    });

    test('Multiple equipment references (take first)', () => {
      const result = extractEquipmentFromPath(
        'Ahu5.Vav100.RoomTemp'
      );

      // Should prioritize first equipment found
      expect(result.equipment).toBe('ahu');
      expect(result.equipmentId).toBe('5');
    });
  });
});

describe('Display Name Generation Standalone', () => {

  test('Simple point name', () => {
    const name = generateDisplayName('RoomTemp', { type: 'vav', id: '100', display: 'VAV 100' });

    expect(name).toBe('VAV 100 Room Temperature');
  });

  test('Complex abbreviations', () => {
    const name = generateDisplayName('SaTempSp', { type: 'ahu', id: '1', display: 'AHU 1' });

    expect(name).toContain('Supply Air');
    expect(name).toContain('Temperature');
    expect(name).toContain('Setpoint');
  });

  test('Without equipment', () => {
    const name = generateDisplayName('DamperPos', null);

    expect(name).toContain('Damper');
    expect(name).toContain('Position');
  });
});
