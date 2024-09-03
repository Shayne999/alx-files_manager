const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, type, parentId = '0', isPublic = false, data } = req.body;

      if (!name) return res.status(400).json({ error: 'Missing name' });
      if (!['folder', 'file', 'image'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type' });
      }

      if (type !== 'folder' && !data) {
        return res.status(400).json({ error: 'Missing data' });
      }

      let parentFile = null;
      if (parentId !== '0') {
        parentFile = await dbClient.db.collection('files').findOne({ _id: dbClient.getObjectId(parentId) });
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
        const result = await dbClient.db.collection('files').insertOne(fileDocument);
        return res.status(201).json({ id: result.insertedId, ...fileDocument });
      }

      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const localPath = path.join(folderPath, uuidv4());
      const fileBuffer = Buffer.from(data, 'base64');

      try {
        fs.writeFileSync(localPath, fileBuffer);
      } catch (error) {
        return res.status(500).json({ error: 'Failed to save file to disk' });
      }

      fileDocument.localPath = localPath;

      try {
        const result = await dbClient.db.collection('files').insertOne(fileDocument);
        
        // Add a job to fileQueue if the file type is image
        if (type === 'image') {
          await fileQueue.add({ userId, fileId: result.insertedId });
        }

        return res.status(201).json({ id: result.insertedId, ...fileDocument });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to save file to database' });
      }
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }


  //pusblishing and unpublishing files
   // PUT /files/:id/publish
   static async putPublish(req, res) {
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

    // Update the file's isPublic status to true
    await dbClient.db.collection('files').updateOne(
      { _id: dbClient.getObjectId(fileId) },
      { $set: { isPublic: true } }
    );

    const updatedFile = await dbClient.db.collection('files').findOne({
      _id: dbClient.getObjectId(fileId),
    });

    return res.status(200).json(updatedFile);
  }

  // PUT /files/:id/unpublish
  static async putUnpublish(req, res) {
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

    // Update the file's isPublic status to false
    await dbClient.db.collection('files').updateOne(
      { _id: dbClient.getObjectId(fileId) },
      { $set: { isPublic: false } }
    );

    const updatedFile = await dbClient.db.collection('files').findOne({
      _id: dbClient.getObjectId(fileId),
    });

    return res.status(200).json(updatedFile);
  }


  static async getShow(req, res) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
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
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getIndex(req, res) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
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
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }


  //retrieves files based on ownership and file type
  static async getFile(req, res) {
    const token = req.headers.authorization?.split(' ')[1];
    const fileId = req.params.id;
    const size = req.query.size;
  
    try {
      const file = await dbClient.db.collection('files').findOne({
        _id: dbClient.getObjectId(fileId),
      });
  
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }
  
      if (file.type === 'folder') {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }
  
      const userId = token ? await redisClient.get(`auth_${token}`) : null;
      if (!file.isPublic && (!userId || file.userId !== userId)) {
        return res.status(404).json({ error: 'Not found' });
      }
  
      let filePath = file.localPath;
  
      if (size && ['500', '250', '100'].includes(size)) {
        const thumbnailPath = `${file.localPath}_${size}`;
        if (fs.existsSync(thumbnailPath)) {
          filePath = thumbnailPath;
        } else {
          return res.status(404).json({ error: 'Not found' });
        }
      }
  
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Not found' });
      }
  
      const mimeType = mime.lookup(file.name) || 'application/octet-stream';
  
      fs.readFile(filePath, (err, data) => {
        if (err) {
          return res.status(500).json({ error: 'Error reading file' });
        }
  
        res.setHeader('Content-Type', mimeType);
        res.send(data);
      });
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

}

module.exports = FilesController;
