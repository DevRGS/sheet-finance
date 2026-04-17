# FinanceFlow - Sistema de Controle Financeiro Pessoal

Sistema moderno e completo de controle financeiro pessoal com dashboard interativo, gráficos analíticos e integração direta com Google Sheets como banco de dados.

![FinanceFlow](https://img.shields.io/badge/FinanceFlow-v1.0.0-blue)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.4.19-646CFF?logo=vite)

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso](#uso)
- [Deploy no GitHub Pages](#deploy-no-github-pages)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

## 🎯 Sobre o Projeto

O FinanceFlow é uma aplicação web moderna para controle financeiro pessoal que permite gerenciar receitas, despesas, categorias, metas financeiras, transações recorrentes e contas a pagar/receber. Todos os dados são armazenados diretamente no Google Sheets, proporcionando acesso fácil e sincronização automática.

## ✨ Funcionalidades

### 📊 Dashboard
- **Visão Geral**: Estatísticas rápidas de receitas, despesas, saldo do mês e saldo total
- **Gráficos Interativos**: 
  - Gráfico de receitas vs despesas mensais
  - Gráfico de pizza por categorias
  - Gráfico de balanço anual com comparação ano a ano
- **Transações Recentes**: Lista das últimas transações registradas

### 💰 Transações
- **CRUD Completo**: Criar, editar, visualizar e excluir transações
- **Filtros Avançados**: 
  - Busca por descrição ou categoria
  - Filtro por tipo (Receita/Despesa)
  - Filtro por categoria
  - Filtro por período (data inicial e final)
- **Categorização**: Organize suas transações por categorias personalizadas

### 🔄 Transações Recorrentes
- **Gestão de Recorrências**: Configure transações que se repetem automaticamente
- **Tipos de Recorrência**: Mensal, bimestral, trimestral, semestral ou anual
- **Controle de Duração**: Defina duração por meses ou até cancelamento manual
- **Ativação/Desativação**: Controle quais recorrências estão ativas

### 📈 Previsões
- **Geração Automática**: Previsões baseadas em transações recorrentes ativas
- **Período Configurável**: Visualize previsões para 3, 6, 12 ou 24 meses à frente
- **Agrupamento por Mês**: Visualize receitas e despesas previstas agrupadas por mês
- **Cálculo de Saldo Previsto**: Veja o saldo previsto para cada período

### 🎯 Metas Financeiras
- **Criação de Metas**: Defina metas com valor alvo e prazo
- **Acompanhamento Visual**: Barra de progresso mostra o quanto já foi alcançado
- **Movimentações**: 
  - Adicione depósitos para suas metas
  - Realize saques quando necessário
  - Histórico completo de movimentações
- **Cálculo Automático**: Valor atual é calculado automaticamente baseado nas movimentações

### 📝 Contas a Pagar/Receber
- **Gestão de Contas**: Controle contas a pagar e a receber separadamente
- **Datas de Vencimento**: Defina datas de vencimento opcionais
- **Status de Pagamento**: Marque contas como pagas/recebidas
- **Alertas de Vencimento**: Contas vencidas são destacadas visualmente
- **Filtros**: Filtre por tipo e status (Todas/Pendentes/Pagas)

### 📂 Categorias
- **Categorias Personalizadas**: Crie e gerencie suas próprias categorias
- **Cores Personalizadas**: Cada categoria pode ter sua cor identificadora
- **Estatísticas**: Veja o total gasto por categoria e percentual do total
- **Proteção**: Categorias com transações não podem ser excluídas

### ⚙️ Configurações
- **Integração Google Sheets**: Configure suas credenciais para sincronização
- **Conexão Automática**: Sistema tenta conectar automaticamente ao carregar
- **Validação de Credenciais**: Verificação automática antes de conectar

## 🛠️ Tecnologias

### Frontend
- **React 18.3.1** - Biblioteca JavaScript para construção de interfaces
- **TypeScript 5.8.3** - Superset do JavaScript com tipagem estática
- **Vite 5.4.19** - Build tool moderna e rápida
- **React Router DOM 6.30.1** - Roteamento para aplicações React
- **Tailwind CSS 3.4.17** - Framework CSS utility-first
- **shadcn/ui** - Componentes UI acessíveis e customizáveis
- **Recharts 2.15.4** - Biblioteca de gráficos para React
- **React Hook Form 7.61.1** - Gerenciamento de formulários
- **Zod 3.25.76** - Validação de schemas TypeScript-first
- **date-fns 3.6.0** - Manipulação de datas
- **Sonner 1.7.4** - Sistema de notificações toast

### Backend/Integração
- **Google Sheets API** - Armazenamento e sincronização de dados
- **JWT Authentication** - Autenticação via Service Account

## 📦 Pré-requisitos

Antes de começar, você precisará ter instalado:

- **Node.js** (versão 18 ou superior) - [Download](https://nodejs.org/)
- **npm** ou **yarn** - Gerenciadores de pacotes
- **Conta Google Cloud** - Para criar Service Account e obter credenciais
- **Google Sheets** - Uma planilha para armazenar os dados

## 🚀 Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/seu-usuario/sheet-finance.git
cd sheet-finance
```

2. **Instale as dependências**
```bash
npm install
```

3. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

## ⚙️ Configuração

### Como funciona (sem servidor, sem APIs pagas)

Este projeto usa **Google Login (OAuth via Google Identity Services)** no navegador e acessa o **Google Sheets** diretamente (via `gapi`), usando o token do usuário.

Isso significa que:
- Você **não** precisa de Service Account nem chave privada.
- A planilha deve estar **na sua conta Google** (ou compartilhada com o usuário logado).
- O app pode **listar** suas planilhas e também **criar** uma nova (Drive API), tudo após você autorizar no popup do Google.

### Passo a passo (primeiro uso)

1. Rode o projeto e abra a aplicação.
2. Vá em **Configurações**.
3. Clique em **Conectar com Google** e autorize o acesso (Sheets + listar planilhas do Drive).
4. Selecione uma planilha existente **ou** crie uma nova pela própria tela.
5. Ao selecionar/criar, o app **inicializa automaticamente** as abas necessárias na planilha.

A aplicação criará automaticamente as abas necessárias na planilha:
- `config` - Configurações do sistema
- `transacoes` - Transações financeiras
- `categorias` - Categorias personalizadas
- `metas` - Metas financeiras
- `movimentacoes_metas` - Movimentações das metas
- `transacoes_recorrentes` - Transações recorrentes
- `contas` - Contas a pagar/receber
- `orcamentos` - Orçamentos por categoria
- `contas_bancarias` - Contas bancárias

## 💻 Uso

### Adicionar Transação
1. Clique no botão **Nova Transação** no header
2. Preencha os dados: tipo, descrição, valor, categoria, forma de pagamento
3. Selecione a data
4. Adicione observações (opcional)
5. Clique em **Adicionar**

### Criar Transação Recorrente
1. Vá para a aba **Recorrentes** na página de Transações
2. Clique em **Nova Recorrente**
3. Configure a recorrência (mensal, bimestral, etc.)
4. Defina a duração ou deixe até cancelamento
5. Salve

### Criar Meta Financeira
1. No Dashboard, vá para a seção **Metas Financeiras**
2. Clique em **Nova Meta**
3. Defina nome, valor alvo, prazo e cor
4. Salve
5. Use **Movimentação** para adicionar depósitos ou saques

### Gerenciar Contas
1. Vá para a aba **Contas** na página de Transações
2. Clique em **Nova Conta**
3. Escolha o tipo (Pagar/Receber)
4. Preencha os dados e defina data de vencimento (opcional)
5. Marque como paga quando necessário

## 🌐 Deploy no GitHub Pages

### 1. Configurar Vite para GitHub Pages

O projeto já está configurado para funcionar no GitHub Pages. Certifique-se de que o `vite.config.ts` está configurado corretamente:

```typescript
export default defineConfig({
  base: '/sheet-finance/', // Nome do seu repositório
  // ... outras configurações
})
```

### 2. Build do Projeto

```bash
npm run build
```

### 3. Deploy no GitHub Pages

1. Vá para **Settings** do seu repositório no GitHub
2. Navegue até **Pages** no menu lateral
3. Em **Source**, selecione **GitHub Actions**
4. Crie um arquivo `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      - uses: actions/deploy-pages@v4
```

5. Faça commit e push das alterações
6. O GitHub Actions fará o deploy automaticamente

### 4. Acessar a Aplicação

Após o deploy, sua aplicação estará disponível em:
```
https://seu-usuario.github.io/sheet-finance/
```

## 📁 Estrutura do Projeto

```
sheet-finance/
├── public/                 # Arquivos estáticos
│   ├── favicon.png        # Favicon da aplicação
│   └── robots.txt         # Configuração para crawlers
├── src/
│   ├── components/        # Componentes React
│   │   ├── finance/       # Componentes financeiros
│   │   ├── layout/        # Componentes de layout
│   │   └── ui/            # Componentes UI (shadcn)
│   ├── contexts/          # Contextos React
│   ├── data/              # Funções de processamento de dados
│   ├── hooks/             # Custom hooks
│   ├── pages/             # Páginas da aplicação
│   ├── services/          # Serviços (Google Sheets API)
│   ├── types/             # Definições TypeScript
│   └── lib/               # Utilitários
├── index.html             # HTML principal
├── package.json           # Dependências do projeto
├── vite.config.ts         # Configuração do Vite
├── tailwind.config.ts     # Configuração do Tailwind
└── tsconfig.json          # Configuração do TypeScript
```

## 🎨 Design Responsivo

A aplicação é totalmente responsiva e otimizada para:
- 📱 **Mobile** (smartphones)
- 📱 **Tablets**
- 💻 **Desktop**

Todos os componentes se adaptam automaticamente ao tamanho da tela, proporcionando uma experiência otimizada em qualquer dispositivo.

## 🔒 Segurança

- O token de autenticação e a configuração da planilha ficam armazenados no navegador (atualmente via **localStorage**)
- Nenhuma informação sensível é enviada para servidores externos
- A autenticação é feita diretamente entre o navegador e a Google Sheets API
- Recomenda-se usar uma conta Google dedicada apenas para este projeto (opcional)

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer um Fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abrir um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 👤 Autor

**Rafael Santos**

- GitHub: [@DevRGS](https://github.com/DevRGS)

## 🙏 Agradecimentos

- [shadcn/ui](https://ui.shadcn.com/) - Componentes UI incríveis
- [Recharts](https://recharts.org/) - Biblioteca de gráficos
- [Google Sheets API](https://developers.google.com/sheets/api) - API de planilhas
- [Vite](https://vitejs.dev/) - Build tool moderna
- [React](https://react.dev/) - Biblioteca JavaScript

---

⭐ Se este projeto foi útil para você, considere dar uma estrela no repositório!
