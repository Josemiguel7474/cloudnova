// Upload e listagem de ficheiros no Azure Blob Storage (acesso via Private Endpoint)
const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = process.env.STORAGE_CONTAINER || 'ficheiros-empresa';
let containerClient = null;

function getContainer() {
  if (!containerClient) {
    const conn = process.env.STORAGE_CONNECTION_STRING;
    if (!conn) throw new Error('STORAGE_CONNECTION_STRING em falta');
    containerClient = BlobServiceClient.fromConnectionString(conn).getContainerClient(CONTAINER);
  }
  return containerClient;
}

async function upload(nome, buffer, contentType) {
  const c = getContainer();
  await c.createIfNotExists();
  const safe = `${Date.now()}-${nome.replace(/[^\w.\-]/g, '_')}`;
  await c.getBlockBlobClient(safe).uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
  return safe;
}

async function listar() {
  const c = getContainer();
  await c.createIfNotExists();
  const itens = [];
  for await (const b of c.listBlobsFlat()) {
    itens.push({ nome: b.name, tamanho: b.properties.contentLength });
  }
  return itens;
}

module.exports = { upload, listar };
