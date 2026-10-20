import dotenv from 'dotenv'
dotenv.config()

if (!process.env.MONGODB_URI)
{
    console.log('MONGODB_URI not define');
}

const Config = {
    MONGODB_URI : process.env.MONGODB_URI
}

export default Config   