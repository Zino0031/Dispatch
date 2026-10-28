import { describe, it, expect, beforeEach } from '@jest/globals';
import { JobStore } from './jobStore';

describe('JobStore', () => {
  let store: JobStore;

  beforeEach(() => {
    store = new JobStore();
  });

  describe('create', () => {
    it('should create a job with a UUID printJobId and random access token', () => {
      const job = store.create({
        kioskId: 'kiosk-1',
        fileUrl: 'https://example.com/file.pdf',
        copies: 1,
        color: 'bw',
        duplex: false,
      });

      expect(job.printJobId).toMatch(/^[0-9a-f-]{36}$/);
      expect(job.accessToken).toMatch(/^[0-9a-f]{48}$/);
      expect(job.kioskId).toBe('kiosk-1');
      expect(job.copies).toBe(1);
      expect(job.color).toBe('bw');
      expect(job.duplex).toBe(false);
      expect(job.status).toBe('QUEUED');
      expect(job.createdAt).toBeDefined();
      expect(job.updatedAt).toBeDefined();
      expect(job.history).toHaveLength(1);
      expect(job.history[0].status).toBe('QUEUED');
    });

    it('should store the job so it can be retrieved', () => {
      const job = store.create({
        kioskId: 'kiosk-1',
        fileUrl: 'https://example.com/file.pdf',
        copies: 2,
        color: 'color',
        duplex: true,
      });

      const fetched = store.get(job.printJobId);
      expect(fetched).toBeDefined();
      expect(fetched.printJobId).toBe(job.printJobId);
      expect(fetched.copies).toBe(2);
    });
  });

  describe('get', () => {
    it('should return undefined for a nonexistent job', () => {
      expect(store.get('nonexistent-id')).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should return jobs sorted by createdAt descending', () => {
      const job1 = store.create({
        kioskId: 'kiosk-1',
        fileUrl: 'https://example.com/file1.pdf',
        copies: 1,
        color: 'bw',
        duplex: false,
      });
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy wait
      }
      const job2 = store.create({
        kioskId: 'kiosk-2',
        fileUrl: 'https://example.com/file2.pdf',
        copies: 1,
        color: 'color',
        duplex: false,
      });

      const list = store.list();
      expect(list[0].printJobId).toBe(job2.printJobId);
      expect(list[1].printJobId).toBe(job1.printJobId);
    });

    it('should return an empty array when no jobs exist', () => {
      expect(store.list()).toEqual([]);
    });
  });

  describe('canAccess', () => {
    it('should return true for a valid token', () => {
      const job = store.create({
        kioskId: 'kiosk-1',
        fileUrl: 'https://example.com/file.pdf',
        copies: 1,
        color: 'bw',
        duplex: false,
      });

      expect(store.canAccess(job.printJobId, job.accessToken)).toBe(true);
    });

    it('should return false for a wrong token', () => {
      const job = store.create({
        kioskId: 'kiosk-1',
        fileUrl: 'https://example.com/file.pdf',
        copies: 1,
        color: 'bw',
        duplex: false,
      });

      expect(store.canAccess(job.printJobId, 'wrong-token')).toBe(false);
    });

    it('should return false for a nonexistent job', () => {
      expect(store.canAccess('nonexistent', 'any-token')).toBe(false);
    });
  });

  describe('updateStatus', () => {
    it('should update the status and append to history', () => {
      const job = store.create({
        kioskId: 'kiosk-1',
        fileUrl: 'https://example.com/file.pdf',
        copies: 1,
        color: 'bw',
        duplex: false,
      });

      const updated = store.updateStatus(job.printJobId, 'SENT_TO_KIOSK');

      expect(updated).toBeDefined();
      if (updated) {
        expect(updated.status).toBe('SENT_TO_KIOSK');
        expect(updated.history).toHaveLength(2);
        expect(updated.history[1].status).toBe('SENT_TO_KIOSK');
        expect(updated.history[1].at).toBeDefined();
      }
    });

    it('should return undefined for a nonexistent job', () => {
      expect(store.updateStatus('nonexistent', 'ERROR')).toBeUndefined();
    });

    it('should record errorCode for ERROR status with message', () => {
      const job = store.create({
        kioskId: 'kiosk-1',
        fileUrl: 'https://example.com/file.pdf',
        copies: 1,
        color: 'bw',
        duplex: false,
      });

      const updated = store.updateStatus(
        job.printJobId,
        'ERROR',
        'Kiosk is already processing another job',
      );

      expect(updated.lastError).toBeDefined();
      expect(updated.lastError.code).toBe('KIOSK_JOB_ERROR');
      expect(updated.lastError.message).toBe('Kiosk is already processing another job');
    });

    it('should record PRINTER_ERROR errorCode', () => {
      const job = store.create({
        kioskId: 'kiosk-1',
        fileUrl: 'https://example.com/file.pdf',
        copies: 1,
        color: 'bw',
        duplex: false,
      });

      const updated = store.updateStatus(job.printJobId, 'PRINTER_ERROR', 'CUPS has no default printer configured');

      expect(updated.lastError.code).toBe('PRINTER_COMMAND_FAILED');
    });
  });
});

describe('errorCode (standalone)', () => {
  it('should map printer errors correctly', () => {
    const store = new JobStore();
    const job = store.create({
      kioskId: 'kiosk-1',
      fileUrl: 'https://example.com/file.pdf',
      copies: 1,
      color: 'bw',
      duplex: false,
    });

    store.updateStatus(job.printJobId, 'PRINTER_ERROR', 'CUPS has no default printer configured');
    const updated = store.get(job.printJobId);
    expect(updated.lastError.code).toBe('PRINTER_COMMAND_FAILED');
  });

  it('should map document download failures', () => {
    const store = new JobStore();
    const job = store.create({
      kioskId: 'kiosk-1',
      fileUrl: 'https://example.com/file.pdf',
      copies: 1,
      color: 'bw',
      duplex: false,
    });

    store.updateStatus(job.printJobId, 'ERROR', 'DOCUMENT_DOWNLOAD_FAILED: network error');
    const updated = store.get(job.printJobId);
    expect(updated.lastError.code).toBe('DOCUMENT_DOWNLOAD_FAILED');
  });
});
