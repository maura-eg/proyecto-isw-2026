require('dotenv').config();
const { crearApp } = require('./src/app');

const PORT = process.env.PORT || 1303;
const app = crearApp();

app.listen(PORT, () => {
  console.log(`Backend corriendo en el puerto ${PORT}`);
});
