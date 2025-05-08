# Kontent.AI Content Validator

A custom element for [Kontent.AI](https://kontent.ai) that performs real-time validation on content items before they're moved to a "Ready for Translation" workflow step.

This prevents incomplete or invalid content from being sent to external translation providers, saving time and cost.

---

## ✨ Features

- ✅ Validates required fields, asset limits, and linked items
- 🔗 Recursively validates modular content
- 🧠 Supports rich text fields and embedded components
- 🌍 Supports language-specific variants
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
VITE_WORKFLOW_CODENAME=active-workflow-codename
VITE_TO_STEP_CODENAME=codename-of-previous-workflow-step
VITE_FROM_STEP_CODENAME=codename-of-desired-workflow-step
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
4. Configure the JSON for the custom elemetn as follows
```json
{
    "worflowCodename": active-workflow-codename,
    "toStepCodename": codename-of-desired-workflow-step,
    "fromStepCodename": codename-of-previous-workflow-step,
    "environmentId": your-environment-id,
    "mapiKey": your-management-api-key,
    "dapiPreviewKey": your-preview-api-key
}
```

---

## ✅ Validation Logic

- Uses **Delivery API (Preview)** to resolve:
  - Linked items (modular content)
  - Embedded components in rich text
- Recursively validates nested items
- Blocks transition to next workflow step unless validation passes

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
