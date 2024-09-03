const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve the user based on the token
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId = '0', isPublic = false, data } = req.body;

    // Validate the required fields
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    // Validate parentId
    let parentFile = null;
    if (parentId !== '0') {
      parentFile = await dbClient.collection('files').findOne({ _id: dbClient.getObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileDocument = {
      userId,
      name,
      type,
      isPublic,
      parentId,
    };

    if (type === 'folder') {
      // Save folder to the database
      const result = await dbClient.collection('files').insertOne(fileDocument);
      return res.status(201).json(result.ops[0]);
    }

    // Handle file or image saving
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const localPath = path.join(folderPath, uuidv4());
    const fileBuffer = Buffer.from(data, 'base64');

    // Save the file to disk
    try {
      fs.writeFileSync(localPath, fileBuffer);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to save file to disk' });
    }

    fileDocument.localPath = localPath;

    // Save the file document to the database
    try {
      const result = await dbClient.collection('files').insertOne(fileDocument);
      return res.status(201).json(result.ops[0]);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to save file to database' });
    }
  }



  static async getShow(req, res) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({
        _id: dbClient.getObjectId(fileId),
        userId: userId,
    });

    if (!file) {
        return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
}

    // GET /files
    static async getIndex(req, res) {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = await redisClient.get(`auth_${token}`);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const parentId = req.query.parentId || '0';
        const page = parseInt(req.query.page, 10) || 0;
        const pageSize = 20;

        const files = await dbClient.db.collection('files').aggregate([
            { $match: { userId: userId, parentId: parentId } },
            { $skip: page * pageSize },
            { $limit: pageSize },
        ]).toArray();

        return res.status(200).json(files);
    }
}

module.exports = FilesController;
