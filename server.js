const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuração do PostgreSQL (O Render fornecerá a variável DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necessário para conexões externas no Render
  }
});

// Criar tabela de mensagens caso não exista ao iniciar o servidor
pool.query(`
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('Tabela de mensagens pronta.'))
  .catch(err => console.error('Erro ao criar tabela:', err));

// Servir os arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

// Lógica de tempo real e Banco de Dados
io.on('connection', async (socket) => {
  console.log('Novo usuário conectado');

  // Enviar as últimas 50 mensagens ao conectar
  try {
    const result = await pool.query('SELECT username, text FROM messages ORDER BY created_at ASC LIMIT 50');
    socket.emit('load messages', result.rows);
  } catch (err) {
    console.error('Erro ao buscar mensagens:', err);
  }

  // Ouvir novas mensagens do frontend
  socket.on('chat message', async (msg) => {
    try {
      // Salvar no banco de dados PostgreSQL
      await pool.query('INSERT INTO messages (username, text) VALUES ($1, $2)', [msg.username, msg.text]);
      // Transmitir para todos os usuários conectados
      io.emit('chat message', msg);
    } catch (err) {
      console.error('Erro ao salvar mensagem:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Usuário desconectado');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});