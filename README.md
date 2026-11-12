# Entre Laços — Amigo secreto

Aplicação estática em HTML, CSS e JavaScript. Salas e resultados compartilhados usam Supabase Edge Functions; os pares nunca são enviados ao navegador do organizador. Cada link individual revela somente o resultado associado ao seu token aleatório.

## Configuração

1. Crie um projeto Supabase (o plano Free atende a esta versão) e abra o **SQL Editor**.
2. Execute `supabase/schema.sql`. As tabelas ficam sem acesso direto para `anon` e `authenticated`; não adicione policies públicas.
3. Instale/abra o Supabase CLI e faça login. Na raiz desta pasta:

   ```sh
   supabase link --project-ref SEU_PROJECT_REF
   supabase functions deploy secret-room --no-verify-jwt
   ```

   A função usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do próprio projeto, disponíveis automaticamente no runtime das Edge Functions. Nunca coloque a service role key no navegador.
4. Edite `config.js` com Project URL e a chave pública `anon`/`publishable`. Essa configuração acompanha os convites e permite que cada participante abra o link sem configurar o próprio navegador. Nunca use a service role key nesse arquivo.
5. Sirva esta pasta por HTTP/HTTPS (por exemplo, `python3 -m http.server 8000`) e abra `http://localhost:8000`. O ícone de engrenagem também permite configurar apenas o navegador atual para desenvolvimento local.
6. Publique a pasta em um host estático com HTTPS. Crie a sala, copie cada convite e envie-o em particular. A pessoa abre o link e toca em **Revelar meu amigo secreto**. O link pode ser aberto novamente pela mesma pessoa.

## Privacidade e limites

- O organizador recebe a lista de nomes e links de convite, mas não recebe os pares. O endpoint de revelação aceita apenas um token individual e responde com um único nome.
- Quem tiver o link individual consegue ver aquele resultado; envie cada link somente à pessoa correspondente.
- A lista de salas e seus links ficam no `localStorage` do navegador do organizador para que ele possa voltar à tela de convites. Limpar os dados do navegador remove essa lista; guarde os convites separadamente.
- Para endurecimento antes de uso público: adicionar rate limiting por IP/token na Edge Function e restringir CORS ao domínio publicado. A service role fica exclusivamente no servidor Supabase.
- Não há autenticação de organizador, edição de participantes ou exclusão de salas nesta versão.
