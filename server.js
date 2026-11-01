const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuração do Banco de Dados PostgreSQL do Render com SSL obrigatório
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Cria a tabela de mensagens caso ela ainda não exista
pool.query(`
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100),
    text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error("Erro ao criar tabela:", err));

// Servir os arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('Um usuário se conectou.');

  // Envia as últimas mensagens salvas no banco quando alguém entra
  pool.query('SELECT username, text FROM messages ORDER BY id ASC LIMIT 50')
    .then(result => {
      socket.emit('load_history', result.rows);
    })
    .catch(err => console.error("Erro ao carregar histórico:", err));

  // Ouve quando o usuário envia uma nova mensagem
  socket.name = "Anônimo";
  
  socket.on('send_message', (data) => {
    const { username, text } = data;
    if (!text || !username) return;

    // Salva no banco de dados do Render
    pool.query('INSERT INTO messages (username, text) VALUES ($1, $2)', [username, text])
      .then(() => {
        // Envia a mensagem para todo mundo que está conectado
        io.emit('receive_message', { username, text });
      })
      .catch(err => console.error("Erro ao salvar mensagem:", err));
  });

  socket.on('disconnect', () => {
    console.log('Usuário desconectado.');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
