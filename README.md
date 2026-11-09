# Mango Money

Aplicação React/Vite para finanças do casal. Código versionado neste repositório. A publicação em produção está pendente.

## Executar

Node 22 ou superior. `npm ci`, copie `.env.example` para `.env.local`, preencha URL e chave pública Supabase e execute `npm run dev`. Nunca use service_role no frontend.

## Banco

Em projeto exclusivo do aplicativo, executar `supabase/001_mango.sql` e depois `supabase/002_profile.sql`. As tabelas têm RLS por casal, convites de uso único válidos por 24 horas e limite de dois participantes. Configure autenticação e-mail/senha e URLs de confirmação/recuperação para o domínio publicado.

## Publicar

Render Static Site conectado ao repositório GitHub: build `npm ci && npm run build`, diretório `dist`. Configurar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY com URL e chave pública. Confirmar cadastro, recuperação de senha e compartilhamento entre dois usuários antes de liberar uso real.

## Verificação

`npm test`: cálculo contínuo do saldo, importação CSV/OFX/PDF, duplicatas e execução do esquema real em PostgreSQL PGlite com pgcrypto. O teste de banco verifica isolamento entre casais, convite usado, máximo de dois membros e XP sem repetição. `npm run build` compila a produção.

## Comportamento

Saldo atual soma lançamentos pagos e faturas pagas desde o saldo inicial. Projeção inclui entradas/saídas previstas e faturas em aberto, inclusive vencidas. Faturas são cadastradas pelo total. Extratos de cartão são apenas analisados; importação bancária exige revisão. PDF escaneado não suporta OCR. Sincronização consulta o servidor a cada dez segundos e ao voltar à janela. Edições usam versão para detectar conflitos.

Cursos e perguntas foram preservados do projeto Floot. O progresso existente permanece no navegador do site antigo; sua migração ainda precisa ser implementada e validada. Não limpar o site antigo. Demonstração existe somente em desenvolvimento e não salva dados.

## Pendências de publicação

projeto Supabase jtspfjufvptxcdqmbpje criado em sa-east-1 e SQL aplicado; configurar URLs do Auth; O Render recusou a criação da hospedagem com HTTP 402, solicitando cartão cadastrado. Após resolver essa exigência, publicar e validar os fluxos em dois aparelhos. Importação do histórico/XP antigo e revisão visual completa ainda pendentes.
