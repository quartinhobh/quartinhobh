import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { auth } from '@/services/firebase';
import {
  fetchProducts,
  fetchPixConfig,
  updatePixConfig,
  createProduct,
  importProductsCsv,
  deleteShopProduct,
} from '@/services/api';
import type { Product, PixConfig } from '@/types';

const inputClass =
  'border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2 focus:outline-none focus:border-zine-burntOrange w-full';

function formatPrice(c: number): string {
  return `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
}

async function getToken(): Promise<string | null> {
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

export interface ShopPanelProps {
  idToken: string | null;
  mode?: 'products' | 'pix' | 'all';
}

export const ShopPanel: React.FC<ShopPanelProps> = ({ mode = 'all' }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [pix, setPix] = useState<PixConfig>({ key: '', beneficiary: '', city: '' });
  const [loading, setLoading] = useState(true);

  // New product form
  const [emoji, setEmoji] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [csvText, setCsvText] = useState('');

  async function refresh() {
    try {
      const token = await getToken();
      const [prods, cfg] = await Promise.all([
        token
          ? fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/shop/products/all`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then((r) => r.json()).then((b: { products: Product[] }) => b.products)
          : fetchProducts(),
        fetchPixConfig(),
      ]);
      setProducts(prods ?? []);
      if (cfg) setPix(cfg);
    } catch { /* */ }
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function savePix() {
    const token = await getToken();
    if (!token) return;
    await updatePixConfig(pix, token);
    alert('PIX salvo!');
  }

  async function addProduct() {
    const token = await getToken();
    if (!token || !name.trim()) return;
    const cents = Math.round(parseFloat(price.replace(',', '.')) * 100);
    if (cents <= 0 || isNaN(cents)) return;
    await createProduct({ emoji, name, description: desc, price: cents }, token);
    setEmoji(''); setName(''); setDesc(''); setPrice('');
    await refresh();
  }

  async function handleImport() {
    const token = await getToken();
    if (!token || !csvText.trim()) return;
    await importProductsCsv(csvText, token);
    setCsvText('');
    await refresh();
  }

  async function handleDelete(id: string) {
    const token = await getToken();
    if (!token) return;
    await deleteShopProduct(id, token);
    await refresh();
  }

  if (loading) return <p className="font-body text-zine-burntOrange">carregando…</p>;

  const showPix = mode === 'pix' || mode === 'all';
  const showProducts = mode === 'products' || mode === 'all';

  return (
    <div className="flex flex-col gap-4">
      {/* PIX Config */}
      {showPix && <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Configuração PIX</h3>
        <div className="flex flex-col gap-2">
          <input
            placeholder="Chave PIX (CPF, email, telefone, aleatória)"
            value={pix.key}
            onChange={(e) => setPix({ ...pix, key: e.target.value })}
            className={inputClass}
          />
          <input
            placeholder="Nome beneficiário (max 25)"
            maxLength={25}
            value={pix.beneficiary}
            onChange={(e) => setPix({ ...pix, beneficiary: e.target.value })}
            className={inputClass}
          />
          <input
            placeholder="Cidade (max 15)"
            maxLength={15}
            value={pix.city}
            onChange={(e) => setPix({ ...pix, city: e.target.value })}
            className={inputClass}
          />
          <Button onClick={() => void savePix()}>salvar PIX</Button>
        </div>
      </ZineFrame>}

      {/* Add product */}
      {showProducts && <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Adicionar produto</h3>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[60px_1fr] gap-2">
            <input placeholder="emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} className={inputClass} />
            <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <input placeholder="Descrição" value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} />
          <input placeholder="Preço (ex: 25,00)" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
          <Button onClick={() => void addProduct()}>adicionar</Button>
        </div>
      </ZineFrame>}

      {/* CSV import */}
      {showProducts && <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">Importar CSV</h3>
        <p className="font-body text-xs text-zine-burntOrange/60 mb-2">
          Formato: emoji,nome,descrição,preço(centavos) — uma linha por produto
        </p>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={4}
          placeholder="🍺,Cerveja artesanal,IPA local,1500&#10;👕,Camiseta Quartinho,Tamanho único,3500"
          className={inputClass}
        />
        <Button onClick={() => void handleImport()} className="mt-2">importar</Button>
      </ZineFrame>}

      {/* Product list */}
      {showProducts && <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-3">
          Produtos ({products.length})
        </h3>
        {products.length === 0 ? (
          <p className="font-body text-zine-burntOrange/60 italic">Nenhum produto.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 border-b border-zine-burntOrange/20 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {p.emoji && <span className="text-xl">{p.emoji}</span>}
                  <div className="flex flex-col min-w-0">
                    <span className="font-display text-zine-burntOrange dark:text-zine-cream text-sm truncate">{p.name}</span>
                    {p.description && <span className="font-body text-xs text-zine-burntOrange/60 dark:text-zine-cream/60 truncate">{p.description}</span>}
                    <span className="font-body text-xs text-zine-burntYellow">{formatPrice(p.price)}</span>
                  </div>
                </div>
                <Button onClick={() => void handleDelete(p.id)}>apagar</Button>
              </li>
            ))}
          </ul>
        )}
      </ZineFrame>}
    </div>
  );
};

export default ShopPanel;
