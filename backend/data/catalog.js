// Educational sample prices and scores, adapted from the supplied prototype.
// These are not live market prices or benchmark results.
import { withSampleImage } from './componentImages.js';
export const components = [
  { name: 'Ryzen 5 5600', brand: 'AMD', category: 'cpu', price: 6200, socket: 'AM4', powerDraw: 65, performanceScore: 52 },
  { name: 'Ryzen 7 5700X', brand: 'AMD', category: 'cpu', price: 9500, socket: 'AM4', powerDraw: 65, performanceScore: 64 },
  { name: 'Ryzen 5 7600', brand: 'AMD', category: 'cpu', price: 12800, socket: 'AM5', powerDraw: 65, performanceScore: 72 },
  { name: 'B450M Pro-VDH Max', brand: 'MSI', category: 'motherboard', price: 3400, socket: 'AM4', memoryType: 'DDR4', formFactor: 'mATX', memorySlots: 4, powerDraw: 35, performanceScore: 30 },
  { name: 'TUF Gaming B550-Plus', brand: 'ASUS', category: 'motherboard', price: 7200, socket: 'AM4', memoryType: 'DDR4', formFactor: 'ATX', memorySlots: 4, powerDraw: 40, performanceScore: 48 },
  { name: 'B650M DS3H', brand: 'Gigabyte', category: 'motherboard', price: 9000, socket: 'AM5', memoryType: 'DDR5', formFactor: 'mATX', memorySlots: 4, powerDraw: 40, performanceScore: 55 },
  { name: 'Fury Beast 16GB DDR4', brand: 'Kingston', category: 'memory', price: 2400, memoryType: 'DDR4', capacityGb: 16, powerDraw: 8, performanceScore: 42 },
  { name: 'Vengeance 32GB DDR4', brand: 'Corsair', category: 'memory', price: 4600, memoryType: 'DDR4', capacityGb: 32, powerDraw: 10, performanceScore: 58 },
  { name: 'Vengeance 32GB DDR5', brand: 'Corsair', category: 'memory', price: 6400, memoryType: 'DDR5', capacityGb: 32, powerDraw: 12, performanceScore: 76 },
  { name: 'GeForce RTX 3050 8GB', brand: 'NVIDIA', category: 'gpu', price: 11500, powerDraw: 130, performanceScore: 40 },
  { name: 'GeForce RTX 4060 8GB', brand: 'NVIDIA', category: 'gpu', price: 16800, powerDraw: 115, performanceScore: 58 },
  { name: 'Radeon RX 7800 XT', brand: 'AMD', category: 'gpu', price: 33500, powerDraw: 263, performanceScore: 82 },
  { name: 'NV2 500GB', brand: 'Kingston', category: 'storage', price: 1650, storageType: 'NVMe', capacityGb: 500, powerDraw: 5, performanceScore: 45 },
  { name: 'NV2 1TB', brand: 'Kingston', category: 'storage', price: 2900, storageType: 'NVMe', capacityGb: 1000, powerDraw: 6, performanceScore: 58 },
  { name: '990 EVO 1TB', brand: 'Samsung', category: 'storage', price: 4700, storageType: 'NVMe', capacityGb: 1000, powerDraw: 7, performanceScore: 80 },
  { name: 'DLM21 Mesh', brand: 'Darkflash', category: 'case', price: 1600, supportedFormFactors: ['mATX', 'ITX'], powerDraw: 6, performanceScore: 28 },
  { name: 'H5 Flow', brand: 'NZXT', category: 'case', price: 5400, supportedFormFactors: ['ATX', 'mATX', 'ITX'], powerDraw: 8, performanceScore: 70 },
  { name: 'MWE 450 Bronze V2', brand: 'Cooler Master', category: 'psu', price: 2100, wattageRating: 450, powerDraw: 0, performanceScore: 30 },
  { name: 'MAG A650BN', brand: 'MSI', category: 'psu', price: 3400, wattageRating: 650, powerDraw: 0, performanceScore: 48 },
  { name: 'RM750e', brand: 'Corsair', category: 'psu', price: 5900, wattageRating: 750, powerDraw: 0, performanceScore: 68 },
  // Expanded sample catalog: two additional records per category.
  { name: 'Ryzen 5 5600X', brand: 'AMD', category: 'cpu', price: 7500, socket: 'AM4', powerDraw: 65, performanceScore: 56 },
  { name: 'Ryzen 7 7700', brand: 'AMD', category: 'cpu', price: 17500, socket: 'AM5', powerDraw: 65, performanceScore: 82 },
  { name: 'B550M PRO-VDH WIFI', brand: 'MSI', category: 'motherboard', price: 6200, socket: 'AM4', memoryType: 'DDR4', formFactor: 'mATX', memorySlots: 4, powerDraw: 40, performanceScore: 44 },
  { name: 'PRIME B650M-A WIFI II', brand: 'ASUS', category: 'motherboard', price: 10500, socket: 'AM5', memoryType: 'DDR5', formFactor: 'mATX', memorySlots: 4, powerDraw: 40, performanceScore: 60 },
  { name: 'Fury Beast 8GB DDR4', brand: 'Kingston', category: 'memory', price: 1350, memoryType: 'DDR4', capacityGb: 8, powerDraw: 5, performanceScore: 28 },
  { name: 'Fury Beast 16GB DDR5', brand: 'Kingston', category: 'memory', price: 3400, memoryType: 'DDR5', capacityGb: 16, powerDraw: 8, performanceScore: 60 },
  { name: 'Radeon RX 6600 8GB', brand: 'AMD', category: 'gpu', price: 12500, powerDraw: 132, performanceScore: 50 },
  { name: 'Radeon RX 7600 8GB', brand: 'AMD', category: 'gpu', price: 16500, powerDraw: 165, performanceScore: 60 },
  { name: 'Blue SN580 1TB', brand: 'Western Digital', category: 'storage', price: 3500, storageType: 'NVMe', capacityGb: 1000, powerDraw: 6, performanceScore: 65 },
  { name: 'P3 Plus 1TB', brand: 'Crucial', category: 'storage', price: 3200, storageType: 'NVMe', capacityGb: 1000, powerDraw: 6, performanceScore: 62 },
  { name: '4000D Airflow', brand: 'Corsair', category: 'case', price: 5200, supportedFormFactors: ['ATX', 'mATX', 'ITX'], powerDraw: 6, performanceScore: 68 },
  { name: 'MasterBox Q300L', brand: 'Cooler Master', category: 'case', price: 2500, supportedFormFactors: ['mATX', 'ITX'], powerDraw: 3, performanceScore: 38 },
  { name: 'MAG A550BN', brand: 'MSI', category: 'psu', price: 2800, wattageRating: 550, powerDraw: 0, performanceScore: 40 },
  { name: 'MAG A750BN PCIE5', brand: 'MSI', category: 'psu', price: 4300, wattageRating: 750, powerDraw: 0, performanceScore: 58 }
].map((c, index) => withSampleImage({ ...c, id: `sample-${index}`, availability: 'in stock', archived: false, stock: 5 }));
const categories = ['cpu', 'motherboard', 'memory', 'gpu', 'storage', 'case', 'psu'];
function profile(slug, label, weights, priorities, memory, storage, isDefault = false) {
  return { slug, label, description: `Budget targets for ${label.toLowerCase()}.`, isDefault, active: true,
    allocations: categories.map((category, index) => ({ category, percent: weights[index], priority: priorities[index] })),
    minimums: [{ category: 'memory', field: 'capacityGb', operator: 'gte', value: memory }, { category: 'storage', field: 'capacityGb', operator: 'gte', value: storage }] };
}
export const profiles = [
  profile('gaming', 'Gaming', [18, 11, 8, 34, 8, 11, 10], [2, 5, 3, 1, 4, 7, 6], 16, 500),
  profile('office', 'Office', [28, 16, 12, 6, 14, 12, 12], [1, 4, 3, 7, 2, 6, 5], 8, 256),
  profile('editing', 'Video editing', [26, 12, 14, 26, 10, 5, 7], [1, 5, 2, 3, 4, 7, 6], 32, 1000),
  profile('student', 'Student', [24, 15, 12, 14, 13, 11, 11], [3, 4, 2, 7, 1, 6, 5], 16, 500),
  profile('general', 'General purpose', [22, 14, 12, 18, 12, 11, 11], [1, 5, 2, 4, 3, 7, 6], 8, 500, true)
];
export const settings = [
  { code: 'CPU_SOCKET_MATCH', label: 'Processor socket', message: 'Processor and motherboard sockets must match.' },
  { code: 'MEMORY_TYPE_MATCH', label: 'Memory type', message: 'Memory type must match the motherboard.' },
  { code: 'CASE_FITS_BOARD', label: 'Motherboard fit', message: 'The case must support the motherboard size.' },
  { code: 'PSU_WATTAGE_HEADROOM', label: 'Power headroom', message: 'The PSU must cover total draw plus the safety margin.', marginPercent: 30 }
].map(s => ({ ...s, active: true }));
export const pairs = [{ categoryA: 'cpu', categoryB: 'gpu', maxGap: 25, active: true }, { categoryA: 'cpu', categoryB: 'memory', maxGap: 35, active: true }];
