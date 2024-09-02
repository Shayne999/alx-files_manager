const { MongoClient } = require('mongodb');

const DB_DATABASE = process.env.DB_DATABASE || 'files_manager';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 27017;

class DBClient {

    constructor() {
        const url = `mongodb://${DB_HOST}:${DB_PORT}`;
        this.client = new MongoClient(url, { useUnifiedTopology: true });
        this.db = null;

        this.client.connect()
            .then(() => {
                this.db = this.client.db(DB_DATABASE);
                console.log('Connected to MongoDB');
            })
            .catch((err) => {
                console.log('Falied to connect to MongoDB:', err);
            });

    }


    // checks if the db client is alive
    isAlive() {
        return this.client && this.client.topology && this.client.topology.isConnected();
    }


    //gets the number of documents is the user collection
    async nbUsers() {
        if (!this.db) return 0;
        try {
            const count = await this.db.collection('users').countDocuments();
            return count;
        } catch (err) {
            console.error('Error counting users:', err);
            return 0;
        }
    }

    //gets the number of documents in the files collection
    async nbFiles() {
        if (!this.db) return 0;
        try {
            const count = await this.db.collection('files').countDocuments();
            return count;
        } catch (err) {
            console.error('Error counting files:', err);
            return 0;
        }
    }
}

const dbClient = new DBClient();
module.exports = dbClient;