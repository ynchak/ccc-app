/**
 * Доменные типы приложения группировки товаров.
 */

/** Товар, разобранный из CSV. */
export interface Product {
  /** Суррогатный PK в IndexedDB. goods_id не может быть PK — он уникален лишь внутри файла. */
  id: number;
  datasetId: number;
  /** Порядковый номер строки в исходном файле — по нему восстанавливается порядок экспорта. */
  order: number;

  goodsId: string;
  /** Исходное название товара. Используется как название группы по умолчанию. */
  goodsTitle: string;
  goodsArticle: string;
  producersTitle: string;
  categoryId: string;
  categoryTitle: string;
  sellerTitle: string;
  gomerSyncSourceId: string;

  /** Модель для группировки. Справочное поле: в кластеризации не участвует. */
  mdg: string | null;
  description: string | null;

  size: string | null;
  color: string | null;
  /** Цвет предложен сервисом, а не пришёл из CSV. */
  colorSource?: "suggested";
  height: string | null;
  ean: string | null;

  /** URL фото товара, разобранные из python-листа. */
  imageUrls: string[];
}

export type TitleSource = "derived" | "manual" | "llm";

/** Группа товаров. */
export interface Group {
  id: number;
  datasetId: number;
  /** Постоянный номер группы внутри файла. Не меняется при переименовании и переносах. */
  number: number;
  /** Отображаемое название. По умолчанию — исходный заголовок первого товара. */
  title: string;
  /** Исходный goods_title первого товара — для будущей LLM-генерации. */
  titleRaw: string;
  /** Нормализованное название — по нему определяется совпадение для слияния. */
  titleKey: string;
  titleSource: TitleSource;

  categoryId: string;
  categoryTitle: string;

  /** Товары группы. Единственный источник истины по принадлежности. */
  productIds: number[];
  order: number;

  /** Группа изменена вручную: авто-объединение её не трогает. */
  manual?: boolean;
}

/** Импортированный файл. */
export interface Dataset {
  id: number;
  name: string;
  importedAt: number;
  rowCount: number;
  groupCount: number;
  /** Сколько групп было слито автоматически по совпадению названий. */
  autoMergedCount: number;
  /** Суммарная стоимость запросов к ИИ для этого файла, USD. */
  aiCostUsd?: number;
  /** Сколько раз вручную запускалась очистка названий. */
  aiCleanupRuns?: number;
  /** Сопоставление полей приложения с найденными колонками. */
  columnMap: ColumnMapping[];
  /** Исходный заголовок файла — для превью и повторного маппинга. */
  header: string[];
}

/** Как поле приложения сопоставлено с колонкой файла. */
export interface ColumnMapping {
  /** Ключ поля приложения. */
  field: ColumnField;
  /** Отображаемое имя поля. */
  label: string;
  /** Найденные колонки (их может быть несколько — один атрибут с разными ID). */
  columns: string[];
  /** Колонка, значение которой берётся по умолчанию. */
  primary: string | null;
  /** Поле отсутствует в файле — не ошибка, значение будет null. */
  missing: boolean;
  /** Поле найдено, но не влияет на группировку (справочное). */
  informational?: boolean;
}

export type ColumnField =
  | "goodsId"
  | "goodsTitle"
  | "goodsArticle"
  | "producersTitle"
  | "categoryId"
  | "categoryTitle"
  | "sellerTitle"
  | "gomerSyncSourceId"
  | "mdg"
  | "description"
  | "size"
  | "color"
  | "height"
  | "ean"
  | "imageUrls";

/** Товар до записи в БД — без суррогатного id. */
export type ParsedProduct = Omit<Product, "id" | "datasetId">;

/** Товар, готовый к записи: без id и datasetId, их проставит хранилище. */
export type NewProduct = Omit<Product, "id" | "datasetId">;

/** Группа, готовая к записи: без id, id проставит хранилище. */
export type NewGroup = Omit<Group, "id">;

/** Группа для массовой записи: datasetId проставит хранилище. */
export type NewGroupForDataset = Omit<Group, "id" | "datasetId">;

/** Строка файла, разобранная в разрешённые поля. */
export interface ParsedRow {
  values: Record<ColumnField, string | null>;
  imageUrls: string[];
}
