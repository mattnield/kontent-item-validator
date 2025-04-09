# Kontent.AI Content Validator

A custom element for [Kontent.AI](https://kontent.ai) that performs real-time validation on content items before they're moved to a "Ready for Translation" workflow step.

This prevents incomplete or invalid content from being sent to external translation providers, saving time and cost.

---

## ✨ Features

- ✅ Validates required fields, asset limits, and linked items
- 🔗 Recursively validates modular content
- 🧠 Supports rich text fields and embedded components
- 🌍 Supports language-specific variants
- 🚦 Shows validation results in the UI
- 🚀 Allows editors to move valid content to the next workflow step
- 🔐 Uses the Management API and Preview Delivery API securely

---

## 📦 Tech Stack

- ⚡️ [Vite](https://vitejs.dev/) for local dev
- 🧩 Custom Element using the Kontent.AI SDK (`@kentico/custom-element-devkit`)
- 📦 `@kontent-ai/management-sdk` for validation rules
- 📦 `@kontent-ai/delivery-sdk` for resolved content
- 🧪 JSDoc comments for documentation
- 🚀 Ready for deployment via Netlify

---

## 🔧 Local Development

### 1. Clone the project

```bash
git clone https://github.com/yourname/kontent-validator.git
cd kontent-validator
npm install
```

### 2. Configure environment variables

Create a `.env` file from the provided example:

```bash
cp .env.example .env
```

Then fill in your Kontent.AI credentials:

```env
VITE_KONTENT_ENVIRONMENT_ID=your-environment-id
VITE_KONTENT_MANAGEMENT_API_KEY=your-management-api-key
VITE_KONTENT_PREVIEW_API_KEY=your-preview-api-key
```

> **Note**: `.env` is excluded from version control via `.gitignore`.

---

### 3. Run the dev server (with HTTPS)

```bash
npm run dev
```

Access the custom element at [https://localhost:5173/](https://localhost:5173/)

> 📦 HTTPS is required for integration into Kontent.AI

---

## 🧠 Usage in Kontent.AI

1. Go to **Project settings → Custom elements**
2. Add a new element pointing to your local or deployed URL
3. Add the custom element to the desired content types
4. It will validate the current item and expose a **“Send to Translation”** button if valid

---

## ✅ Validation Logic

- Uses **Management API** to get content type rules:
  - `required: true`
  - `validation.limit`
  - Allowed modular content types
- Uses **Delivery API (Preview)** to resolve:
  - Linked items (modular content)
  - Embedded components in rich text
- Recursively validates all nested items
- Blocks transition to next workflow step unless validation passes

---

## 🚀 Deployment

This project is ready to deploy to [Netlify](https://netlify.com), Vercel, or any static hosting provider.

> Don’t forget to configure environment variables on your host!

---

## 🛡 License

MIT License © 2025 [Your Name]

See [LICENSE](./LICENSE)

---

## 🤝 Contributions

PRs welcome! Let’s make content validation ✨ smooth ✨ and bulletproof.

---

## 📬 Questions?

Feel free to reach out or open an issue if you need help extending the validator to support other content rules or custom use cases.
