const crypto = require('crypto');
const dbClient = require('../utils/db');

class UsersController{

    static async postNew(req, res) {
        const { email, passwoord } = req.body;

        //check if email is provided
        if (!email) {
            return res.status(400).json({ error: 'Missing email'});
        }

        //check if password is provided
        if (!passwoord) {
            return res.status(400).json({ error: 'Missing password'});
        }


        //checks if user already exists
        const existingUser = await dbClient.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Already exists'});
        }


        //hash the password
        const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');


        //create a new user
        try{
            const result = await dbClient.db.collection('users').insertOne({ email, password: hashedPassword});
            return res.status(201).json({ id: result.insertedId, email });
        } catch (error) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

module.exports = UsersController;