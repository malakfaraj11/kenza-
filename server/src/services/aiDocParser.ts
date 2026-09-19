import { ChatOpenAI } from '@langchain/openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface ParsedProduct {
  ref?: string;
  modele: string;
  prix_mad: number;
  famille: string;
  couleur: string;
  taille: string;
  stock: number;
  metadata: Record<string, any>;
}

export interface ParsingResult {
  products: ParsedProduct[];
  warnings: string[];
  rawStats: {
    totalExtracted: number;
    extraFieldsFound: string[];
    processedFiles: string[];
  };
}

export interface FileInputPayload {
  fileName: string;
  fileContent: string; // texte brut ou base64
  isBase64?: boolean;
}

export interface ExtractedFile {
  fileName: string;
  content: string;
}

const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico',
  '.mp4', '.mp3', '.mov', '.avi', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.pdf', '.exe', '.bin', '.ds_store', '.pyc', '.db', '.sqlite'
]);

function isSupportedTextFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  if (IGNORED_EXTENSIONS.has(ext)) return false;
  return true;
}

/**
 * Décompresse les fichiers ZIP et rassemble tous les fichiers textes/documents.
 */
export function extractFilesFromPayloads(payloads: FileInputPayload[]): ExtractedFile[] {
  const result: ExtractedFile[] = [];

  for (const item of payloads) {
    const fileName = item.fileName;
    const isZip = fileName.toLowerCase().endsWith('.zip') || (item.isBase64 && (item.fileContent.startsWith('data:application/zip') || item.fileContent.startsWith('data:application/x-zip-compressed')));

    if (isZip || fileName.toLowerCase().endsWith('.zip')) {
      try {
        console.log(`📦 [ZIP Extractor] Analyse de l'archive ZIP "${fileName}"...`);
        let base64Data = item.fileContent;
        if (base64Data.includes(';base64,')) {
          base64Data = base64Data.split(';base64,')[1];
        }
        const buffer = Buffer.from(base64Data, 'base64');
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();

        for (const entry of zipEntries) {
          const entryName = entry.entryName;
          const baseName = path.basename(entryName);
          
          if (!entry.isDirectory && !entryName.includes('__MACOSX') && !baseName.startsWith('.') && isSupportedTextFile(entryName)) {
            const entryText = entry.getData().toString('utf8');
            if (entryText.trim()) {
              console.log(`📄 [ZIP Extractor] Document valide trouvé : "${entryName}" (${entryText.length} caractères)`);
              result.push({
                fileName: entryName,
                content: entryText
              });
            }
          } else if (!entry.isDirectory && !isSupportedTextFile(entryName)) {
            console.log(`⏭️ [ZIP Extractor] Fichier non-texte ignoré : "${entryName}"`);
          }
        }
      } catch (err: any) {
        console.error(`❌ Erreur de décompression ZIP pour "${fileName}":`, err.message);
      }
    } else {
      let content = item.fileContent;
      if (item.isBase64 && content.includes(';base64,')) {
        content = Buffer.from(content.split(';base64,')[1], 'base64').toString('utf8');
      }
      if (content.trim()) {
        result.push({
          fileName: fileName,
          content: content
        });
      }
    }
  }

  return result;
}

/**
 * Single document parsing with temperature fix
 */
export async function parseDocumentWithOpenAI(rawContent: string, fileName: string): Promise<ParsingResult> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_BACKUP;
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const modelName = process.env.LLM_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    throw new Error("Clé API OpenAI manquante dans les variables d'environnement (.env).");
  }

  const llm = new ChatOpenAI({
    modelName: modelName,
    apiKey: apiKey,
    configuration: {
      baseURL: baseURL
    }
  });

  const prompt = `Tu es l'Expert Absolu en Extraction et Structuration de Données Commerciales (OpenAI).
Ta mission est d'analyser le contenu brut ci-dessous issu du fichier "${fileName}" et d'extraire TOUS les produits et leurs variantes sous forme d'un tableau JSON strict.

RÈGLES D'EXTRACTION & DE VALEURS MANQUANTES (ROBUSTESSE TRÈS ÉLEVÉE) :
1. "modele" (Obligatoire) : Nom complet du produit. Si absent ou confus, génère un nom explicite.
2. "prix_mad" (Obligatoire) : Prix en chiffre numérique (si absent, mets 0).
3. "famille" : Catégorie du produit (ex: "Vêtements", "Chaussures", "Accessoires", "Femme", "Homme"). Si absente, mets "Mode".
4. "couleur" : Couleur principale (si absente, mets "Unique").
5. "taille" : Taille (ex: S, M, L, XL, 42, Unique). Si absente, mets "Unique".
6. "stock" : Nombre d'unités disponibles en chiffre (si absent, mets 1).
7. "metadata" (TRÈS IMPORTANT - DONNÉES SUPPLÉMENTAIRES) :
   - Place TOUTES les autres informations ou colonnes supplémentaires (matière, saison, code barre, poids, remarques, rabais, conseils d'utilisation) dans l'objet "metadata".
   - Ne jette AUCUNE information supplémentaire.

FORMAT DE RÉPONSE STRICTEMENT EXIGÉ (JSON pur sans texte explicatif) :
{
  "products": [
    {
      "ref": "REF-001",
      "modele": "Caftan Velours Doré",
      "prix_mad": 1500,
      "famille": "Femme",
      "couleur": "Rouge",
      "taille": "L",
      "stock": 5,
      "metadata": {
        "matiere": "Velours de soie",
        "saison": "2026",
        "code_barre": "611100200",
        "remarques": "Broderie artisanale"
      }
    }
  ],
  "warnings": [
    "Avertissement si un prix ou un nom a dû être déduit"
  ]
}

CONTENU BRUT DU FICHIER À ANALYSER :
------------------------------------
${rawContent.slice(0, 15000)}
------------------------------------`;

  try {
    const response = await llm.invoke([
      { role: 'system', content: 'Tu es un parseur JSON de données commerciales. Tu réponds exclusivement en JSON valide.' },
      { role: 'user', content: prompt }
    ]);

    const responseText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    
    const cleanedJson = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanedJson);
    const rawProducts = parsed.products || [];
    const warnings: string[] = parsed.warnings || [];

    const extraFieldsSet = new Set<string>();

    const validatedProducts: ParsedProduct[] = rawProducts.map((p: any, idx: number) => {
      const modele = p.modele || p.name || `Article ${idx + 1}`;
      const prix_mad = typeof p.prix_mad === 'number' ? p.prix_mad : (parseFloat(p.prix_mad) || 0);
      const famille = p.famille || p.category || 'Mode';
      const couleur = p.couleur || p.color || 'Unique';
      const taille = p.taille || p.size || 'Unique';
      const stock = typeof p.stock === 'number' ? p.stock : (parseInt(p.stock, 10) || 1);
      const metadata = typeof p.metadata === 'object' && p.metadata !== null ? p.metadata : {};

      Object.keys(metadata).forEach(k => extraFieldsSet.add(k));

      if (prix_mad === 0) {
        warnings.push(`Article "${modele}" dans ${fileName} : Prix non spécifié, configuré par défaut à 0 MAD.`);
      }

      return {
        ref: p.ref || `REF-${Date.now()}-${Math.floor(Math.random()*10000)}`,
        modele,
        prix_mad,
        famille,
        couleur,
        taille,
        stock,
        metadata
      };
    });

    return {
      products: validatedProducts,
      warnings,
      rawStats: {
        totalExtracted: validatedProducts.length,
        extraFieldsFound: Array.from(extraFieldsSet),
        processedFiles: [fileName]
      }
    };
  } catch (err: any) {
    console.error(`❌ [OpenAI Doc Parser Error] (${fileName}):`, err);
    throw new Error(`Échec du parsing par OpenAI pour ${fileName} : ${err.message}`);
  }
}

/**
 * Traite plusieurs fichiers (incluant la décompression de fichiers ZIP) et agrège les résultats.
 */
export async function parseMultipleDocumentsWithOpenAI(payloads: FileInputPayload[]): Promise<ParsingResult> {
  const extractedFiles = extractFilesFromPayloads(payloads);
  
  if (extractedFiles.length === 0) {
    throw new Error("Aucun fichier texte/document valide ou exploitable n'a été trouvé dans les éléments ou le ZIP uploadé.");
  }

  const allProducts: ParsedProduct[] = [];
  const allWarnings: string[] = [];
  const extraFieldsSet = new Set<string>();
  const processedFiles: string[] = [];

  console.log(`🚀 [OpenAI Parser] Début de l'analyse de ${extractedFiles.length} document(s)...`);

  for (let i = 0; i < extractedFiles.length; i++) {
    const file = extractedFiles[i];
    console.log(`🤖 [OpenAI Parser] Analyse (${i + 1}/${extractedFiles.length}) : "${file.fileName}"...`);
    try {
      const res = await parseDocumentWithOpenAI(file.content, file.fileName);
      console.log(`✅ [OpenAI Parser] Fichier "${file.fileName}" analysé : ${res.products.length} produit(s) extrait(s).`);
      allProducts.push(...res.products);
      allWarnings.push(...res.warnings);
      res.rawStats.extraFieldsFound.forEach(k => extraFieldsSet.add(k));
      processedFiles.push(file.fileName);
    } catch (fileErr: any) {
      console.error(`❌ [OpenAI Parser] Erreur sur "${file.fileName}":`, fileErr.message);
      allWarnings.push(`Erreur sur "${file.fileName}": ${fileErr.message}`);
    }
  }

  return {
    products: allProducts,
    warnings: allWarnings,
    rawStats: {
      totalExtracted: allProducts.length,
      extraFieldsFound: Array.from(extraFieldsSet),
      processedFiles
    }
  };
}
