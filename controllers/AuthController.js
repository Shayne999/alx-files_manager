const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class AuthController {

    //user sign in and generate a token
    static async getConnect(req, res) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Basic ')) {
            return res.status(401).json({ error: 'Unauthorized'});
        }

        //decode the base64 credentials
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [email, password] = credentials.split(':');

        //check if user exists
        const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
        const user = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized'});
        }

        //generate a token
        const token = uuidv4();
        const key = `auth_${token}`;

        //store the token in redis
        await redisClient.set(key, user._id.toString(), 'EX', 24 * 3600);
        return res.status(200).json ({ token });

    }

    //sign out and delete the redis token
    static async getDisconnect(req, res) {
        const token = req.headers['x-token'];
        if(!token) {
            return res.status(401).json({ error: 'Unauthorized'});
        }


        //check if token exists
        const key = `auth_${token}`;
        const userId = await redisClient.get(key);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized'});
        }

        //delete token
        await redisClient.del(key);
        return res.status(204).send();
    }
}

module.exports = AuthController