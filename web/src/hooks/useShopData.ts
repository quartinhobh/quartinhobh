import { useCallback, useEffect, useState } from 'react';
import {
  fetchProducts,
  fetchPixConfig,
} from '@/services/api';
import { useApiCache } from '@/store/apiCache';
import type { Product, PixConfig } from '@/types';

export interface UseShopDataResult {
  products: Product[];
  pix: PixConfig;
  loading: boolean;
  refresh: () => Promise<void>;
}

interface ShopCacheData {
  products: Product[];
  pix: PixConfig;
}

const SHOP_TTL = 2 * 60 * 1000; // 2 minutes

async function fetchShopData(token: string | null): Promise<ShopCacheData> {
  const [prods, cfg] = await Promise.all([
    token
      ? fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/shop/products/all`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()).then((b: { products: Product[] }) => b.products)
      : fetchProducts(),
    fetchPixConfig(),
  ]);
  return { products: prods ?? [], pix: cfg ?? { key: '', beneficiary: '', city: '' } };
}

export function useShopData(token: string | null): UseShopDataResult {
  const cache = useApiCache();
  const cacheKey = 'shop:data';

  const cached = cache.get<ShopCacheData>(cacheKey, SHOP_TTL);
  const [data, setData] = useState<ShopCacheData | null>(
    cached ?? { products: [], pix: { key: '', beneficiary: '', city: '' } },
  );
  const [loading, setLoading] = useState(!cached);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchShopData(token);
      cache.set(cacheKey, result);
      setData(result);
    } catch {
      // keep current data on error
    } finally {
      setLoading(false);
    }
  }, [token, cache, cacheKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    products: data?.products ?? [],
    pix: data?.pix ?? { key: '', beneficiary: '', city: '' },
    loading,
    refresh,
  };
}
