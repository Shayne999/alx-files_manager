const redis = require('redis');

class RedisClient {

    //create a redis client
    constructor() {
        this.client = redis.createClient();

        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });
    }

    //checks if the redis client is alive
    isAlive() {
        return this.client.connected;
    }


    //get a value from redis by key
    async get(key) {
        return new Promise((resolve, reject) => {
            this.client.get(key, (err, result) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    async set(key, value, duration) {
        return new Promise((resolve, reject) => {
            this.client.setex(key, duration, value, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async del(key) {
        return new Promise((resolve, reject) => {
            this.client.del(key, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

const redisClient = new RedisClient();
module.exports = redisClient;