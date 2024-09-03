const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');


class FilesController{

    static async postUpload(req, res) {
        const token = req.header['authorization']?.split(' ')[1];
        if(!token) {
            return res.status(401).json({ error: 'Unauthorized'});
        }

        //usese the token to retrieve user
        const userId = await redisClient.get(`auth_${token}`);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized'});
        }

        const { name, type,parentId = '0', isPublic = false, data } = req.body;

        //validate teh required fields
        if (!name) return res.status(400).json({ error: 'Missing name'});
        if (!['folder', 'file', 'image'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type'});
        }

        if (type != 'folder' && !data) {
            return res.status(400).json({ error: 'Missing data'});
        }

        //validate parentId
        let parentFile = null;
        if (parentId !== '0') {
            parentFile = await dbClient.db.collection('files').findOne({ _id: dbClient.getObjectId(parentId) });
            if (!parentFile) {
                return res.status(400).json({ error: 'Parent not found' });
            }

            if (parentFile.type !== 'folder') {
                return res.status(400).json({ error: 'Parent is not a folder'});
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
            //save folder to db
            const result = await dbClient.collection('files').insertOne(fileDocument);
            return res.status(201).json(result.ops[0]);
        }

        //handle file or image download
        const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        const localPath = path.join(folderPath, uuidv4());
        const fileBuffer = Buffer.from(data, 'base64');

        //save file to disk
        fs.writeFileSync(localPath, fileBuffer);
        fileDocument.data = localPath;

        //savefile to db
        const result = await dbClient.collection('files').insertOne(fileDocument);
        return res.status(201).json(result.ops[0]);
    }

}

module.exports = FilesController;