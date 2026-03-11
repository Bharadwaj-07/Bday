/**
 * Migrate all data from local MongoDB to Atlas.
 * 
 * Copies: pins, photos (documents + GridFS files), musics (documents + GridFS files)
 * 
 * Usage: node migrate-to-atlas.js
 */

require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const { MongoClient, GridFSBucket } = require('mongodb');

const LOCAL_URI  = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017/photomap';
const ATLAS_URI  = process.env.MONGODB_URI;

if (!ATLAS_URI) {
  console.error('❌  MONGODB_URI is not set in .env');
  process.exit(1);
}

async function migrateCollection(localDb, atlasDb, collName) {
  const docs = await localDb.collection(collName).find({}).toArray();
  if (docs.length === 0) {
    console.log(`  ⏭️  ${collName}: 0 documents, skipping`);
    return 0;
  }
  // Drop existing in Atlas to avoid duplicates
  try { await atlasDb.collection(collName).drop(); } catch {}
  await atlasDb.collection(collName).insertMany(docs);
  console.log(`  ✅  ${collName}: ${docs.length} documents migrated`);
  return docs.length;
}

async function migrateGridFS(localDb, atlasDb, bucketName) {
  const localBucket  = new GridFSBucket(localDb, { bucketName });
  const atlasBucket  = new GridFSBucket(atlasDb, { bucketName });

  const files = await localDb.collection(`${bucketName}.files`).find({}).toArray();
  if (files.length === 0) {
    console.log(`  ⏭️  ${bucketName} GridFS: 0 files, skipping`);
    return 0;
  }

  // Drop existing GridFS collections in Atlas
  try { await atlasDb.collection(`${bucketName}.files`).drop(); } catch {}
  try { await atlasDb.collection(`${bucketName}.chunks`).drop(); } catch {}

  let migrated = 0;
  for (const file of files) {
    try {
      // Download from local
      const chunks = [];
      await new Promise((resolve, reject) => {
        const stream = localBucket.openDownloadStream(file._id);
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      const buffer = Buffer.concat(chunks);

      // Upload to Atlas with same _id
      await new Promise((resolve, reject) => {
        const { Readable } = require('stream');
        const uploadStream = atlasBucket.openUploadStreamWithId(
          file._id,
          file.filename,
          {
            contentType: file.contentType,
            metadata: file.metadata,
          }
        );
        const readable = Readable.from(buffer);
        readable.pipe(uploadStream);
        uploadStream.on('finish', resolve);
        uploadStream.on('error', reject);
      });
      migrated++;
      process.stdout.write(`\r  📦  ${bucketName} GridFS: ${migrated}/${files.length} files`);
    } catch (err) {
      console.error(`\n  ❌  Failed to migrate file ${file.filename}: ${err.message}`);
    }
  }
  console.log(`\n  ✅  ${bucketName} GridFS: ${migrated} files migrated`);
  return migrated;
}

async function main() {
  console.log('🔗  Connecting to local MongoDB...');
  const localClient = new MongoClient(LOCAL_URI);
  await localClient.connect();
  const localDb = localClient.db('photomap');

  console.log('🔗  Connecting to MongoDB Atlas...');
  const atlasClient = new MongoClient(ATLAS_URI);
  await atlasClient.connect();
  const atlasDb = atlasClient.db('photomap');

  console.log('\n📋  Migrating collections...');

  // List all collections in local
  const collections = await localDb.listCollections().toArray();
  const collNames = collections.map(c => c.name);
  console.log(`  Found collections: ${collNames.join(', ')}`);

  // Migrate document collections (skip GridFS internal ones)
  const gridfsCollections = new Set();
  for (const name of collNames) {
    if (name.endsWith('.files') || name.endsWith('.chunks')) {
      gridfsCollections.add(name.replace(/\.(files|chunks)$/, ''));
      continue;
    }
    await migrateCollection(localDb, atlasDb, name);
  }

  // Migrate GridFS buckets
  console.log('\n📦  Migrating GridFS files...');
  for (const bucketName of gridfsCollections) {
    await migrateGridFS(localDb, atlasDb, bucketName);
  }

  // Copy indexes
  console.log('\n📇  Recreating indexes...');
  for (const name of collNames) {
    if (name.endsWith('.files') || name.endsWith('.chunks')) continue;
    try {
      const indexes = await localDb.collection(name).indexes();
      for (const idx of indexes) {
        if (idx.name === '_id_') continue; // skip default
        try {
          await atlasDb.collection(name).createIndex(idx.key, {
            name: idx.name,
            unique: idx.unique || false,
            sparse: idx.sparse || false,
            ...(idx['2dsphereIndexVersion'] ? {} : {}),
          });
        } catch {}
      }
    } catch {}
  }
  console.log('  ✅  Indexes recreated');

  // Summary
  console.log('\n🎉  Migration complete!');

  await localClient.close();
  await atlasClient.close();
}

main().catch(err => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
