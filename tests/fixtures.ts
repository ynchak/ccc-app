/**
 * Синтетические данные для тестов.
 *
 * CSV-файлы с реальными товарами в репозиторий не попадают, поэтому тесты
 * строят небольшой детерминированный набор сами.
 */

interface Row {
  goodsId: string;
  title: string;
  article: string;
  categoryId: string;
  categoryTitle: string;
  image: string;
  mdg: string;
  size111?: string;
  size222?: string;
  color: string;
}

const rows: Row[] = [];

function addGroup(options: {
  prefix: string;
  model: string;
  titleBase: string;
  categoryId: string;
  categoryTitle: string;
  image: string;
  color: string;
  sizes: string[];
  useShoeSizeColumn?: boolean;
}): void {
  for (const size of options.sizes) {
    const id = `${options.prefix}-${size.toLowerCase()}`;
    rows.push({
      goodsId: id,
      title: `${options.titleBase} ${size} ${options.color.toLowerCase()}`,
      article: `art-${id}`,
      categoryId: options.categoryId,
      categoryTitle: options.categoryTitle,
      image: options.image,
      mdg: `${options.model}_${options.color.toLowerCase()}`,
      size111: options.useShoeSizeColumn ? undefined : size,
      size222: options.useShoeSizeColumn ? size : undefined,
      color: options.color,
    });
  }
}

// Одежда: три модели по три размера.
addGroup({
  prefix: "c1",
  model: "M100",
  titleBase: "Платье тестовое M100",
  categoryId: "100",
  categoryTitle: "Одежда",
  image: "https://img.test/shared.jpg",
  color: "Белый",
  sizes: ["S", "M", "L"],
});
addGroup({
  prefix: "c2",
  model: "M200",
  titleBase: "Платье тестовое M200",
  categoryId: "100",
  categoryTitle: "Одежда",
  image: "https://img.test/c2.jpg",
  color: "Черный",
  sizes: ["S", "M", "L"],
});
addGroup({
  prefix: "c3",
  model: "M300",
  titleBase: "Платье тестовое M300",
  categoryId: "100",
  categoryTitle: "Одежда",
  image: "https://img.test/c3.jpg",
  color: "Синий",
  sizes: ["S", "M", "L"],
});

// Обувь: другой ID колонки размера.
addGroup({
  prefix: "s1",
  model: "SH100",
  titleBase: "Кроссовки тестовые SH100",
  categoryId: "200",
  categoryTitle: "Обувь",
  image: "https://img.test/shared.jpg",
  color: "Серый",
  sizes: ["40", "41"],
  useShoeSizeColumn: true,
});
addGroup({
  prefix: "s2",
  model: "SH200",
  titleBase: "Кроссовки тестовые SH200",
  categoryId: "200",
  categoryTitle: "Обувь",
  image: "https://img.test/s2.jpg",
  color: "Коричневый",
  sizes: ["42", "43"],
  useShoeSizeColumn: true,
});

// Две одиночные группы без общих фото.
rows.push({
  goodsId: "a1",
  title: "Ремень тестовый A1",
  article: "art-a1",
  categoryId: "300",
  categoryTitle: "Аксессуары",
  image: "https://img.test/a1.jpg",
  mdg: "A1",
  size111: "One Size",
  color: "Черный",
});
rows.push({
  goodsId: "a2",
  title: "Шарф тестовый A2",
  article: "art-a2",
  categoryId: "300",
  categoryTitle: "Аксессуары",
  image: "https://img.test/a2.jpg",
  mdg: "A2",
  size111: "One Size",
  color: "Серый",
});

const header = [
  "goods_id",
  "goods_title",
  "goods_article",
  "producers_title",
  "goods_category_id",
  "goods_category_title",
  "seller_title",
  "gomer_sync_source_id",
  "goods_images_url",
  "Модель для группировки (МДГ);215080",
  "Размер;111",
  "Размер;222",
  "Цвет;131559",
];

function csvValue(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const SYNTHETIC_CSV = [
  header.join(","),
  ...rows.map((row) =>
    [
      row.goodsId,
      row.title,
      row.article,
      "Тестовый бренд",
      row.categoryId,
      row.categoryTitle,
      "Тестовый продавец",
      row.goodsId,
      `['${row.image}']`,
      row.mdg,
      row.size111 ?? "",
      row.size222 ?? "",
      row.color,
    ]
      .map((value) => csvValue(value))
      .join(","),
  ),
].join("\n");

export const SYNTHETIC_PRODUCT_COUNT = rows.length;
export const SYNTHETIC_GROUP_COUNT = 7;
export const SYNTHETIC_SINGLE_COUNT = 2;
