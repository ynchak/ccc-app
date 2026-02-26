// lib/db.ts
import Dexie, { type Table } from "dexie";

// ─── Domain Types ────────────────────────────────────────────────────────────

export interface Good {
  id?: number; // auto-increment PK (IndexedDB)
  goods_id: number;
  goods_title: string;
  gomer_sync_source_id: number;
  goods_images_url: string[];
  fileId: number; // FK → CsvFile.id
}

export interface CsvFile {
  id?: number;
  name: string;
  size: number;
  importedAt: Date;
  totalRows: number;
}

// ─── Repository Interface ─────────────────────────────────────────────────────

export interface ICsvFileRepository {
  create(file: Omit<CsvFile, "id">): Promise<number>;
  update(id: number, changes: Partial<Omit<CsvFile, "id">>): Promise<void>;
  getAll(): Promise<CsvFile[]>;
  getById(id: number): Promise<CsvFile | undefined>;
  remove(id: number): Promise<void>;
}

export interface IGoodsRepository {
  bulkInsert(goods: Omit<Good, "id">[]): Promise<void>;
  getByFileId(fileId: number): Promise<Good[]>;
  getByFileIdPaginated(
    fileId: number,
    page: number,
    pageSize: number,
  ): Promise<Good[]>;
  countByFileId(fileId: number): Promise<number>;
  deleteByFileId(fileId: number): Promise<void>;
}

// ─── Dexie DB ────────────────────────────────────────────────────────────────

class AppDatabase extends Dexie {
  csvFiles!: Table<CsvFile, number>;
  goods!: Table<Good, number>;

  constructor() {
    super("AppDatabase");
    this.version(1).stores({
      csvFiles: "++id, name, importedAt",
      // fileId is indexed for fast lookup by file
      goods: "++id, goods_id, fileId, gomer_sync_source_id",
    });
  }
}

export const db = new AppDatabase();

// ─── Repository Implementations ───────────────────────────────────────────────

export class CsvFileRepository implements ICsvFileRepository {
  async create(file: Omit<CsvFile, "id">): Promise<number> {
    return db.csvFiles.add(file);
  }

  async update(
    id: number,
    changes: Partial<Omit<CsvFile, "id">>,
  ): Promise<void> {
    await db.csvFiles.update(id, changes);
  }

  async getAll(): Promise<CsvFile[]> {
    return db.csvFiles.orderBy("importedAt").reverse().toArray();
  }

  async getById(id: number): Promise<CsvFile | undefined> {
    return db.csvFiles.get(id);
  }

  async remove(id: number): Promise<void> {
    await db.transaction("rw", db.csvFiles, db.goods, async () => {
      await db.goods.where("fileId").equals(id).delete();
      await db.csvFiles.delete(id);
    });
  }
}

export class GoodsRepository implements IGoodsRepository {
  // Write in chunks to avoid memory spikes with large files
  async bulkInsert(goods: Omit<Good, "id">[], chunkSize = 1000): Promise<void> {
    for (let i = 0; i < goods.length; i += chunkSize) {
      await db.goods.bulkAdd(goods.slice(i, i + chunkSize) as Good[]);
    }
  }

  async getByFileId(fileId: number): Promise<Good[]> {
    return db.goods.where("fileId").equals(fileId).toArray();
  }

  async getByFileIdPaginated(
    fileId: number,
    page: number,
    pageSize: number,
  ): Promise<Good[]> {
    return db.goods
      .where("fileId")
      .equals(fileId)
      .offset(page * pageSize)
      .limit(pageSize)
      .toArray();
  }

  async countByFileId(fileId: number): Promise<number> {
    return db.goods.where("fileId").equals(fileId).count();
  }

  async deleteByFileId(fileId: number): Promise<void> {
    await db.goods.where("fileId").equals(fileId).delete();
  }
}

// ─── Singleton Exports ────────────────────────────────────────────────────────

export const csvFileRepo = new CsvFileRepository();
export const goodsRepo = new GoodsRepository();
