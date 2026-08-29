
import { PermissionService } from './permission.service';

describe('PermissionService - P0 Fixes', () => {
  let service: PermissionService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    mockPrisma = {
      file: { findUnique: jest.fn() },
      folder: { findUnique: jest.fn() },
      permission: { findMany: jest.fn().mockResolvedValue([]) },
      userRole: { findFirst: jest.fn().mockResolvedValue(null) }
    };
    mockRedis = { get: jest.fn().mockResolvedValue(null), setex: jest.fn(), keys: jest.fn().mockResolvedValue([]), del: jest.fn() };
    service = new PermissionService(mockPrisma, mockRedis);
  });

  it('should detect circular folder reference', async () => {
    mockPrisma.file.findUnique.mockResolvedValue({ id: 'f1', folderId: 'folderA' });
    mockPrisma.folder.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === 'folderA') return { id: 'folderA', parentId: 'folderB', breakInheritance: false };
      if (where.id === 'folderB') return { id: 'folderB', parentId: 'folderA', breakInheritance: false }; // cycle
      return null;
    });
    await expect(service.can('user1', 'f1', 'canView')).rejects.toThrow('Circular');
  });

  it('should cache permission result', async () => {
    mockPrisma.file.findUnique.mockResolvedValue({ id: 'f1', folderId: 'folder1' });
    mockPrisma.folder.findUnique.mockResolvedValue(null);
    mockPrisma.userRole.findFirst.mockResolvedValue({ role: { name: 'ADMIN' } });
    const result = await service.can('user1', 'f1', 'canView');
    expect(mockRedis.setex).toHaveBeenCalledWith(expect.stringContaining('perm:'), 60, '1');
    expect(result).toBe(true);
  });

  it('DENY wins over ALLOW', async () => {
    const perms = [{ canEdit: true }, { canEdit: false }];
    const result = (service as any).evaluate(perms, 'canEdit');
    expect(result).toBe(false); // deny wins
  });
});
