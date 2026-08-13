# Temp Mail — Railway + Mailgun

Este projeto cria endereços temporários e recebe e-mails reais por Mailgun Inbound Routes.
O site não usa contas Gmail de terceiros.

## 1. O que você precisa
- Conta Railway
- Conta Mailgun
- Um domínio próprio (ex.: meusite.com) ou subdomínio dedicado para recebimento
- GitHub, se for publicar pelo repositório

## 2. Arquivos
- server.js — backend Express e webhook Mailgun
- public/index.html — interface
- package.json — configuração Node
- railway.json — configuração de deploy
- .gitignore — evita enviar dados locais

## 3. Publicar no GitHub
Crie um repositório e envie estes arquivos.
NÃO coloque sua chave Mailgun no código.

## 4. Deploy no Railway
No Railway:
1. New Project
2. Deploy from GitHub repo
3. Escolha o repositório
4. Deploy

O Railway detecta Node.js automaticamente. O Start Command é `npm start`.

Depois de publicar:
Settings -> Networking -> Generate Domain.
Você terá algo como `https://seu-app.up.railway.app`.

## 5. Variáveis do Railway
Em Variables, adicione:

MAIL_DOMAIN=mail.seudominio.com
MAILGUN_SIGNING_KEY=SUA_CHAVE_DE_ASSINATURA_MAILGUN
TTL_HOURS=24
MAX_INBOXES=1000
MAX_MESSAGES_PER_INBOX=50
DATA_DIR=/data

A chave usada para validar o webhook deve ser a Signing Key apropriada do Mailgun.
Nunca publique essa chave no GitHub.

## 6. Persistência no Railway
Sem armazenamento persistente, o arquivo data/data.json pode desaparecer em novo deploy/restart.
Crie um Volume no serviço e monte em `/data`.
A variável DATA_DIR deve continuar como `/data`.

## 7. Configurar o domínio no Mailgun
Adicione seu domínio/subdomínio no Mailgun e siga exatamente os registros DNS mostrados pelo painel.
Para recebimento, o MX precisa apontar para os servidores MX indicados pelo Mailgun.

Para um subdomínio como `mail.seudominio.com`, você pode usar:
usuario@mail.seudominio.com

## 8. Criar a Route no Mailgun
Depois que o Railway estiver com domínio público, crie uma Route de recebimento:

Filter:
match_recipient(".*@mail.seudominio.com")

Action:
forward("https://SEU-APP.up.railway.app/webhooks/mailgun")

Você pode adicionar stop() depois do forward se quiser impedir outras rotas de processarem a mesma mensagem.

## 9. Testar
1. Abra o site.
2. Clique em "Criar e-mail".
3. Copie o endereço mostrado.
4. Envie um e-mail de outro provedor para ele.
5. Aguarde alguns segundos.
6. Clique em "Atualizar" ou espere a atualização automática.

## Segurança
- O webhook valida a assinatura do Mailgun quando MAILGUN_SIGNING_KEY está configurada.
- Cada caixa tem um token privado.
- O site não expõe uma lista pública de caixas.
- Não use este projeto para spam, fraude, criação automatizada de contas ou contornar sistemas de verificação.
- Para produção, adicione rate limiting, CAPTCHA/TurnstILE, logs, limites de armazenamento e uma política de abuso.

## Observação importante
Este projeto é uma base funcional. Mailgun é a camada que recebe as mensagens e faz POST do conteúdo parseado para o webhook. O Mailgun documenta que as Routes podem encaminhar mensagens para uma URL HTTP e que o POST inclui remetente, destinatário, assunto e corpo.
