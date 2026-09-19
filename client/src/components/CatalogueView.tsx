import React, { useState, useEffect } from 'react';
import { Plus, Search, UploadCloud, FileUp, Trash2, Package, CheckCircle2, DownloadCloud, X, Save, Sparkles, Loader2, AlertTriangle, ShieldCheck, Layers } from 'lucide-react';

interface Variant {
  color: string;
  size: string;
  qty: number;
}

interface Product {
  id: string | number;
  ref?: string;
  name: string;
  price: number;
  category: string;
  description: string;
  image?: string | null;
  metadata?: Record<string, any>;
  variants: Variant[];
}

export function CatalogueView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Parsing State
  const [parsingLoading, setParsingLoading] = useState(false);
  const [parsingReport, setParsingReport] = useState<{
    message: string;
    stats: { totalExtracted: number; totalInserted: number; extraFieldsFound: string[]; processedFiles?: string[] };
    warnings: string[];
  } | null>(null);

  // Form State
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    category: '',
    description: '',
    variants: [{ color: 'Blanc', size: 'M', qty: 10 }]
  });

  const [importedFiles, setImportedFiles] = useState<any[]>([]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/catalogue');
      if (res.ok) {
        const data = await res.json();
        const formatted: Product[] = data.map((r: any) => ({
          id: r.ref,
          ref: r.ref,
          name: r.modele,
          price: parseFloat(r.prix_mad),
          category: r.famille || 'Mode',
          description: `Couleur: ${r.couleur || 'N/A'}, Matière: ${r.matiere || 'N/A'}`,
          image: null,
          metadata: r.metadata || {},
          variants: [
            { color: r.couleur || 'Unique', size: r.taille || 'Unique', qty: parseInt(r.stock, 10) }
          ]
        }));
        setProducts(formatted);
        return;
      }
    } catch (err) {
      console.log("Error fetching stock");
    }

    setProducts([]);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAddVariant = () => {
    setNewProduct({
      ...newProduct,
      variants: [...newProduct.variants, { color: '', size: '', qty: 0 }]
    });
  };

  const handleRemoveVariant = (index: number) => {
    if (newProduct.variants.length > 1) {
      const updated = [...newProduct.variants];
      updated.splice(index, 1);
      setNewProduct({ ...newProduct, variants: updated });
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price) {
      alert("Veuillez renseigner au moins le nom et le prix du produit.");
      return;
    }

    const created: Product = {
      id: 'REF-' + Date.now(),
      name: newProduct.name,
      price: parseFloat(newProduct.price),
      category: newProduct.category || 'Non classé',
      description: newProduct.description || '',
      image: null,
      variants: newProduct.variants.map(v => ({ ...v, qty: Number(v.qty) || 0 }))
    };

    setProducts([created, ...products]);
    setShowAddModal(false);
    setNewProduct({
      name: '',
      price: '',
      category: '',
      description: '',
      variants: [{ color: 'Blanc', size: 'M', qty: 10 }]
    });
  };

  const handleDeleteProduct = (id: string | number) => {
    setProducts(products.filter(p => p.id !== id));
  };

  // Dynamic Multi-File & ZIP Archive Upload Handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setParsingLoading(true);
    setParsingReport(null);

    const filesArray = Array.from(fileList);
    const payloads: Array<{ fileName: string; fileContent: string; isBase64?: boolean }> = [];

    const readFile = (file: File): Promise<{ fileName: string; fileContent: string; isBase64?: boolean }> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const isZip = file.name.toLowerCase().endsWith('.zip');

        if (isZip) {
          reader.onload = (evt) => {
            const result = evt.target?.result as string;
            resolve({
              fileName: file.name,
              fileContent: result,
              isBase64: true
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        } else {
          reader.onload = (evt) => {
            const result = evt.target?.result as string;
            resolve({
              fileName: file.name,
              fileContent: result,
              isBase64: false
            });
          };
          reader.onerror = reject;
          reader.readAsText(file);
        }
      });
    };

    try {
      for (const file of filesArray) {
        const payload = await readFile(file);
        payloads.push(payload);
      }

      const res = await fetch('/api/stock/upload-dynamic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: payloads })
      });

      const responseText = await res.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        data = { error: `Réponse serveur non-JSON (${res.status} ${res.statusText})` };
      }

      if (res.ok && data.success) {
        setParsingReport({
          message: data.message,
          stats: data.stats,
          warnings: data.warnings || []
        });

        const newImported = filesArray.map(f => ({
          name: f.name,
          size: (f.size / 1024).toFixed(1) + ' KB',
          type: f.name.toLowerCase().endsWith('.zip')
            ? `Archive ZIP (Décompressée par l'IA)`
            : `Document unique (${data.stats?.totalInserted || 0} articles)`
        }));

        setImportedFiles(prev => [...prev, ...newImported]);
        await fetchProducts();
      } else {
        alert(`❌ Erreur d'extraction par l'IA : ${data.error || responseText || 'Impossible de parser le ou les fichiers'}`);
      }
    } catch (err: any) {
      alert(`❌ Erreur lors de la lecture des fichiers : ${err.message}`);
    } finally {
      setParsingLoading(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un produit, une référence..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex-1 sm:flex-initial border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg text-sm transition shadow-sm flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Importer Fichiers (Parsing OpenAI LLM)
          </button>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition shadow-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter Manuellement
          </button>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase font-semibold text-xs border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Article</th>
                <th className="px-6 py-4">Prix MAD</th>
                <th className="px-6 py-4">Catégorie</th>
                <th className="px-6 py-4">Variantes &amp; Quantités</th>
                <th className="px-6 py-4">Attributs Extra (Metadata JSONB)</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-500 truncate w-48">{product.description}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 font-bold text-gray-900">
                    {product.price} MAD
                  </td>

                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border border-gray-200">
                      {product.category}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {product.variants.map((v, i) => (
                        <div
                          key={i}
                          className="text-xs px-2 py-1 rounded border flex items-center gap-2 bg-gray-50"
                        >
                          <span className="font-medium text-gray-800">{v.color} - {v.size}</span>
                          <span className={`font-semibold ${v.qty > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            ({v.qty})
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>

                  {/* Metadata Column */}
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {product.metadata && Object.keys(product.metadata).length > 0 ? (
                        Object.entries(product.metadata).map(([k, v], idx) => (
                          <span key={idx} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 font-mono">
                            {k}: {String(v)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">Aucune</span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => handleDeleteProduct(product.id)} className="text-gray-400 hover:text-red-600 transition p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Aucun produit dans votre stock. Utilisez "Importer Fichiers (Parsing OpenAI)" ou "Ajouter Manuellement".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD PRODUCT */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative z-10 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Ajouter un produit au stock</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nom du Produit *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="ex: Djellaba Soie"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Prix Ferme (MAD) *</label>
                  <input
                    type="number"
                    required
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    placeholder="ex: 850"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Catégorie</label>
                  <input
                    type="text"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    placeholder="ex: Femme, Accessoires"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Description (Optionnel)</label>
                  <input
                    type="text"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="ex: Tissu haute qualité..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Variants */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Variantes &amp; Quantités en Stock</h4>
                  <button type="button" onClick={handleAddVariant} className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Ajouter une variante
                  </button>
                </div>

                <div className="space-y-3">
                  {newProduct.variants.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <input
                        type="text"
                        placeholder="Couleur (ex: Blanc)"
                        value={v.color}
                        onChange={(e) => {
                          const copy = [...newProduct.variants];
                          copy[idx].color = e.target.value;
                          setNewProduct({ ...newProduct, variants: copy });
                        }}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Taille (ex: M)"
                        value={v.size}
                        onChange={(e) => {
                          const copy = [...newProduct.variants];
                          copy[idx].size = e.target.value;
                          setNewProduct({ ...newProduct, variants: copy });
                        }}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Qté"
                        value={v.qty}
                        onChange={(e) => {
                          const copy = [...newProduct.variants];
                          copy[idx].qty = parseInt(e.target.value) || 0;
                          setNewProduct({ ...newProduct, variants: copy });
                        }}
                        className="w-24 px-3 py-1.5 border border-gray-300 rounded text-xs"
                      />
                      {newProduct.variants.length > 1 && (
                        <button type="button" onClick={() => handleRemoveVariant(idx)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-200">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-1.5">
                  <Save className="w-4 h-4" /> Enregistrer le produit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BATCH UPLOAD FILES / OPENAI DYNAMIC PARSER */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowUploadModal(false)}></div>
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative z-10 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Parser &amp; Structurer des Fichiers ou Archives ZIP via OpenAI
                </h3>
                <p className="text-xs text-gray-500">Formats supportés : CSV, XLSX, PDF, TXT, MD &amp; Archives ZIP (Multi-fichiers simultanés)</p>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {parsingLoading ? (
                <div className="py-12 text-center space-y-4">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
                  <div>
                    <p className="font-bold text-gray-900 text-base">Analyse &amp; Décompression en cours par l'IA OpenAI...</p>
                    <p className="text-xs text-gray-500 mt-1">Extraction multi-fichiers / ZIP : Produits, prix MAD, variantes et metadata...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Dropzone */}
                  <div className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-xl p-8 text-center bg-gray-50 hover:bg-indigo-50/20 transition cursor-pointer flex flex-col items-center justify-center">
                    <UploadCloud className="w-10 h-10 text-indigo-600 mb-2" />
                    <p className="font-semibold text-gray-900 text-sm">Glissez-déposez vos fichiers ou une archive ZIP ici</p>
                    <p className="text-xs text-gray-500 mt-1">L'IA décompressera automatiquement les archives ZIP et analysera tous les documents.</p>
                    <input type="file" id="fileUploadInput" multiple onChange={handleFileSelect} className="hidden" />
                    <button
                      type="button"
                      onClick={() => document.getElementById('fileUploadInput')?.click()}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-md hover:bg-indigo-700 transition flex items-center gap-2"
                    >
                      <UploadCloud className="w-4 h-4" /> Parcourir Fichiers / Archive ZIP
                    </button>
                  </div>

                  {/* Inspection Report */}
                  {parsingReport && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        Rapport d'Extraction Multi-Fichiers OpenAI LLM
                      </div>
                      <p className="text-xs text-emerald-700">{parsingReport.message}</p>
                      
                      <div className="flex flex-wrap gap-4 text-xs font-medium text-emerald-900 bg-white/60 p-3 rounded-lg border border-emerald-100">
                        <div>📦 Produits insérés : <strong>{parsingReport.stats.totalInserted}</strong></div>
                        <div>📄 Fichiers traités : <strong>{parsingReport.stats.processedFiles?.length || 1}</strong></div>
                        <div>🏷️ Champs Extra Capturés : <strong>{parsingReport.stats.extraFieldsFound.join(', ') || 'Aucun'}</strong></div>
                      </div>

                      {parsingReport.warnings.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800">
                          <p className="font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-amber-600" /> Avertissements &amp; Remarques :</p>
                          <ul className="list-disc ml-5 mt-1 space-y-0.5">
                            {parsingReport.warnings.map((w, idx) => (
                              <li key={idx}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Active Files */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Fichiers analysés récemment</h4>
                    <div className="space-y-2">
                      {importedFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg text-xs">
                          <div className="flex items-center gap-3">
                            <FileUp className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">{file.name}</p>
                              <p className="text-gray-400 text-[10px]">{file.size} • {file.type}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-medium rounded text-[10px] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Structuré
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-5 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-indigo-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
