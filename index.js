client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'tekton-nodo') {
    try {
      await interaction.deferReply();

      if (!deepseek) {
        return await interaction.editReply('[Tekton] ⚠️ La API Key de DeepSeek aún no ha sido configurada.');
      }

      const contenido = interaction.options.getString('contenido');

      // --- 1. Insertar el nuevo nodo ---
      const { data: nuevoNodo, error: insertError } = await supabase
        .from('investigaciones')
        .insert([{
          contenido: contenido,
          autor: interaction.user.tag,
          tipo: 'aporte',
          estado: 'pendiente'
        }])
        .select();

      if (insertError) {
        return await interaction.editReply(`[Tekton] ❌ Error en base de datos: ${insertError.message}`);
      }

      const nodoId = nuevoNodo[0].id;
      console.log(`[Tekton] Nodo #${nodoId} insertado. Buscando relaciones...`);

      // --- 2. Buscar nodos previos ---
      const { data: nodosPrevios, error: fetchError } = await supabase
        .from('investigaciones')
        .select('id, contenido')
        .lt('id', nodoId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (fetchError) {
        console.error(`[Tekton] Error al buscar nodos previos:`, fetchError);
        return await interaction.editReply(`[Tekton] ✅ Nodo #${nodoId} creado, pero no se pudo buscar relaciones.`);
      }

      // --- 3. Identificar relación conceptual (palabras clave) ---
      let refId = null;
      const palabrasClave = contenido
        .toLowerCase()
        .replace(/[^\w\s]/gi, '')
        .split(/\s+/)
        .filter(p => p.length > 3);

      for (const previo of nodosPrevios || []) {
        const contenidoPrevio = previo.contenido.toLowerCase();
        for (const palabra of palabrasClave) {
          if (contenidoPrevio.includes(palabra)) {
            refId = previo.id;
            console.log(`[Tekton] Relación encontrada: #${nodoId} → #${refId} (coincidencia: "${palabra}")`);
            break;
          }
        }
        if (refId) break;
      }

      // --- 4. Actualizar ref_id si se encontró relación ---
      if (refId) {
        const { error: updateError } = await supabase
          .from('investigaciones')
          .update({ ref_id: refId })
          .eq('id', nodoId);

        if (updateError) {
          console.error(`[Tekton] Error al actualizar ref_id:`, updateError);
          await interaction.editReply(`[Tekton] ✅ Nodo #${nodoId} creado, pero no se pudo asignar la relación.`);
        } else {
          await interaction.editReply(`[Tekton] ✅ **Nodo #${nodoId} estructurado y relacionado con #${refId}.**`);
        }
      } else {
        await interaction.editReply(`[Tekton] ✅ **Nodo #${nodoId} creado. No se detectaron relaciones previas.**`);
      }

    } catch (err) {
      console.error('[Tekton] Error en interacción:', err);
      await interaction.editReply('[Tekton] ❌ Ocurrió un error interno.');
    }
  }
});
