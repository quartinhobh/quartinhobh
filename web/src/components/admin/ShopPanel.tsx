import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
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

export interface ShopPanelProps {
  idToken: string | null;
}

export const ShopPanel: React.FC<ShopPanelProps> = ({ idToken }) => {
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
      const [prods, cfg] = await Promise.all([
        idToken ? fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/shop/products/all`, {
          headers: { Authorization: `Bearer ${idToken}` },
        }).then((r) => r.json()).then((b: { products: Product[] }) => b.products) : fetchProducts(),
        fetchPixConfig(),
      ]);
      setProducts(prods ?? []);
      if (cfg) setPix(cfg);
    } catch { /* */ }
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, [idToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function savePix() {
    if (!idToken) return;
    await updatePixConfig(pix, idToken);
  }

  async function addProduct() {
    if (!idToken || !name.trim()) return;
    const cents = Math.round(parseFloat(price.replace(',', '.')) * 100);
    if (cents <= 0 || isNaN(cents)) return;
    await createProduct({ emoji, name, description: desc, price: cents }, idToken);
    setEmoji(''); setName(''); setDesc(''); setPrice('');
    await refresh();
  }

  async function handleImport() {
    if (!idToken || !csvText.trim()) return;
    await importProductsCsv(csvText, idToken);
    setCsvText('');
    await refresh();
  }

  async function handleDelete(id: string) {
    if (!idToken) return;
    await deleteShopProduct(id, idToken);
    await refresh();
  }

  if (loading) return <p className="font-body text-zine-burntOrange">carregando…</p>;

  return (
    <div className="flex flex-col gap-4">
      {/* PIX Config */}
      <ZineFrame bg="cream">
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
      </ZineFrame>

      {/* Add product */}
      <ZineFrame bg="cream">
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
      </ZineFrame>

      {/* CSV import */}
      <ZineFrame bg="cream">
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
      </ZineFrame>

      {/* Product list */}
      <ZineFrame bg="cream">
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
                    <span className="font-display text-zine-burntOrange text-sm truncate">{p.name}</span>
                    <span className="font-body text-xs text-zine-burntOrange/60">{formatPrice(p.price)}</span>
                  </div>
                </div>
                <Button onClick={() => void handleDelete(p.id)}>apagar</Button>
              </li>
            ))}
          </ul>
        )}
      </ZineFrame>
    </div>
  );
};

export default ShopPanel;
