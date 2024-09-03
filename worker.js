const Bull = require('bull');
const fileQueue = new Bull('fileQueue');
const dbClient = require('./utils/db');
const fs = require('fs');
const path = require('path');
const imageThumbnail = require('image-thumbnail');

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }

  const file = await dbClient.db.collection('files').findOne({
    _id: dbClient.getObjectId(fileId),
    userId,
  });

  if (!file) {
    throw new Error('File not found');
  }

  if (file.type !== 'image' || !file.localPath) {
    throw new Error('Invalid file type or missing local path');
  }

  const sizes = [500, 250, 100];

  for (const size of sizes) {
    try {
      const thumbnail = await imageThumbnail(file.localPath, { width: size });
      const thumbnailPath = `${file.localPath}_${size}`;

      fs.writeFileSync(thumbnailPath, thumbnail);
    } catch (error) {
      console.error(`Failed to generate thumbnail for size ${size}:`, error);
    }
  }
});
