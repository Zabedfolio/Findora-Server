import express from 'express'
import ConnectedDB from './config/db.js'
const app = express ()
const PORT = process.env.PORT || 5000


// Connect database 
ConnectedDB()

app.listen(PORT, ()=> {
    console.log(`Server running on ${PORT}`);
})