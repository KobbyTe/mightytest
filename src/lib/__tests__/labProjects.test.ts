import { describe, it, expect } from 'vitest';
import { validateMainProject, validateSupporting, isScoreValid, LAB_CONFIG, INVALID_JSON_MESSAGE, storagePrefix } from '../labProjects';

const MB = 1024 * 1024;

describe('lab project file rules', () => {
  it('each lab requires its own extension', () => {
    expect(LAB_CONFIG.virtual_robotics.extension).toBe('.kodevr.json');
    expect(LAB_CONFIG.ai_lab.extension).toBe('.json');
    expect(LAB_CONFIG['3d_lab'].extension).toBe('.kvr');
  });

  it('robotics lab rejects a plain .json file', () => {
    expect(validateMainProject('robot.json', 10, '{}', 'virtual_robotics', 50 * MB).ok).toBe(false);
  });

  it('accepts a valid .kodevr.json project', () => {
    expect(validateMainProject('rescue_robot.kodevr.json', 10, '{"a":1}', 'virtual_robotics', 50 * MB)).toEqual({ ok: true, message: 'Valid KodeVR project' });
  });

  it('rejects malformed JSON with the export-again message', () => {
    expect(validateMainProject('model.json', 10, '{bad', 'ai_lab', 50 * MB)).toEqual({ ok: false, message: INVALID_JSON_MESSAGE });
  });

  it('3D lab accepts .kvr without parsing', () => {
    expect(validateMainProject('solar.kvr', 10, null, '3d_lab', 50 * MB).ok).toBe(true);
  });

  it('rejects files over the size limit', () => {
    expect(validateMainProject('solar.kvr', 51 * MB, null, '3d_lab', 50 * MB).ok).toBe(false);
  });

  it('rejects executable supporting files', () => {
    for (const n of ['run.exe', 'a.bat', 'x.sh', 'app.js', 'page.html', 'p.php']) {
      expect(validateSupporting(n, 10, 50 * MB).ok).toBe(false);
    }
    expect(validateSupporting('robot_front.png', 10, 50 * MB).ok).toBe(true);
    expect(validateSupporting('demo.mp4', 10, 50 * MB).ok).toBe(true);
  });
});

describe('scores', () => {
  it('score must be between 0 and max', () => {
    expect(isScoreValid(100, 100)).toBe(true);
    expect(isScoreValid(101, 100)).toBe(false);
    expect(isScoreValid(-1, 100)).toBe(false);
  });
});

describe('storage path', () => {
  it('is school/class/student/assignment/submission', () => {
    expect(storagePrefix({ school_id: 's', class_id: 'c', student_id: 'st', assignment_id: 'a', submission_id: 'sub' })).toBe('s/c/st/a/sub/');
  });
});
