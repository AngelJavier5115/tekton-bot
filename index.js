import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import http from 'http';

// SERVIDOR HTTP PARA PLAN GRATUITO DE RENDER
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Tekton Bot is active!\n');
}).listen(PORT, () => {
  console.log(`[Tekton] Servidor HTTP activo en puerto ${PORT}`);
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// CONEXIÓN OPCIONAL A DEEPSEEK (Evita crash si aún no agregas la API Key)
const deepseek = process.env.DEEPSEEK_API_KEY 
  ? new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: process.env.DEEPSEEK_API_KEY })
  : null;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName('tekton-nodo')
    .setDescription('Tekton: Registra y estructura un nuevo nodo en la red')
    .addStringOption(option =>
      option.setName('contenido')
        .setDescription('La idea o dato a estructurar')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

process.on('unhandledRejection', error => {
  console.error('[Tekton] Unhandled Rejection:', error);
});

client.once('ready', async () => {
  console.log(`[Tekton] Bot en línea como: ${client.user.tag}`);
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[Tekton] Comando /tekton-nodo registrado exitosamente.');
  } catch (e) {
    console.error('[Tekton] Error al registrar comando:', e);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'tekton-nodo') {
    try {
      await interaction.deferReply();

      if (!deepseek) {
        return await interaction.editReply('[Tekton] ⚠️ La API Key de DeepSeek aún no ha sido configurada.');
      }

      const contenido = interaction.options.getString('contenido');

      const { data, error } = await supabase
        .from('investigaciones')
        .insert([{
          contenido: contenido,
          autor: interaction.user.tag,
          tipo: 'aporte',
          estado: 'pendiente'
        }])
        .select();

      if (error) {
        return await interaction.editReply(`[Tekton] ❌ Error en base de datos: ${error.message}`);
      }

      await interaction.editReply(`[Tekton] ✅ **Nodo #${data[0].id} estructurado y anclado a la red.**`);
    } catch (err) {
      console.error('[Tekton] Error en interacción:', err);
      await interaction.editReply('[Tekton] ❌ Ocurrió un error interno.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
