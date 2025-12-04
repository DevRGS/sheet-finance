# Guia de Deploy no GitHub Pages

## ⚠️ IMPORTANTE: Configurar o Nome do Repositório

Antes de fazer o deploy, você **DEVE** ajustar o nome do repositório no arquivo `.github/workflows/deploy.yml`:

1. Abra o arquivo `.github/workflows/deploy.yml`
2. Encontre a linha com `BASE_URL: /${{ github.event.repository.name }}/`
3. Se o nome do seu repositório for diferente de `sheet-finance`, você pode:
   - **Opção 1**: Deixar como está (usa o nome do repositório automaticamente)
   - **Opção 2**: Substituir por um valor fixo, exemplo:
     ```yaml
     BASE_URL: /meu-repositorio/
     ```

## 📋 Passos para Deploy

### 1. Configurar GitHub Pages

1. Vá para **Settings** do seu repositório no GitHub
2. Navegue até **Pages** no menu lateral
3. Em **Source**, selecione **GitHub Actions** (não "Deploy from a branch")
4. Salve as configurações

### 2. Fazer Push do Código

```bash
git add .
git commit -m "Configure GitHub Pages deployment"
git push origin main
```

### 3. Verificar o Deploy

1. Vá para a aba **Actions** do seu repositório
2. Aguarde o workflow "Deploy to GitHub Pages" completar
3. Se houver erros, verifique os logs

### 4. Acessar a Aplicação

Após o deploy bem-sucedido, sua aplicação estará disponível em:
```
https://seu-usuario.github.io/nome-do-repositorio/
```

## 🔧 Solução de Problemas

### Página em Branco

Se a página aparecer em branco:

1. **Verifique o nome do repositório**:
   - O `BASE_URL` no workflow deve corresponder ao nome do repositório
   - Exemplo: Se o repositório é `meu-finance`, use `/meu-finance/`

2. **Verifique o console do navegador**:
   - Abra as Ferramentas de Desenvolvedor (F12)
   - Vá para a aba Console
   - Procure por erros relacionados a caminhos (404 em arquivos .js, .css)

3. **Verifique se o 404.html foi copiado**:
   - O arquivo `public/404.html` deve estar na raiz do `dist` após o build

4. **Limpe o cache do navegador**:
   - Pressione Ctrl+Shift+R (ou Cmd+Shift+R no Mac) para recarregar sem cache

### Erros no Build

Se o build falhar:

1. Verifique os logs do GitHub Actions
2. Certifique-se de que todas as dependências estão no `package.json`
3. Verifique se o Node.js versão 18 está sendo usada

## 📝 Notas Importantes

- O arquivo `404.html` é necessário para que o React Router funcione no GitHub Pages
- O `base` no `vite.config.ts` será substituído automaticamente pelo `BASE_URL` do workflow
- O `basename` no `BrowserRouter` usa `import.meta.env.BASE_URL` automaticamente
- Em desenvolvimento local, o `base` é `/` para funcionar normalmente

