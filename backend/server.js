import app from './app.js';
import env from 'dotenv';
env.config();
const PORT = process.env.PORT || 5000;
app.listen(PORT,()=>{
    console.log(`server running on ${PORT}`);
});