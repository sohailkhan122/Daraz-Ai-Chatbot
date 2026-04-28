# Gemini Product Chatbot (Next.js)

This project is an AI chatbot that accepts a shopping query, uses Gemini to extract the product name, scrapes product results from Daraz, and returns product details with clickable website links.

## Features

- Gemini-powered product name extraction
- Server-side product scraping from Daraz
- API response with title, price, source, and product link
- Chat UI with loading and error states

## Project Structure

```text
app/
	api/
		chat/
			route.js         # Chat API route (Gemini + scraper orchestration)
	page.tsx             # Chatbot UI
lib/
	gemini.js            # Gemini integration + fallback extractor
	scraper.js           # Daraz scraper
.env.example           # Required environment variables
```

## Setup

1. Install dependencies:

	 npm install

2. Create environment file:

	 copy .env.example .env.local

3. Put your Gemini API key in `.env.local`:

	 GEMINI_API_KEY=your_key_here

4. Optional model override:

	 GEMINI_MODEL=gemini-2.5-flash-lite

5. Run the app:

	 npm run dev

6. Open:

	 http://localhost:3000

## API Contract

### POST `/api/chat`

Request body:

```json
{
	"message": "iphone 13 128gb price"
}
```

Success response:

```json
{
	"reply": "Found 5 products for \"iphone 13 128gb\"",
	"query": "iphone 13 128gb",
	"products": [
		{
			"title": "Apple iPhone 13",
			"price": "Rs. 179,999",
			"link": "https://www.daraz.pk/products/...",
			"source": "Daraz"
		}
	]
}
```

Error response:

```json
{
	"error": "Message is required."
}
```
