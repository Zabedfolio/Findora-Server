import express from 'express'
import ConnectedDB from './config/db.js'
import cors from 'cors'
import itemRouter from './routes/itme.route.js'
import dashboardRouter from './routes/dashboard.route.js'
import claimRouter from './routes/claim.route.js'
import handoverRouter from './routes/handover.route.js'

const app = express()
const PORT = process.env.PORT || 5000

// middleware
app.use(express.json())
app.use(cors()) 

// Connect database 
ConnectedDB()

app.get('/', (req, res) => {
    res.send('Server is running!.. ')
})

app.use('/api/items', itemRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/claims', claimRouter)
app.use('/api/handovers', handoverRouter)

app.listen(PORT, ()=> {
    console.log(`Server running on ${PORT}`);
})