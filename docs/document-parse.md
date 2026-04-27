# Document Parse

Solar Code integrates Upstage Document Parse as a first-class capability.

## Usage

```bash
# Parse PDF to markdown
solar parse ./report.pdf

# Specify output format
solar parse ./report.pdf --format markdown
solar parse ./form.pdf --format html

# Ask Solar a question about the parsed content
solar parse ./report.pdf --ask "핵심 내용을 요약해줘"
solar parse ./contract.pdf --ask "주요 리스크를 나열해줘"
```

## Supported File Types

- PDF (`.pdf`)
- Images: PNG, JPG, JPEG, TIFF, BMP, HEIC
- Office: DOCX, PPTX, XLSX

## Output

Parsed content is saved to `.solar-code/parsed/<filename>.md`.

For large documents, the CLI shows the first 3000 characters and saves the full content to file.

## API

```typescript
import { parseDocument } from '@solar-code/core';

const result = await parseDocument({
  filePath: './report.pdf',
  outputFormat: 'markdown',
  omsDir: '.solar-code',
  apiKey: process.env.UPSTAGE_API_KEY,
});

console.log(result.content);
console.log(result.savedPath);
```

## Configuration

In `.solar-code/config.json`:

```json
{
  "documentParse": {
    "enabled": true,
    "outputFormat": "markdown"
  }
}
```

## Korean Document Support

Solar natively understands Korean, making it ideal for:
- 한국어 계약서 (Korean contracts)
- 정부 문서 (Government documents)
- 사업계획서 (Business plans)
- 보고서 (Reports)

```bash
solar parse ./계약서.pdf --ask "갑을 관계와 주요 의무 사항을 정리해줘"
```
