/**
 * Scheduled Products Configuration
 * Contains product templates and data for each category
 * Auto-generates unique products daily at 07:00 AM WIB (Asia/Jakarta)
 */

export interface ScheduledProductTemplate {
  categoryId: string;
  categoryName: string;
  productNameTemplates: string[];
  descriptionTemplates: string[];
  priceRanges: { min: number; max: number }[];
  marketplaceUrls: {
    tokopedia: string;
    shopee: string;
  };
}

// Category data from your Supabase
const CATEGORIES: ScheduledProductTemplate[] = [
  {
    categoryId: "9fcb7e8a-7b72-4afc-bd7c-d2e7ca850c79",
    categoryName: "Pakaian",
    productNameTemplates: [
      "Kaos Premium {brand}",
      "Kemeja Kasual {brand}",
      "Jaket Trendy {brand}",
      "Celana Denim {brand}",
      "Hoodie Keren {brand}",
      "Sweater Hangat {brand}",
      "Polo Shirt {brand}",
      "Tank Top Sport {brand}",
      "Cardigan Elegan {brand}",
      "Blazer Formal {brand}",
    ],
    descriptionTemplates: [
      "Pakaian berkualitas tinggi dengan bahan premium dan desain modern",
      "Koleksi terbaru dengan kenyamanan maksimal untuk penggunaan sehari-hari",
      "Gaya dan kenyamanan dalam satu produk pilihan",
      "Material berkualitas dengan jahitan rapi dan tahan lama",
      "Desain eksklusif yang cocok untuk berbagai acara",
    ],
    priceRanges: [
      { min: 75000, max: 150000 },
      { min: 150000, max: 300000 },
      { min: 200000, max: 500000 },
    ],
    marketplaceUrls: {
      tokopedia:
        "https://www.tokopedia.com/search?q=pakaian&sort=4&page=1",
      shopee:
        "https://shopee.co.id/search?keyword=pakaian&page=0&nofollow=true",
    },
  },
  {
    categoryId: "16de48e8-84f6-4c02-ae3f-dd8d53211b2e",
    categoryName: "Aksesoris",
    productNameTemplates: [
      "Jam Tangan Digital {brand}",
      "Kalung Stylish {brand}",
      "Gelang Casual {brand}",
      "Dompet Kulit {brand}",
      "Tas Kecil {brand}",
      "Topi Keren {brand}",
      "Cinture Elegant {brand}",
      "Kacamata Hitam {brand}",
      "Anting Premium {brand}",
      "Scarf Fashion {brand}",
    ],
    descriptionTemplates: [
      "Aksesori pelengkap gaya dengan desain modern dan berkualitas",
      "Tambahkan aksesori favorit untuk melengkapi penampilan Anda",
      "Aksesori fashion terpercaya dengan desain yang elegan",
      "Kualitas premium dengan harga terjangkau",
      "Pilihan sempurna untuk melengkapi outfit Anda setiap hari",
    ],
    priceRanges: [
      { min: 50000, max: 150000 },
      { min: 100000, max: 300000 },
      { min: 200000, max: 600000 },
    ],
    marketplaceUrls: {
      tokopedia:
        "https://www.tokopedia.com/search?q=aksesoris&sort=4&page=1",
      shopee:
        "https://shopee.co.id/search?keyword=aksesoris&page=0&nofollow=true",
    },
  },
  {
    categoryId: "eed9a3bf-594d-4888-9118-e50f4ead80ee",
    categoryName: "Sepatu",
    productNameTemplates: [
      "Sepatu Sneaker {brand}",
      "Sepatu Casual {brand}",
      "Sepatu Olahraga {brand}",
      "Sandal Nyaman {brand}",
      "Boots Stylish {brand}",
      "Sepatu Formal {brand}",
      "Sepatu Lari {brand}",
      "Slip On Trendy {brand}",
      "Sepatu Canvas {brand}",
      "Loafer Elegant {brand}",
    ],
    descriptionTemplates: [
      "Sepatu berkualitas dengan kenyamanan untuk penggunaan seharian",
      "Gaya dan kenyamanan berpadu sempurna dalam setiap langkah",
      "Sepatu premium dengan desain kontemporer dan tahan lama",
      "Pilihan tepat untuk gaya kasual maupun formal Anda",
      "Teknologi terkini untuk kenyamanan maksimal sepanjang hari",
    ],
    priceRanges: [
      { min: 100000, max: 300000 },
      { min: 250000, max: 500000 },
      { min: 400000, max: 800000 },
    ],
    marketplaceUrls: {
      tokopedia:
        "https://www.tokopedia.com/search?q=sepatu&sort=4&page=1",
      shopee:
        "https://shopee.co.id/search?keyword=sepatu&page=0&nofollow=true",
    },
  },
  {
    categoryId: "107e377a-c6e9-42b3-aa89-6d5c9885d88f",
    categoryName: "Raket",
    productNameTemplates: [
      "Raket Badminton Pro {brand}",
      "Raket Tenis {brand}",
      "Raket Squash {brand}",
      "Raket Badminton Beginner {brand}",
      "Raket Tenis Advance {brand}",
      "Raket Badminton Carbon {brand}",
      "Raket Tenis Graphite {brand}",
      "Raket Squash Professional {brand}",
      "Raket Badminton Composite {brand}",
      "Raket Tenis Training {brand}",
    ],
    descriptionTemplates: [
      "Raket berkualitas tinggi untuk performa maksimal dalam permainan",
      "Raket profesional dengan material terbaik dan teknologi terdepan",
      "Desain ergonomis untuk kenyamanan dan kontrol yang optimal",
      "Raket pilihan atlet dengan daya tahan dan ketepatan tinggi",
      "Material premium untuk performa konsisten setiap pertandingan",
    ],
    priceRanges: [
      { min: 150000, max: 400000 },
      { min: 300000, max: 700000 },
      { min: 500000, max: 1500000 },
    ],
    marketplaceUrls: {
      tokopedia:
        "https://www.tokopedia.com/search?q=raket&sort=4&page=1",
      shopee:
        "https://shopee.co.id/search?keyword=raket&page=0&nofollow=true",
    },
  },
  {
    categoryId: "45f8ef2c-9f7a-4aa2-8283-2c00a003fa5a",
    categoryName: "Tas",
    productNameTemplates: [
      "Tas Ransel {brand}",
      "Tas Tangan {brand}",
      "Tas Laptop {brand}",
      "Tas Selempang {brand}",
      "Tas Kerja {brand}",
      "Tas Travel {brand}",
      "Tas Casual {brand}",
      "Tas Pesta {brand}",
      "Tas Makeup {brand}",
      "Tas Outdoor {brand}",
    ],
    descriptionTemplates: [
      "Tas multifungsi dengan desain praktis dan stylish untuk setiap kebutuhan",
      "Tas berkualitas dengan material tahan lama dan kapasitas besar",
      "Koleksi tas terbaru dengan gaya dan fungsionalitas sempurna",
      "Tas pilihan untuk kegiatan sehari-hari hingga traveling",
      "Material premium dengan design yang trendy dan ergonomis",
    ],
    priceRanges: [
      { min: 100000, max: 300000 },
      { min: 250000, max: 600000 },
      { min: 400000, max: 1000000 },
    ],
    marketplaceUrls: {
      tokopedia:
        "https://www.tokopedia.com/search?q=tas&sort=4&page=1",
      shopee:
        "https://shopee.co.id/search?keyword=tas&page=0&nofollow=true",
    },
  },
];

/**
 * Get all category templates
 */
export function getAllCategoryTemplates(): ScheduledProductTemplate[] {
  return CATEGORIES;
}

/**
 * Get template for specific category
 */
export function getCategoryTemplate(
  categoryId: string
): ScheduledProductTemplate | undefined {
  return CATEGORIES.find((cat) => cat.categoryId === categoryId);
}

/**
 * Generate random brand name
 */
function generateBrandName(): string {
  const brands = [
    "Premium",
    "Ultra",
    "Pro",
    "Elite",
    "Signature",
    "Exclusive",
    "Royal",
    "Grand",
    "Classic",
    "Modern",
    "Prestige",
    "Superior",
  ];
  return brands[Math.floor(Math.random() * brands.length)];
}

/**
 * Get random element from array
 */
function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate random price within range
 */
function generatePrice(range: { min: number; max: number }): number {
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

/**
 * Generate product data for a specific category
 */
export function generateProductData(categoryId: string) {
  const template = getCategoryTemplate(categoryId);
  if (!template) {
    return null;
  }

  const brand = generateBrandName();
  const productName = getRandomElement(template.productNameTemplates).replace(
    "{brand}",
    brand
  );
  const shortDescription = getRandomElement(template.descriptionTemplates);
  const price = generatePrice(getRandomElement(template.priceRanges));

  // Randomly choose between Tokopedia or Shopee
  const marketplace = Math.random() > 0.5 ? "tokopedia" : "shopee";
  const marketplaceUrl = template.marketplaceUrls[marketplace];

  return {
    category_id: categoryId,
    name: productName,
    short_description: shortDescription,
    description: `${shortDescription}\n\nProduk ini adalah bagian dari koleksi eksklusif kami yang dirancang khusus untuk memenuhi kebutuhan Anda dengan kualitas terbaik.`,
    price: `Rp ${price.toLocaleString("id-ID")}`,
    marketplace_url: marketplaceUrl,
    sort_order: Math.floor(Math.random() * 100),
    is_active: true,
  };
}

/**
 * Generate products for all active categories
 */
export function generateAllCategoryProducts() {
  return CATEGORIES.map((category) => ({
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    product: generateProductData(category.categoryId),
  }));
}

/**
 * Get run count configuration
 * 365 days of automatic creation = 365 runs
 */
export const SCHEDULED_PRODUCT_CONFIG = {
  TOTAL_RUNS: 365, // 365 days = 1 year
  CRON_TIME: "0 7 * * *", // 07:00 AM daily (UTC time - will be converted to WIB)
  TIMEZONE: "Asia/Jakarta", // WIB timezone
  CATEGORIES_PER_RUN: 5, // Create 1 product per category per day = 5 products per day
};

export default CATEGORIES;
