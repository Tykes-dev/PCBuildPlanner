export const CATEGORIES = ['cpu', 'motherboard', 'memory', 'gpu', 'storage', 'case', 'psu'] as const;
export type Category = typeof CATEGORIES[number];
export const LABELS: Record<Category, string> = { cpu: 'Processor', motherboard: 'Motherboard', memory: 'Memory', gpu: 'Graphics card', storage: 'Storage', case: 'Case', psu: 'Power supply' };
export interface Component { _id: string; name: string; brand: string; category: Category; price: number; performanceScore: number; availability: string; stock?: number; storageType?: 'NVMe' | 'SATA SSD' | 'HDD'; archived: boolean; imageUrl?: string; imageSource?: string; imageCaption?: string; socket?: string; memoryType?: string; formFactor?: string; supportedFormFactors?: string[]; wattageRating?: number; capacityGb?: number; memorySlots?: number; powerDraw: number; }
export interface ComponentOption { componentId: string; compatible: boolean; available: boolean; reasons: string[]; }
export interface Allocation { category: Category; percent: number; priority: number; allocated: number; locked: boolean; }
export interface Profile { slug: string; label: string; description: string; isDefault: boolean; allocations: Allocation[]; minimums: { category: Category; field: 'capacityGb'; value: number }[]; }
export interface Item { component: Component; quantity: number; }
export interface Issue { code: string; severity: 'error' | 'warning' | 'note'; categories: Category[]; message: string; }
export interface Power { totalDraw: number; marginPercent: number; requiredWattage: number; supplyRating: number | null; sufficient: boolean; }
export interface Validation { valid: boolean; missingCategories: Category[]; issues: Issue[]; power: Power; total: number; }
export interface Recommendation { feasible: boolean; items: Item[]; allocations: Allocation[]; validation?: Validation; minimumBudget?: number | null; remaining?: number; message: string; }
export interface Plan { budget: number; profileSlug: string; items: Item[]; savedBuildId?: string; name?: string; reopenNotices?: string[]; }
export const pesos = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount);


