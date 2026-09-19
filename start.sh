#!/bin/bash

# Script de lancement unifié pour Mac - Projet Kenza

echo "=========================================="
echo "🤖 Lancement de l'écosystème Kenza..."
echo "=========================================="

echo ""
echo "📦 1. Démarrage des conteneurs Docker (Postgres, Redis, Evolution API)..."
docker compose up -d
docker start evolution-api

# Patch automatique de compatibilité WhatsApp LID et multi-devices pour Evolution API
docker exec evolution-api node -e '
const fs = require("fs");
const file = "/evolution/dist/src/api/services/channels/whatsapp.baileys.service.js";
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes("!isWA.jid.includes(\x27@lid\x27)")) {
    content = content.replace("!isWA.jid.includes(\x27@broadcast\x27)", "!isWA.jid.includes(\x27@broadcast\x27) && !isWA.jid.includes(\x27@lid\x27)");
    fs.writeFileSync(file, content);
  }
}
const baileysSend = "/evolution/node_modules/baileys/lib/Socket/messages-send.js";
if (fs.existsSync(baileysSend)) {
  let bContent = fs.readFileSync(baileysSend, "utf8");
  if (!bContent.includes("failed to encrypt for device, skipping")) {
    const target = "const { type, ciphertext } = await signalRepository\n                .encryptMessage({ jid, data: bytes });\n            if (type === \x27pkmsg\x27) {\n                shouldIncludeDeviceIdentity = true;\n            }\n            const node = {\n                tag: \x27to\x27,\n                attrs: { jid },\n                content: [{\n                        tag: \x27enc\x27,\n                        attrs: {\n                            v: \x272\x27,\n                            type,\n                            ...extraAttrs || {}\n                        },\n                        content: ciphertext\n                    }]\n            };\n            return node;";
    const repl = "try {\n                const { type, ciphertext } = await signalRepository\n                    .encryptMessage({ jid, data: bytes });\n                if (type === \x27pkmsg\x27) {\n                    shouldIncludeDeviceIdentity = true;\n                }\n                return {\n                    tag: \x27to\x27,\n                    attrs: { jid },\n                    content: [{\n                            tag: \x27enc\x27,\n                            attrs: {\n                                v: \x272\x27,\n                                type,\n                                ...extraAttrs || {}\n                            },\n                            content: ciphertext\n                        }]\n                };\n            } catch (err) {\n                logger.warn({ jid, err: err.message }, \x27failed to encrypt for device, skipping\x27);\n                return null;\n            }";
    if (bContent.includes(target)) {
      bContent = bContent.replace(target, repl).replace("return { nodes, shouldIncludeDeviceIdentity };", "return { nodes: nodes.filter(Boolean), shouldIncludeDeviceIdentity };");
      fs.writeFileSync(baileysSend, bContent);
    }
  }
}
' >/dev/null 2>&1 || true

echo ""
echo "🌐 2. Démarrage de Ngrok (pour WhatsApp)..."
echo "⚠️  Ngrok va s'ouvrir en tâche de fond. Pour récupérer l'URL publique, ouvre un navigateur sur http://localhost:4040"
nohup npx ngrok http 3005 > ngrok.log 2>&1 &

echo ""
echo "🚀 3. Démarrage de l'application (Backend + Frontend)..."
echo "👉 Dashboard  : http://localhost:5173"
echo "👉 Serveur API: http://localhost:3005"
echo "=========================================="
echo "Pour arrêter ngrok plus tard : killall ngrok"
echo ""

# Lance le projet en direct pour voir les logs
npm run dev
